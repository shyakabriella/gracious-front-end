import { NextRequest, NextResponse } from "next/server";
import { getAuthToken, laravelRequest } from "@/lib/auth/server";

type Context = {
  params: Promise<{ id: string; evidenceId: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  const { id, evidenceId } = await context.params;

  if (
    !/^[1-9]\d*$/.test(id) ||
    !/^[1-9]\d*$/.test(evidenceId)
  ) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const upstream = await laravelRequest(
      `/property-submissions/${id}/evidence/${evidenceId}/download`,
      token
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { message: "Document unavailable or access denied." },
        { status: upstream.status }
      );
    }

    const mime = (upstream.headers.get("content-type") || "")
      .split(";")[0].trim().toLowerCase();

    if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
      return NextResponse.json(
        { message: "Unsupported document format." },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to open document." },
      { status: 503 }
    );
  }
}
