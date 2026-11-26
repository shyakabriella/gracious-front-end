import { NextRequest, NextResponse } from "next/server";
import { apiUrl } from "@/lib/auth/server";


type Context = {
  params: Promise<{ id: string }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: NextRequest, { params }: Context) {
  const { id } = await params;

  if (!/^[1-9]\d{0,17}$/.test(id)) {
    return fail("Invalid property submission.", 404);
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const site = request.headers.get("sec-fetch-site");

  let allowed = !origin;

  if (origin && host) {
    try {
      const parsed = new URL(origin);
      allowed =
        parsed.origin === origin &&
        parsed.host.toLowerCase() === host.toLowerCase() &&
        parsed.protocol === request.nextUrl.protocol;
    } catch {
      allowed = false;
    }
  }

  if (
    !allowed ||
    (site && !["same-origin", "none"].includes(site))
  ) {
    return fail("Request origin rejected.", 403);
  }

  const token = request.headers.get("X-Submission-Upload-Token");

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return fail("Upload authorization required.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (
    !contentType.toLowerCase().startsWith("multipart/form-data;") ||
    !/boundary=/i.test(contentType)
  ) {
    return fail("Multipart upload required.", 415);
  }

  const length = request.headers.get("content-length");

  if (length !== null) {
    const bytes = Number(length);

    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > 105 * 1024 * 1024
    ) {
      return fail("Upload size exceeded.", 413);
    }
  }

  if (!request.body) {
    return fail("No upload body provided.", 400);
  }

  try {
    let totalBytes = 0;

    const boundedBody = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          totalBytes += chunk.byteLength;

          if (totalBytes > 105 * 1024 * 1024) {
            throw new Error("Upload body exceeds the limit.");
          }

          controller.enqueue(chunk);
        },
      }),
    );

    const response = await fetch(
      apiUrl(`/public/property-submissions/${id}/media`),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": contentType,
          "X-Submission-Upload-Token": token,
        },
        body: boundedBody,
        duplex: "half",
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(120000),
      } as RequestInit & { duplex: "half" },
    );

    const data: unknown = await response.json().catch(() => null);

    if (!record(data)) {
      return fail(
        "Upload result uncertain. Contact Gracious before retrying.",
        502,
      );
    }

    if (response.status === 201) {
      if (
        !record(data.media) ||
        !Number.isSafeInteger(data.media.id)
      ) {
        return fail(
          "File may have been received. Contact Gracious before retrying.",
          502,
        );
      }

      return NextResponse.json(
        {
          message: "File received for private review.",
          media: {
            id: data.media.id,
            kind: data.media.kind,
            review_status: "pending",
          },
        },
        {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const status =
      response.status >= 400 && response.status <= 599
        ? response.status
        : 502;

    const result = NextResponse.json(
      {
        message:
          typeof data.message === "string"
            ? data.message
            : "File upload was not accepted.",
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );

    if (status === 429) {
      const retryAfter = response.headers.get("retry-after");

      if (retryAfter && /^\d+$/.test(retryAfter)) {
        result.headers.set("Retry-After", retryAfter);
      }
    }

    return result;
  } catch {
    return fail(
      "Upload result uncertain. Save your submission reference and contact Gracious before retrying.",
      502,
    );
  }
}
