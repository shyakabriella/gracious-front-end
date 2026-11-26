import { NextRequest, NextResponse } from "next/server";
import { apiUrl, getAuthToken } from "@/lib/auth/server";

type Context = {
  params: Promise<{ id: string }>;
};

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

function fail(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function POST(
  request: NextRequest,
  context: Context
) {
  const { id } = await context.params;

  if (!/^[1-9]\d{0,17}$/.test(id)) {
    return fail("Invalid submission ID.", 404);
  }

  // Exact public origins only. Never trust forwarded
  // host headers for authorization.
  const allowedOrigins = new Set([
    "https://www.graciousinvestiment.com",
    "https://graciousinvestiment.com",
  ]);

  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");

  if (
    !origin ||
    !allowedOrigins.has(origin) ||
    (site && !["same-origin", "none"].includes(site))
  ) {
    return fail("Request origin rejected.", 403);
  }

  const token = await getAuthToken();

  if (!token) {
    return fail("Please sign in again.", 401);
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType.toLowerCase().startsWith(
      "multipart/form-data;"
    ) ||
    !/boundary=/i.test(contentType)
  ) {
    return fail("Multipart upload required.", 415);
  }

  const length = request.headers.get("content-length");

  if (length !== null) {
    const bytes = Number(length);

    if (
      !Number.isSafeInteger(bytes) ||
      bytes <= 0 ||
      bytes > MAX_REQUEST_BYTES
    ) {
      return fail("Upload exceeds the permitted size.", 413);
    }
  }

  if (!request.body) {
    return fail("Upload file missing.", 400);
  }

  try {
    let received = 0;

    const body = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;

          if (received > MAX_REQUEST_BYTES) {
            throw new Error("Upload size exceeded.");
          }

          controller.enqueue(chunk);
        },
      })
    );

    const upstream = await fetch(
      apiUrl(`/property-submissions/${id}/evidence`),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
        },
        body,
        duplex: "half",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      } as RequestInit & { duplex: "half" }
    );

    const result: unknown =
      await upstream.json().catch(() => null);

    if (!isRecord(result)) {
      return fail(
        "Upload result uncertain. Check the evidence list before retrying.",
        502
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(result, {
        status:
          upstream.status >= 400 &&
          upstream.status <= 599
            ? upstream.status
            : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (
      upstream.status !== 201 ||
      !isRecord(result.evidence) ||
      typeof result.evidence.reference !== "string"
    ) {
      return fail(
        "Upload result uncertain. Check the evidence list before retrying.",
        502
      );
    }

    return NextResponse.json(
      {
        message: "Private ownership evidence uploaded.",
        evidence: {
          reference: result.evidence.reference,
          title: result.evidence.title,
          document_type: result.evidence.document_type,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return fail(
      "Upload result uncertain. Refresh the evidence list before retrying.",
      502
    );
  }
}
