import { NextResponse } from "next/server";
import {
  getAuthToken,
  laravelRequest,
  SESSION_COOKIE,
} from "@/lib/auth/server";

export async function POST() {
  const token = await getAuthToken();

  if (token) {
    try {
      await laravelRequest("/logout", token, {
        method: "POST",
      });
    } catch {
      // The local cookie is cleared even if Laravel is unreachable.
    }
  }

  const response = NextResponse.json({
    message: "Local session cleared.",
  });

  response.cookies.delete(SESSION_COOKIE);

  return response;
}
