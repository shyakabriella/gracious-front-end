import { NextRequest, NextResponse } from "next/server";
import { apiUrl } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");

  if (
    (origin && origin !== request.nextUrl.origin) ||
    (site && !["same-origin", "none"].includes(site))
  ) {
    return NextResponse.json(
      { message: "Request origin rejected." },
      { status: 403 },
    );
  }

  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return NextResponse.json(
      { message: "JSON required." },
      { status: 415 },
    );
  }

  try {
    const body = await request.text();

    if (body.length > 12000) {
      return NextResponse.json(
        { message: "Request too large." },
        { status: 413 },
      );
    }

    const data: unknown = JSON.parse(body);

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json(
        { message: "Invalid request." },
        { status: 400 },
      );
    }

    const upstream = await fetch(apiUrl("/staff/invitations/accept"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    if (!(upstream.headers.get("content-type") || "").includes("application/json")) {
      return NextResponse.json(
        { message: "Unexpected backend response." },
        { status: 502 },
      );
    }

    const result: unknown = await upstream.json();

    return NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to process the invitation." },
      { status: 503 },
    );
  }
}
