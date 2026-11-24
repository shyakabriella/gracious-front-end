import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/auth/server";

type Category = {
  id: number;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const response = await fetch(apiUrl("/public/property-categories"), {
      cache: "no-store",
      redirect: "manual",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok || !isRecord(data) || !Array.isArray(data.data)) {
      return NextResponse.json(
        { message: "Property categories are currently unavailable." },
        { status: 503 },
      );
    }

    const categories: Category[] = data.data
      .filter((item: unknown): item is Record<string, unknown> =>
        isRecord(item),
      )
      .filter(
        (item) =>
          Number.isSafeInteger(item.id) &&
          Number(item.id) > 0 &&
          typeof item.name === "string" &&
          item.name.length > 0,
      )
      .map((item) => ({
        id: Number(item.id),
        name: String(item.name),
      }))
      .slice(0, 200);

    return NextResponse.json(
      { data: categories },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { message: "Unable to load property categories." },
      { status: 503 },
    );
  }
}
