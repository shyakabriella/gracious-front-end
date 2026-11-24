import { NextRequest, NextResponse } from "next/server";
import { apiUrl } from "@/lib/auth/server";


type RouteContext = {
  params: Promise<{ slug: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  // Reject browser requests from other origins.
  // Do not weaken this check for cross-site submissions.
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const host = request.headers.get("host");

  // Match the actual incoming hostname, not Next.js's
  // internally normalized URL hostname.
  // This supports localhost and 127.0.0.1 independently.
  let originAllowed = !origin;

  if (origin && host) {
    try {
      const parsed = new URL(origin);

      originAllowed =
        parsed.origin === origin &&
        parsed.host.toLowerCase() === host.toLowerCase() &&
        parsed.protocol === request.nextUrl.protocol;
    } catch {
      originAllowed = false;
    }
  }

  if (
    !originAllowed ||
    (site && !["same-origin", "none"].includes(site))
  ) {
    return errorResponse("Request origin rejected.", 403);
  }

  const { slug } = await params;

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/.test(slug)
  ) {
    return errorResponse("Property not found.", 404);
  }

  const contentType =
    request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.startsWith("application/json")) {
    return errorResponse("JSON request required.", 415);
  }

  const declaredLength = Number(
    request.headers.get("content-length") || "0",
  );

  if (
    !Number.isFinite(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > 16384
  ) {
    return errorResponse("Inquiry request is too large.", 413);
  }

  let input: unknown;

  try {
    const body = await request.text();

    if (new TextEncoder().encode(body).byteLength > 16384) {
      return errorResponse("Inquiry request is too large.", 413);
    }

    input = JSON.parse(body);
  } catch {
    return errorResponse("Invalid JSON request.", 400);
  }

  if (!isRecord(input)) {
    return errorResponse("Invalid inquiry information.", 422);
  }

  const name =
    typeof input.name === "string" ? input.name.trim() : "";

  const phone =
    typeof input.phone === "string" ? input.phone.trim() : "";

  const email =
    typeof input.email === "string" ? input.email.trim() : "";

  const message =
    typeof input.message === "string"
      ? input.message.trim()
      : "";

  if (
    !name ||
    name.length > 255 ||
    phone.length > 30 ||
    email.length > 255 ||
    !message ||
    message.length > 5000 ||
    (!phone && !email)
  ) {
    return errorResponse(
      "Provide your name, phone or email, and a message.",
      422,
    );
  }

  // Explicit allowlist: never forward client-supplied CRM fields.
  // Laravel alone determines property, customer type, lead status,
  // source, priority and agent assignment.
  const payload = {
    name,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    message,
  };

  try {
    const upstream = await fetch(
      apiUrl(
        `/public/properties/${encodeURIComponent(slug)}/inquiries`,
      ),
      {
        method: "POST",
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const raw: unknown = await upstream
      .json()
      .catch(() => null);

    if (!isRecord(raw)) {
      return errorResponse(
        "Unable to confirm the inquiry response. Please contact our team before trying again.",
        502,
      );
    }

    if (upstream.status === 201) {
      if (
        typeof raw.inquiry_reference !== "string" ||
        !raw.inquiry_reference
      ) {
        return errorResponse(
          "The inquiry may have been received. Contact our team before resubmitting.",
          502,
        );
      }

      return NextResponse.json(
        {
          message:
            typeof raw.message === "string"
              ? raw.message
              : "Your inquiry has been received.",
          inquiry_reference: raw.inquiry_reference,
        },
        { status: 201 },
      );
    }

    if (upstream.ok) {
      return errorResponse(
        "Unexpected inquiry response. Please contact our team before retrying.",
        502,
      );
    }

    const status =
      upstream.status >= 400 && upstream.status <= 599
        ? upstream.status
        : 502;

    const result = NextResponse.json(
      {
        message:
          typeof raw.message === "string"
            ? raw.message
            : status === 429
              ? "Too many inquiries. Please try again later."
              : "Unable to submit your inquiry.",
        ...(status === 422 && isRecord(raw.errors)
          ? { errors: raw.errors }
          : {}),
      },
      { status },
    );

    if (status === 429) {
      const retryAfter = upstream.headers.get("retry-after");

      if (retryAfter) {
        result.headers.set("Retry-After", retryAfter);
      }
    }

    return result;
  } catch {
    return errorResponse(
      "The inquiry service is temporarily unavailable. Please contact our team before trying again.",
      502,
    );
  }
}
