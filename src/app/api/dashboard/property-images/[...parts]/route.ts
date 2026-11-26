import { NextRequest, NextResponse } from "next/server";
import {
  getAuthToken,
  laravelRequest,
} from "@/lib/auth/server";

type Context = {
  params: Promise<{ parts: string[] }>;
};

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type Target = {
  path: string;
  image: boolean;
  upload: boolean;
  reorder: boolean;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 7 * 1024 * 1024;

const validId = (value: string): boolean =>
  /^[1-9]\d*$/.test(value);

function resolveTarget(
  method: Method,
  parts: string[],
): Target | null {
  if (!parts.length || !validId(parts[0])) {
    return null;
  }

  const propertyId = parts[0];
  const base = `/properties/${propertyId}/images`;

  if (parts.length === 1) {
    if (method === "GET" || method === "POST") {
      return {
        path: base,
        image: false,
        upload: method === "POST",
        reorder: false,
      };
    }
  }

  if (
    parts.length === 2 &&
    parts[1] === "reorder" &&
    method === "PATCH"
  ) {
    return {
      path: `${base}/reorder`,
      image: false,
      upload: false,
      reorder: true,
    };
  }

  if (
    parts.length === 2 &&
    validId(parts[1]) &&
    (method === "GET" || method === "DELETE")
  ) {
    return {
      path: `${base}/${parts[1]}`,
      image: method === "GET",
      upload: false,
      reorder: false,
    };
  }

  if (
    parts.length === 3 &&
    validId(parts[1]) &&
    parts[2] === "cover" &&
    method === "PATCH"
  ) {
    return {
      path: `${base}/${parts[1]}/cover`,
      image: false,
      upload: false,
      reorder: false,
    };
  }

  return null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");

  // Trusted public website origins, not the internal Nginx origin.
  const allowedOrigins = new Set([
    "https://www.graciousinvestiment.com",
    "https://graciousinvestiment.com",
  ]);

  return (
    origin !== null &&
    allowedOrigins.has(origin) &&
    (!site || ["same-origin", "none"].includes(site))
  );
}

async function handle(
  request: NextRequest,
  context: Context,
  method: Method,
): Promise<Response> {
  const { parts } = await context.params;
  const target = resolveTarget(method, parts);

  if (!target) {
    return errorResponse("Unsupported image operation.", 404);
  }

  if (method !== "GET" && !sameOrigin(request)) {
    return errorResponse("Request origin rejected.", 403);
  }

  const token = await getAuthToken();

  if (!token) {
    return errorResponse("Please sign in again.", 401);
  }

  try {
    let body: FormData | string | undefined;
    let headers: HeadersInit | undefined;

    if (target.upload) {
      const contentType =
        request.headers.get("content-type") || "";

      if (
        !contentType
          .toLowerCase()
          .startsWith("multipart/form-data;")
      ) {
        return errorResponse(
          "Multipart image upload required.",
          415,
        );
      }

      const declaredLength = Number(
        request.headers.get("content-length") || "0",
      );

      if (
        !Number.isFinite(declaredLength) ||
        declaredLength < 0 ||
        declaredLength > MAX_REQUEST_BYTES
      ) {
        return errorResponse("Image upload is too large.", 413);
      }

      let incoming: FormData;

      try {
        incoming = await request.formData();
      } catch {
        return errorResponse("Invalid image upload.", 400);
      }

      const file = incoming.get("image");

      if (!(file instanceof File) || file.size === 0) {
        return errorResponse("Select an image file.", 422);
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return errorResponse(
          "Maximum image size is 5 MB.",
          413,
        );
      }

      const extension = file.name
        .split(".")
        .pop()
        ?.toLowerCase();

      const supported = ["jpg", "jpeg", "png", "gif", "webp"];

      if (!extension || !supported.includes(extension)) {
        return errorResponse(
          "Use a supported image format.",
          422,
        );
      }

      // Laravel remains responsible for validating image contents.
      const form = new FormData();
      form.append("image", file, file.name);

      body = form;
    }

    if (target.reorder) {
      const contentType =
        request.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        return errorResponse("JSON request required.", 415);
      }

      const raw = await request.text();

      if (raw.length > 4000) {
        return errorResponse("Reorder request too large.", 413);
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        return errorResponse("Invalid JSON request.", 400);
      }

      const imageIds =
        parsed &&
        typeof parsed === "object" &&
        "image_ids" in parsed
          ? parsed.image_ids
          : null;

      if (
        !Array.isArray(imageIds) ||
        imageIds.length < 1 ||
        imageIds.length > 30 ||
        !imageIds.every(
          (id): id is number =>
            Number.isSafeInteger(id) && id > 0,
        ) ||
        new Set(imageIds).size !== imageIds.length
      ) {
        return errorResponse(
          "Provide a valid list of image IDs.",
          422,
        );
      }

      body = JSON.stringify({ image_ids: imageIds });

      headers = {
        "Content-Type": "application/json",
      };
    }

    const upstream = await laravelRequest(
      target.path,
      token,
      {
        method,
        ...(body !== undefined ? { body } : {}),
        ...(headers ? { headers } : {}),
      },
    );

    const contentType =
      upstream.headers.get("content-type") || "";

    if (!upstream.ok) {
      if (contentType.includes("application/json")) {
        const result: unknown = await upstream.json();

        return NextResponse.json(result, {
          status: upstream.status,
          headers: {
            "Cache-Control": "private, no-store",
          },
        });
      }

      return errorResponse(
        "Image operation was rejected by Laravel.",
        upstream.status,
      );
    }

    if (target.image) {
      const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/avif",
      ]);

      const mediaType = contentType
        .split(";")[0]
        .trim()
        .toLowerCase();

      if (!allowedTypes.has(mediaType) || !upstream.body) {
        return errorResponse(
          "Unexpected image response from Laravel.",
          502,
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": mediaType,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!contentType.includes("application/json")) {
      return errorResponse(
        "Unexpected response from Laravel.",
        502,
      );
    }

    const result: unknown = await upstream.json();

    return NextResponse.json(result, {
      status: upstream.status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return errorResponse(
      "Unable to connect to the Laravel image service.",
      503,
    );
  }
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context, "POST");
}

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context, "DELETE");
}
