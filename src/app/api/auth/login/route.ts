import { NextRequest, NextResponse } from "next/server";
import {
  apiUrl,
  SESSION_COOKIE,
  type AuthUser,
} from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request." },
      { status: 400 },
    );
  }

  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 422 },
    );
  }

  try {
    const upstream = await fetch(apiUrl("/login"), {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        {
          message:
            result.message ||
            result.errors?.email?.[0] ||
            "Login failed.",
        },
        { status: upstream.status },
      );
    }

    const token: unknown = result.token;
    const user: AuthUser | undefined = result.user;

    if (typeof token !== "string" || !user) {
      return NextResponse.json(
        { message: "Invalid authentication response." },
        { status: 502 },
      );
    }

    // Allow active staff and customers to authenticate.
    // Laravel remains responsible for endpoint authorization.
    const staffRoles = [
      "super_admin",
      "admin",
      "agent",
      "property_manager",
      "accountant",
    ];

    const allowed =
      user.status === "active" &&
      (
        user.roles.some((role) => staffRoles.includes(role)) ||
        user.roles.includes("customer") ||
        user.permissions.includes("users.view") ||
        user.permissions.includes("properties.view")
      );

    if (!allowed) {
      // Revoke the new token instead of leaving it active.
      await fetch(apiUrl("/logout"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => undefined);

      return NextResponse.json(
        { message: "This dashboard is restricted to authorized staff." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      message: "Login successful",
      user,
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the authentication server." },
      { status: 503 },
    );
  }
}
