import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gracious_session";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export function apiUrl(path: string): string {
  const base =
    process.env.GRACIOUS_API_URL ||
    "http://127.0.0.1:8000/api";

  return `${base.replace(/\/$/, "")}${path}`;
}

export async function getAuthToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function laravelRequest(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const token = await getAuthToken();

  if (!token) return null;

  try {
    const response = await laravelRequest("/me", token);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      user?: AuthUser;
    };

    return data.user ?? null;
  } catch {
    return null;
  }
}
