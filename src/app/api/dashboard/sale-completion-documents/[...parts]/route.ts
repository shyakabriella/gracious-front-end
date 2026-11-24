import { NextRequest, NextResponse } from "next/server";
import {
  getAuthToken,
  laravelRequest,
} from "@/lib/auth/server";

type Context = {
  params: Promise<{ parts: string[] }>;
};

type Method = "GET" | "POST";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const DOCUMENT_TYPES = new Set([
  "signed_agreement",
  "ownership_transfer",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function validId(value: string | undefined): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function endpointFor(
  parts: string[],
  method: Method,
): { path: string; download: boolean } | null {
  if (!validId(parts[0])) return null;

  if (method === "POST" && parts.length === 1) {
    return {
      path: `/sales/${parts[0]}/completion-documents`,
      download: false,
    };
  }

  if (
    method === "GET" &&
    parts.length === 3 &&
    validId(parts[1]) &&
    parts[2] === "download"
  ) {
    return {
      path:
        `/sales/${parts[0]}/completion-documents/` +
        `${parts[1]}/download`,
      download: true,
    };
  }

  return null;
}

function originAllowed(request: NextRequest) {
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
    return jsonError("Unsupported completion document operation.", 404);
  }

  if (method === "POST" && !originAllowed(request)) {
    return jsonError("Request origin rejected.", 403);
  }

  const token = await getAuthToken();

  if (!token) {
    return jsonError("Please sign in again.", 401);
  }

  try {
    let body: FormData | undefined;

    if (method === "POST") {
      const contentType = request.headers.get("content-type") || "";

      if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
        return jsonError("Multipart form data required.", 415);
      }

      const declaredLength = request.headers.get("content-length");

      if (declaredLength !== null) {
        const length = Number(declaredLength);

        if (!Number.isFinite(length) || length < 0) {
          return jsonError("Invalid upload request size.", 400);
        }

        if (length > MAX_REQUEST_BYTES) {
          return jsonError("Upload request is too large.", 413);
        }
      }

      let incoming: FormData;

      try {
        incoming = await request.formData();
      } catch {
        return jsonError("Invalid uploaded form data.", 400);
      }

      const file = incoming.get("file");
      const documentType = incoming.get("document_type");

      if (
        typeof documentType !== "string" ||
        !DOCUMENT_TYPES.has(documentType)
      ) {
        return jsonError("Invalid legal document type.", 422);
      }

      if (!(file instanceof File) || file.size === 0) {
        return jsonError("Select a valid legal document.", 422);
      }

      if (file.size > MAX_FILE_BYTES) {
        return jsonError("Maximum legal document size is 10 MB.", 413);
      }

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (!extension || !EXTENSIONS.has(extension)) {
        return jsonError(
          "Only PDF, JPG, JPEG and PNG documents are supported.",
          422,
        );
      }

      // Laravel validates actual file contents, sale status and permissions.
      body = new FormData();
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

    const responseType = upstream.headers.get("content-type") || "";

    if (!upstream.ok) {
      if (responseType.includes("application/json")) {
        const value: unknown = await upstream.json();

        return NextResponse.json(value, {
          status: upstream.status,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return jsonError(
        "Completion document operation rejected by Laravel.",
        upstream.status,
      );
    }

    if (target.download) {
      if (!upstream.body) {
        return jsonError("Document download unavailable.", 502);
      }

      const headers = new Headers();

      headers.set(
        "Content-Type",
        responseType || "application/octet-stream",
      );

      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");

      const disposition = upstream.headers.get("content-disposition");

      headers.set(
        "Content-Disposition",
        disposition ||
          'attachment; filename="sale-completion-document"',
      );

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    if (!responseType.includes("application/json")) {
      return jsonError("Unexpected Laravel response.", 502);
    }

    const result: unknown = await upstream.json();

    return NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return jsonError("Cannot connect to the Laravel server.", 503);
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
