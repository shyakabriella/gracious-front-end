import Link from "next/link";
import {
  getAuthToken,
  laravelRequest,
} from "@/lib/auth/server";

type CustomerProfile = {
  reference: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_type: string | null;
  preferred_location: string | null;
};

type Inquiry = {
  id: number;
  reference: string;
  status: string;
  lead_type: string;
  subject: string | null;
  created_at: string;
  property: {
    title: string;
    slug: string;
  } | null;
};

type CustomerDashboardData = {
  profile: CustomerProfile | null;
  inquiries: {
    total: number;
    by_status: Record<string, number>;
    recent: Inquiry[];
  };
};

function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e1e6f0] bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function CustomerDashboard() {
  const token = await getAuthToken();

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Please sign in to access your customer dashboard.
        </p>
      </Card>
    );
  }

  let data: CustomerDashboardData;

  try {
    const response = await laravelRequest(
      "/customer/dashboard",
      token,
    );

    if (!response.ok) {
      throw new Error("Customer dashboard unavailable.");
    }

    data = (await response.json()) as CustomerDashboardData;

    if (
      !data ||
      !data.inquiries ||
      !Array.isArray(data.inquiries.recent) ||
      typeof data.inquiries.total !== "number"
    ) {
      throw new Error("Invalid customer dashboard response.");
    }
  } catch {
    return (
      <Card>
        <h1 className="text-xl font-bold text-[#263956]">
          Customer Dashboard
        </h1>
        <p role="alert" className="mt-3 text-sm text-amber-700">
          We could not load your dashboard information.
          Please try again later.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <p className="text-sm font-semibold text-[#626df1]">
          GRACIOUS INVESTMENT LTD
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#263956]">
          My Customer Dashboard
        </h1>
        <p className="mt-2 text-sm text-[#7284a2]">
          View your property inquiries and customer profile.
        </p>
      </div>

      {!data.profile ? (
        <Card>
          <h2 className="text-lg font-bold text-[#263956]">
            Welcome to Gracious Investment
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Your account is active, but it has not yet been
            linked to a customer profile. Contact Gracious
            Investment to verify and connect your account.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white"
          >
            Contact Us
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold text-[#7284a2]">
                Total Property Inquiries
              </p>
              <p className="mt-3 text-4xl font-bold tabular-nums text-[#263956]">
                {data.inquiries.total.toLocaleString("en-RW")}
              </p>
            </Card>

            <Card>
              <p className="text-xs font-semibold text-[#7284a2]">
                Customer Reference
              </p>
              <p className="mt-3 break-words text-xl font-bold text-[#263956]">
                {data.profile.reference}
              </p>
            </Card>

            <Card>
              <p className="text-xs font-semibold text-[#7284a2]">
                Preferred Location
              </p>
              <p className="mt-3 break-words text-xl font-bold text-[#263956]">
                {data.profile.preferred_location || "Not specified"}
              </p>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold text-[#263956]">
                My Profile
              </h2>

              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ["Name", data.profile.name],
                  ["Phone", data.profile.phone],
                  ["Email", data.profile.email],
                  [
                    "Customer Type",
                    data.profile.customer_type
                      ? titleCase(data.profile.customer_type)
                      : null,
                  ],
                  [
                    "Preferred Location",
                    data.profile.preferred_location,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold text-[#263956]">
                      {value || "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-[#263956]">
                Inquiry Status
              </h2>

              <div className="mt-5 space-y-3">
                {Object.entries(data.inquiries.by_status ?? {})
                  .filter(
                    ([, count]) =>
                      typeof count === "number" &&
                      Number.isFinite(count) &&
                      count >= 0,
                  )
                  .map(([status, count]) => (
                    <div
                      key={status}
                      className="flex justify-between rounded-xl bg-[#f6f7ff] px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-slate-600">
                        {titleCase(status)}
                      </span>
                      <span className="font-bold text-[#263956]">
                        {count}
                      </span>
                    </div>
                  ))}

                {data.inquiries.total === 0 && (
                  <p className="text-sm text-slate-500">
                    You have no property inquiries yet.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#263956]">
                Recent Property Inquiries
              </h2>
              <span className="text-xs text-slate-500">
                Latest 10 inquiries
              </span>
            </div>

            {data.inquiries.recent.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No inquiries have been recorded for your profile.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {data.inquiries.recent.map((inquiry) => (
                  <article
                    key={inquiry.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#263956]">
                          {inquiry.reference}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {inquiry.property?.title ||
                            inquiry.subject ||
                            titleCase(inquiry.lead_type)}
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {titleCase(inquiry.status)}
                      </span>
                    </div>

                    {inquiry.property?.slug && (
                      <Link
                        href={`/properties/${encodeURIComponent(inquiry.property.slug)}`}
                        className="mt-3 inline-block text-sm font-semibold text-[#626df1] hover:underline"
                      >
                        View Property
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
