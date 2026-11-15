import { NextRequest, NextResponse } from "next/server";
import {
  getAuthToken,
  laravelRequest,
} from "@/lib/auth/server";

type Context = {
  params: Promise<{ parts: string[] }>;
};

type Method = "GET" | "POST" | "DELETE";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

function endpointFor(
  parts: string[],
  method: Method,
): { path: string; download: boolean } | null {
  if (
    parts.length < 1 ||
    !/^[1-9]\d*$/.test(parts[0])
  ) {
    return null;
  }

  const propertyId = parts[0];

  if (
    parts.length === 1 &&
    (method === "GET" || method === "POST")
  ) {
    return {
      path: `/properties/${propertyId}/documents`,
      download: false,
    };
  }

  if (
    parts.length >= 2 &&
    !/^[1-9]\d*$/.test(parts[1])
  ) {
    return null;
  }

  if (
    parts.length === 2 &&
    method === "DELETE"
  ) {
    return {
      path: `/properties/${propertyId}/documents/${parts[1]}`,
      download: false,
    };
  }

  if (
    parts.length === 3 &&
    parts[2] === "download" &&
    method === "GET"
  ) {
    return {
      path: `/properties/${propertyId}/documents/${parts[1]}/download`,
      download: true,
    };
  }

  return null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");

  return (
    (!origin || origin === request.nextUrl.origin) &&
    (!site || ["same-origin", "none"].includes(site))
  );
}

async function handle(
  request: NextRequest,
  context: Context,
  method: Method,
): Promise<Response> {
  const { parts } = await context.params;
  const target = endpointFor(parts, method);

  if (!target) {
    return jsonError("Unsupported document operation.", 404);
  }

  if (method !== "GET" && !originAllowed(request)) {
    return jsonError("Request origin rejected.", 403);
  }

  const token = await getAuthToken();

  if (!token) {
    return jsonError("Please sign in again.", 401);
  }

  try {
    let body: FormData | undefined;

    if (method === "POST") {
      const contentType =
        request.headers.get("content-type") || "";

      if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
        return jsonError("Multipart form data required.", 415);
      }

      const contentLength = Number(
        request.headers.get("content-length") || "0",
      );

      if (
        !Number.isFinite(contentLength) ||
        contentLength < 0 ||
        contentLength > MAX_REQUEST_BYTES
      ) {
        return jsonError("Upload request is too large.", 413);
      }

      let incoming: FormData;

      try {
        incoming = await request.formData();
      } catch {
        return jsonError("Invalid uploaded form data.", 400);
      }

      const title = incoming.get("title");
      const documentType = incoming.get("document_type");
      const file = incoming.get("file");

      if (
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.length > 255
      ) {
        return jsonError("A valid document title is required.", 422);
      }

      const allowedTypes = [
        "ownership",
        "authorization",
        "inspection",
        "agreement",
        "other",
      ];

      if (
        typeof documentType !== "string" ||
        !allowedTypes.includes(documentType)
      ) {
        return jsonError("Invalid document type.", 422);
      }

      if (!(file instanceof File) || file.size === 0) {
        return jsonError("Select a valid document file.", 422);
      }

      if (file.size > MAX_FILE_BYTES) {
        return jsonError("Maximum document size is 10 MB.", 413);
      }

      const extension = file.name
        .split(".")
        .pop()
        ?.toLowerCase();

      if (
        !extension ||
        !["pdf", "jpg", "jpeg", "png"].includes(extension)
      ) {
        return jsonError(
          "Only PDF, JPG, JPEG and PNG files are supported.",
          422,
        );
      }

      // Laravel performs the authoritative MIME and file validation.
      body = new FormData();
      body.append("title", title.trim());
      body.append("document_type", documentType);
      body.append("file", file, file.name);
    }

    const upstream = await laravelRequest(
      target.path,
      token,
      {
        method,
        ...(body ? { body } : {}),
      },
    );

    const responseType =
      upstream.headers.get("content-type") || "";

    // All Laravel errors should remain JSON responses.
    if (!upstream.ok) {
      if (responseType.includes("application/json")) {
        const error: unknown = await upstream.json();

        return NextResponse.json(error, {
          status: upstream.status,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return jsonError(
        "Document operation was rejected by Laravel.",
        upstream.status,
      );
    }

    // Stream private downloads without exposing the Laravel token.
    if (target.download) {
      if (!upstream.body) {
        return jsonError("Document download is unavailable.", 502);
      }

      const headers = new Headers();

      headers.set(
        "Content-Type",
        responseType || "application/octet-stream",
      );

      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");

      const disposition =
        upstream.headers.get("content-disposition");

      if (disposition) {
        headers.set("Content-Disposition", disposition);
      } else {
        headers.set(
          "Content-Disposition",
          "attachment; filename=\"property-document\"",
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    if (!responseType.includes("application/json")) {
      return jsonError(
        "Unexpected document response from Laravel.",
        502,
      );
    }

    const result: unknown = await upstream.json();

    return NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return jsonError(
      "Unable to connect to the Laravel document service.",
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

export async function DELETE(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context, "DELETE");
}
