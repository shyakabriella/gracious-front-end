import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "gracious_session";

export async function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  // Fast check only. A cookie is not proof of valid authentication.
  // The dashboard layout still verifies the session with Laravel.
  if (!session) {
    const loginUrl = new URL("/login", request.url);

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  // Customer accounts may access only the customer dashboard.
  // Verify roles with Laravel instead of trusting browser data.
  if (request.nextUrl.pathname.startsWith("/dashboard/")) {
    const apiBase =
      process.env.GRACIOUS_API_URL ||
      "http://127.0.0.1:8000/api";

    let profileResponse: Response;

    try {
      profileResponse = await fetch(
        `${apiBase.replace(/\/$/, "")}/me`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session}`,
          },
        },
      );
    } catch {
      return NextResponse.json(
        { message: "Authentication service unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!profileResponse.ok) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    let profile: {
      user?: {
        status?: string;
        roles?: string[];
      };
    };

    try {
      profile = await profileResponse.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid authentication response." },
        { status: 502 },
      );
    }

    const user = profile.user;

    if (
      !user ||
      user.status !== "active" ||
      !Array.isArray(user.roles)
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (user.roles.includes("customer")) {
      return NextResponse.redirect(
        new URL("/dashboard", request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
