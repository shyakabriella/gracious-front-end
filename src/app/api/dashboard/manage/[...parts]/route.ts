import { NextRequest, NextResponse } from "next/server";
import {
  getAuthToken,
  laravelRequest,
  SESSION_COOKIE,
} from "@/lib/auth/server";

type Context = {
  params: Promise<{ parts: string[] }>;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function resolveEndpoint(
  method: Method,
  parts: string[],
): string | null {
  if (
    method === "POST" &&
    parts.length === 1 &&
    parts[0] === "invitations"
  ) {
    return "/staff/invitations";
  }

  if (
    method === "POST" &&
    parts.length === 4 &&
    parts[0] === "users" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "invitation" &&
    parts[3] === "resend"
  ) {
    return `/staff/${parts[1]}/invitation/resend`;
  }

  // Property Owners: listing and registration.
  // Laravel enforces owners.view and owners.create.
  if (
    parts.length === 1 &&
    parts[0] === "owners" &&
    (method === "GET" || method === "POST")
  ) {
    return "/owners";
  }

  // Property Owners: details, editing and archiving.
  // Laravel enforces owner permissions and creator isolation.
  if (
    parts.length === 2 &&
    parts[0] === "owners" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    ["GET", "PUT", "DELETE"].includes(method)
  ) {
    return `/owners/${parts[1]}`;
  }

  // Property Owners: linked property records.
  // Laravel also requires properties.view.
  if (
    parts.length === 3 &&
    parts[0] === "owners" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "properties" &&
    method === "GET"
  ) {
    return `/owners/${parts[1]}/properties`;
  }

  // Property Ownership: view and attach owners.
  // Laravel enforces properties.view / properties.update,
  // owners.view, and record-level authorization.
  if (
    parts.length === 3 &&
    parts[0] === "properties" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "owners" &&
    ["GET", "POST"].includes(method)
  ) {
    return `/properties/${parts[1]}/owners`;
  }

  // Property Ownership: remove an owner-property relationship.
  // This does not archive or delete the owner.
  if (
    method === "DELETE" &&
    parts.length === 4 &&
    parts[0] === "properties" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "owners" &&
    /^[1-9]\d*$/.test(parts[3])
  ) {
    return `/properties/${parts[1]}/owners/${parts[3]}`;
  }

  // Property Viewings: schedule appointment.
  // Laravel validates lead ownership, matching property, time and overlaps.
  if (
    method === "POST" &&
    parts.length === 1 &&
    parts[0] === "viewings"
  ) {
    return "/viewings";
  }

  // Property Viewings: seven dashboard operations.
  // Laravel enforces agent ownership and workflow transitions.
  if (
    parts.length === 1 &&
    parts[0] === "viewings" &&
    method === "GET"
  ) {
    return "/viewings";
  }

  if (
    parts.length === 2 &&
    parts[0] === "viewings" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    method === "GET"
  ) {
    return `/viewings/${parts[1]}`;
  }

  if (
    parts.length === 3 &&
    parts[0] === "viewings" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    if (method === "GET" && parts[2] === "history") {
      return `/viewings/${parts[1]}/history`;
    }

    if (
      method === "PATCH" &&
      ["confirm", "cancel", "complete", "no-show"].includes(parts[2])
    ) {
      return `/viewings/${parts[1]}/${parts[2]}`;
    }
  }

  // Sales legal completion documents, final completion and audit history.
  // Laravel owns permissions, payment reconciliation and status changes.
  if (
    parts.length === 3 &&
    parts[0] === "sales" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    if (
      method === "GET" &&
      ["completion-documents", "history"].includes(parts[2])
    ) {
      return `/sales/${parts[1]}/${parts[2]}`;
    }

    if (method === "PATCH" && parts[2] === "complete") {
      return `/sales/${parts[1]}/complete`;
    }
  }

  // Sales payment evidence listing and payment reviews.
  // Laravel enforces ownership, role checks and payment state.
  if (
    parts.length === 5 &&
    parts[0] === "sales" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments" &&
    /^[1-9]\d*$/.test(parts[3])
  ) {
    if (method === "GET" && parts[4] === "evidences") {
      return `/sales/${parts[1]}/payments/${parts[3]}/evidences`;
    }

    if (
      method === "PATCH" &&
      ["verify", "reject"].includes(parts[4])
    ) {
      return `/sales/${parts[1]}/payments/${parts[3]}/${parts[4]}`;
    }
  }

  // Sales payment listing and recording.
  // Laravel validates amounts, sale status and user permissions.
  if (
    (method === "GET" || method === "POST") &&
    parts.length === 3 &&
    parts[0] === "sales" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments"
  ) {
    return `/sales/${parts[1]}/payments`;
  }

  // Sales agreement and cancellation status transitions.
  // Laravel remains responsible for authorization and validation.
  if (
    method === "PATCH" &&
    parts.length === 3 &&
    parts[0] === "sales" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    ["agreement", "pending-completion", "cancel"].includes(parts[2])
  ) {
    return `/sales/${parts[1]}/${parts[2]}`;
  }

  // Property Sales: list and create transactions.
  // Laravel enforces role-based authorization and sales rules.
  if (
    parts.length === 1 &&
    parts[0] === "sales" &&
    ["GET", "POST"].includes(method)
  ) {
    return "/sales";
  }

  // Property Sales: view a specific transaction.
  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "sales" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    return `/sales/${parts[1]}`;
  }

  // Rental lifecycle: status changes and audit history.
  // Laravel enforces rentals.update, authorized roles,
  // valid transitions and financial adjustment rules.
  if (
    parts.length === 3 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    if (method === "GET" && parts[2] === "history") {
      return `/rentals/${parts[1]}/history`;
    }

    if (
      method === "PATCH" &&
      ["activate", "cancel", "terminate", "expire"].includes(parts[2])
    ) {
      return `/rentals/${parts[1]}/${parts[2]}`;
    }
  }

  // Rental draft creation and editing.
  // Laravel enforces roles, permissions, property eligibility,
  // rental date overlaps and draft-only update rules.
  if (
    method === "POST" &&
    parts.length === 1 &&
    parts[0] === "rentals"
  ) {
    return "/rentals";
  }

  if (
    method === "PATCH" &&
    parts.length === 2 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    return `/rentals/${parts[1]}`;
  }

  // Rental Management: list rental agreements.
  // Laravel enforces rentals.view and role-based access.
  if (
    method === "GET" &&
    parts.length === 1 &&
    parts[0] === "rentals"
  ) {
    return "/rentals";
  }

  // Rental Management: view one rental agreement.
  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    return `/rentals/${parts[1]}`;
  }

  // Rent Statements: adjusted balances and schedule periods.
  // The Laravel statement service owns all financial calculations.
  if (
    method === "GET" &&
    parts.length === 3 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "statement"
  ) {
    return `/rentals/${parts[1]}/statement`;
  }

  // Independent refund reconciliation.
  // Laravel validates an independent authorized reviewer,
  // external-record attestation, evidence integrity,
  // matching recipient, amount, currency and transaction.
  // Only Laravel may set the final paid or failed status.
  if (
    method === "POST" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "reconcile"
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/reconcile`;
  }

  // Refund evidence history: metadata only.
  // Uploads and downloads use the separate private evidence proxy.
  // Laravel enforces access to the rental and its refund.
  if (
    method === "GET" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "evidences"
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/evidences`;
  }

  // Refund processing.
  // Laravel checks approved refund and destination,
  // authorized independent processor, transfer method,
  // and unique transaction reference.
  // Processing does not establish that money was paid.
  if (
    method === "PATCH" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "process"
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/process`;
  }

  // Refund destination recording and independent approval.
  // Laravel validates refund status, roles and independence.
  if (
    method === "POST" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "destination"
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/destination`;
  }

  if (
    method === "PATCH" &&
    parts.length === 6 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "destination" &&
    parts[5] === "approve"
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/destination/approve`;
  }

  // Refund approval and rejection actions.
  // Laravel enforces administrator permissions, status
  // transitions, and independence from the requester.
  if (
    method === "PATCH" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    ["approve", "reject"].includes(parts[4])
  ) {
    return `/rentals/${parts[1]}/refunds/${parts[3]}/${parts[4]}`;
  }

  // Rental refunds: list requests and available refundable balance.
  // Laravel computes available credit and checks rental access.
  if (
    method === "GET" &&
    parts.length === 3 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds"
  ) {
    return `/rentals/${parts[1]}/refunds`;
  }

  // Rental refunds: request a pending refund only.
  // Laravel checks verified source payments, rental status,
  // permissions, and reserved refundable balance.
  if (
    method === "POST" &&
    parts.length === 3 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "refunds"
  ) {
    return `/rentals/${parts[1]}/refunds`;
  }

  // Central payments dashboard: read-only.
  // Laravel enforces rental and sales permissions independently.
  // No payment creation, approval or refund actions are exposed.
  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "dashboard" &&
    parts[1] === "payments"
  ) {
    return "/dashboard/payments";
  }

  // Rental payments: list and record payments.
  // Recording creates pending payments only.
  // Laravel enforces rental-level permissions and adjusted balances.
  if (
    parts.length === 3 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments" &&
    (method === "GET" || method === "POST")
  ) {
    return `/rentals/${parts[1]}/payments`;
  }

  // Rental payment evidence: metadata only.
  // Actual receipt uploads/downloads use a separate secure proxy.
  if (
    method === "GET" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "evidences"
  ) {
    return `/rentals/${parts[1]}/payments/${parts[3]}/evidences`;
  }

  // Rental payment history: read-only audit records.
  if (
    method === "GET" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "history"
  ) {
    return `/rentals/${parts[1]}/payments/${parts[3]}/history`;
  }

  // Rental payment approval and rejection.
  // Laravel limits these actions to admins and super admins
  // with rentals.update. Evidence and balance rules remain
  // enforced in Laravel.
  if (
    method === "PATCH" &&
    parts.length === 5 &&
    parts[0] === "rentals" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "payments" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    ["verify", "reject"].includes(parts[4])
  ) {
    return `/rentals/${parts[1]}/payments/${parts[3]}/${parts[4]}`;
  }

  // Property Management: list properties.
  if (
    method === "GET" &&
    parts.length === 1 &&
    parts[0] === "properties"
  ) {
    return "/properties";
  }

  // Property Management: retrieve active categories.
  if (
    method === "GET" &&
    parts.length === 1 &&
    parts[0] === "property-categories"
  ) {
    return "/property-categories";
  }

  // Property Management: register property.
  if (
    method === "POST" &&
    parts.length === 1 &&
    parts[0] === "properties"
  ) {
    return "/properties";
  }

  // Property Management: details, editing and archiving.
  if (
    parts.length === 2 &&
    parts[0] === "properties" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    ["GET", "PUT", "DELETE"].includes(method)
  ) {
    return `/properties/${parts[1]}`;
  }

  // Featured Properties: dedicated administrator-controlled endpoint.
  // Laravel validates eligibility and authorization.
  if (
    method === "PATCH" &&
    parts.length === 3 &&
    parts[0] === "properties" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "featured"
  ) {
    return `/properties/${parts[1]}/featured`;
  }

  // Property Workflow: explicit API operation allowlist.
  // Laravel enforces roles, permissions and business rules.
  if (
    parts.length === 3 &&
    parts[0] === "properties" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    (
      (parts[2] === "submit" && method === "POST") ||
      (parts[2] === "verification" && method === "PATCH") ||
      (parts[2] === "verification-history" && method === "GET") ||
      (parts[2] === "publish" && method === "PATCH") ||
      (parts[2] === "availability" && method === "PATCH") ||
      (parts[2] === "assign-agent" && method === "PATCH")
    )
  ) {
    return `/properties/${parts[1]}/${parts[2]}`;
  }

  // CRM: Archive and Restore
  if (
    method === "GET" &&
    parts.length === 2 &&
    ["customers", "leads"].includes(parts[0]) &&
    parts[1] === "archived"
  ) {
    return `/${parts[0]}/archived`;
  }

  if (
    method === "PATCH" &&
    parts.length === 3 &&
    ["customers", "leads"].includes(parts[0]) &&
    /^[1-9]\d*$/.test(parts[1]) &&
    ["archive", "restore"].includes(parts[2])
  ) {
    return `/${parts[0]}/${parts[1]}/${parts[2]}`;
  }

  // CRM: Unassigned Leads Inbox
  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "crm" &&
    parts[1] === "unassigned-leads"
  ) {
    return "/crm/unassigned-leads";
  }

  // CRM: Lead Management
  if (
    parts.length === 1 &&
    parts[0] === "leads" &&
    ["GET", "POST"].includes(method)
  ) {
    return "/leads";
  }

  if (
    parts.length === 2 &&
    parts[0] === "leads" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    method === "GET"
  ) {
    return `/leads/${parts[1]}`;
  }

  if (
    parts.length === 3 &&
    parts[0] === "leads" &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    const id = parts[1];

    if (parts[2] === "activities" &&
        ["GET", "POST"].includes(method)) {
      return `/leads/${id}/activities`;
    }

    if (parts[2] === "status" && method === "PATCH") {
      return `/leads/${id}/status`;
    }

    if (parts[2] === "assign" && method === "PATCH") {
      return `/leads/${id}/assign`;
    }
  }

  if (
    parts.length === 5 &&
    parts[0] === "leads" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "activities" &&
    /^[1-9]\d*$/.test(parts[3]) &&
    parts[4] === "complete" &&
    method === "PATCH"
  ) {
    return `/leads/${parts[1]}/activities/${parts[3]}/complete`;
  }

  if (
    parts.length === 2 &&
    parts[0] === "crm" &&
    parts[1] === "follow-ups" &&
    method === "GET"
  ) {
    return "/crm/follow-ups";
  }

  // CRM: Administrator-controlled Customer Account Linking
  if (
    method === "PATCH" &&
    parts.length === 3 &&
    parts[0] === "customers" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "link-account"
  ) {
    return `/customers/${parts[1]}/link-account`;
  }

  // CRM: Customer Management
  if (
    parts.length === 1 &&
    parts[0] === "customers" &&
    (method === "GET" || method === "POST")
  ) {
    return "/customers";
  }

  if (
    parts.length === 2 &&
    parts[0] === "customers" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    (method === "GET" || method === "PUT")
  ) {
    return `/customers/${parts[1]}`;
  }

  if (parts.length === 1) {
    if (parts[0] === "users" && ["GET", "POST"].includes(method)) {
      return "/users";
    }

    if (parts[0] === "roles" && method === "GET") {
      return "/roles";
    }

    if (parts[0] === "password" && method === "PUT") {
      return "/change-password";
    }
  }

  if (
    parts[0] === "users" &&
    parts.length >= 2 &&
    /^[1-9]\d*$/.test(parts[1])
  ) {
    const id = parts[1];

    if (parts.length === 2 && ["GET", "PUT"].includes(method)) {
      return `/users/${id}`;
    }

    if (
      parts.length === 3 &&
      parts[2] === "status" &&
      method === "PATCH"
    ) {
      return `/users/${id}/status`;
    }
  }

  return null;
}

async function handle(
  request: NextRequest,
  context: Context,
  method: Method,
) {
  const { parts } = await context.params;
  const endpoint = resolveEndpoint(method, parts);

  if (!endpoint) {
    return NextResponse.json(
      { message: "Unsupported operation." },
      { status: 404 },
    );
  }

  if (method !== "GET") {
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
  }

  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json(
      { message: "Please sign in again." },
      { status: 401 },
    );
  }

  try {
    const query =
      method === "GET" &&
      (
        ["/users", "/customers", "/leads", "/properties", "/crm/follow-ups", "/crm/unassigned-leads", "/owners", "/rentals"].includes(endpoint) ||
        endpoint === "/customers/archived" ||
        endpoint === "/leads/archived"
      )
        ? request.nextUrl.search
        : "";

    let body: string | undefined;

    if (method !== "GET" && method !== "DELETE") {
      const contentType = request.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        return NextResponse.json(
          { message: "JSON request required." },
          { status: 415 },
        );
      }

      body = await request.text();

      if (body.length > 20000) {
        return NextResponse.json(
          { message: "Request is too large." },
          { status: 413 },
        );
      }

      try {
        JSON.parse(body);
      } catch {
        return NextResponse.json(
          { message: "Invalid JSON request." },
          { status: 400 },
        );
      }
    }

    const upstream = await laravelRequest(
      `${endpoint}${query}`,
      token,
      {
        method,
        ...(body !== undefined
          ? {
              body,
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      },
    );

    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { message: "Unexpected response from the backend." },
        { status: 502 },
      );
    }

    const result: unknown = await upstream.json();

    const response = NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });

    if (endpoint === "/change-password" && upstream.ok) {
      response.cookies.delete(SESSION_COOKIE);
    }

    return response;
  } catch {
    return NextResponse.json(
      { message: "Cannot connect to the Laravel server." },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context, "GET");
}

export async function POST(request: NextRequest, context: Context) {
  return handle(request, context, "POST");
}

export async function PUT(request: NextRequest, context: Context) {
  return handle(request, context, "PUT");
}

export async function PATCH(request: NextRequest, context: Context) {
  return handle(request, context, "PATCH");
}

export async function DELETE(request: NextRequest, context: Context) {
  return handle(request, context, "DELETE");
}
