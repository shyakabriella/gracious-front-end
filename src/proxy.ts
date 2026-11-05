import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "gracious_session";

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  // Fast check only. A cookie is not proof of valid authentication.
  // The dashboard layout still verifies the session with Laravel.
  if (!session) {
    const loginUrl = new URL("/login", request.url);

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
