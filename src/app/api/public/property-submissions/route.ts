import { NextRequest, NextResponse } from "next/server";
import { apiUrl } from "@/lib/auth/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

const allowedFields = new Set([
  "submitter_name",
  "submitter_phone",
  "submitter_email",
  "submitter_role",
  "owner_name",
  "owner_phone",
  "submission_purpose",
  "property_title",
  "property_description",
  "category_id",
  "asking_price",
  "currency",
  "is_negotiable",
  "province",
  "district",
  "sector",
  "cell",
  "village",
  "address",
  "latitude",
  "longitude",
  "land_size_sqm",
  "building_size_sqm",
  "bedrooms",
  "bathrooms",
  "parking_spaces",
  "floors",
  "is_furnished",
  "terms_accepted",
  "authorization_confirmed",
]);

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const site = request.headers.get("sec-fetch-site");

  let validOrigin = !origin;

  if (origin && host) {
    try {
      const parsed = new URL(origin);

      validOrigin =
        parsed.origin === origin &&
        parsed.host.toLowerCase() === host.toLowerCase() &&
        parsed.protocol === request.nextUrl.protocol;
    } catch {
      validOrigin = false;
    }
  }

  if (
    !validOrigin ||
    (site && !["same-origin", "none"].includes(site))
  ) {
    return error("Request origin rejected.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return error("JSON request required.", 415);
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    !Number.isFinite(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > 32768
  ) {
    return error("Submission request is too large.", 413);
  }

  let input: unknown;

  try {
    const body = await request.text();

    if (new TextEncoder().encode(body).byteLength > 32768) {
      return error("Submission request is too large.", 413);
    }

    input = JSON.parse(body);
  } catch {
    return error("Invalid JSON request.", 400);
  }

  if (!isRecord(input)) {
    return error("Invalid submission information.", 422);
  }

  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    return error("Unsupported submission field.", 422);
  }

  const payload: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return error("Invalid submission field type.", 422);
    }

    if (typeof value === "string") {
      if (value.trim() !== "") {
        payload[key] = value.trim();
      }
    } else {
      payload[key] = value;
    }
  }

  try {
    const upstream = await fetch(
      apiUrl("/public/property-submissions"),
      {
        method: "POST",
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      },
    );

    const result: unknown = await upstream.json().catch(() => null);

    if (!isRecord(result)) {
      return error(
        "The submission result could not be confirmed. Contact Gracious Investment before submitting again.",
        502,
      );
    }

    if (upstream.status === 201) {
      if (
        typeof result.submission_reference !== "string" ||
        !result.submission_reference
      ) {
        return error(
          "The submission may have been received. Contact Gracious Investment before trying again.",
          502,
        );
      }

      return NextResponse.json(
        {
          message:
            typeof result.message === "string"
              ? result.message
              : "Your property submission was received.",
            submission_reference: result.submission_reference,
            status: "pending_review",
            ...(Number.isSafeInteger(result.submission_id) &&
              Number(result.submission_id) > 0 &&
              typeof result.upload_token === "string" &&
              /^[a-f0-9]{64}$/.test(result.upload_token)
              ? {
                  submission_id: Number(result.submission_id),
                  upload_token: result.upload_token,
                }
              : { upload_unavailable: true }),
        },
        { status: 201 },
      );
    }

    const status =
      upstream.status >= 400 && upstream.status <= 599
        ? upstream.status
        : 502;

    const errors: Record<string, string[]> = {};

    if (status === 422 && isRecord(result.errors)) {
      for (const [key, value] of Object.entries(result.errors)) {
        if (!allowedFields.has(key) || !Array.isArray(value)) continue;

        errors[key] = value
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, 3);
      }
    }

    const response = NextResponse.json(
      {
        message:
          typeof result.message === "string"
            ? result.message
            : status === 429
              ? "Too many submissions. Please try again later."
              : "Unable to submit your property.",
        ...(status === 422 ? { errors } : {}),
      },
      { status },
    );

    if (status === 429) {
      const retryAfter = upstream.headers.get("retry-after");

      if (retryAfter && /^\d+$/.test(retryAfter)) {
        response.headers.set("Retry-After", retryAfter);
      }
    }

    return response;
  } catch {
    return error(
      "We could not confirm whether your submission was received. Please contact Gracious Investment before trying again.",
      502,
    );
  }
}
