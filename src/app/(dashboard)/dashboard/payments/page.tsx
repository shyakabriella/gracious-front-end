"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RentalPaymentsModal from "@/components/rentals/RentalPaymentsModal";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type PaymentRow = {
  category: "rental" | "sale";
  payment_id: number;
  reference: string;
  payment_method: string;
  amount: string;
  currency: string;
  payment_date: string;
  status: string;
  agreement_id: number;
  agreement_reference: string;
  customer_name: string | null;
  property_title: string | null;
};

type SummaryRow = {
  currency: string;
  status: string;
  record_count: number | string;
  total_amount: string;
};

type PaymentPage = {
  data: PaymentRow[];
  current_page: number;
  last_page: number;
  total: number;
};

type DashboardResponse = {
  payments: PaymentPage;
  summary: SummaryRow[];
  access: {
    rentals: boolean;
    sales: boolean;
  };
};

type RentalDetails = {
  id: number;
  reference: string;
  status: string;
  currency: string;
};

const API = "/api/dashboard/manage";

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 " +
  "text-sm font-semibold text-[#263956] hover:bg-slate-50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

function readable(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "—";
}

function money(value: string | number, currency: string) {
  const raw = String(value);

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);

  if (!match) return `${currency} ${raw}`;

  const whole = match[2].replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

  return (
    `${currency} ${match[1]}${whole}` +
    (match[3] === undefined ? "" : `.${match[3]}`)
  );
}

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const result =
      body && typeof body === "object"
        ? (body as { message?: string })
        : null;

    throw new Error(
      result?.message || `Request failed (${response.status}).`,
    );
  }

  return body as T;
}

function statusClass(value: string) {
  if (value === "verified") {
    return "bg-emerald-50 text-emerald-800";
  }

  if (value === "rejected") {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-800";
}

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);

  const [records, setRecords] =
    useState<DashboardResponse | null>(null);

  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);

  const [paymentRental, setPaymentRental] =
    useState<RentalDetails | null>(null);

  const roles = account?.roles || [];
  const permissions = account?.permissions || [];

  const authorized =
    roles.some((role) =>
      ["super_admin", "admin", "property_manager", "accountant"]
        .includes(role),
    ) &&
    (
      permissions.includes("rentals.view") ||
      permissions.includes("sales.view")
    );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await readResponse<{ user: Account }>(
          response,
        );

        if (!data.user) {
          throw new Error("Please sign in again.");
        }

        if (!controller.signal.aborted) {
          setAccount(data.user);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to verify account permissions.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    }

    void loadAccount();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!account || !authorized) return;

    const controller = new AbortController();

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          type,
          status,
          page: String(page),
          per_page: "20",
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(
          `${API}/dashboard/payments?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data =
          await readResponse<DashboardResponse>(response);

        if (!data.payments ||
            !Array.isArray(data.payments.data) ||
            !Array.isArray(data.summary)) {
          throw new Error(
            "Payments API returned an unexpected response.",
          );
        }

        if (!controller.signal.aborted) {
          setRecords(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRecords(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load payments.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPayments();

    return () => controller.abort();
  }, [account, authorized, type, status, search, page, reload]);

  async function openRentalPayments(row: PaymentRow) {
    if (
      row.category !== "rental" ||
      !account ||
      openingId !== null
    ) {
      return;
    }

    setOpeningId(row.payment_id);
    setActionError("");

    try {
      // Obtain the actual rental status from Laravel.
      // Do not assume a rental is active.
      const response = await fetch(
        `${API}/rentals/${row.agreement_id}`,
        { cache: "no-store" },
      );

      const data = await readResponse<{
        rental?: RentalDetails;
        data?: RentalDetails;
      }>(response);

      const rental = data.rental || data.data;

      if (
        !rental ||
        rental.id !== row.agreement_id ||
        !rental.status ||
        !rental.reference ||
        !rental.currency
      ) {
        throw new Error(
          "Unable to verify the rental details.",
        );
      }

      setPaymentRental(rental);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Unable to open rental payments.",
      );
    } finally {
      setOpeningId(null);
    }
  }

  const summaries = records?.summary || [];
  const payments = records?.payments;

  return (
    <main className="space-y-6 p-4 sm:p-7 lg:p-9">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
            Financial Management
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Payments
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Monitor rental and property sale payments,
            verification status, and collection history.
          </p>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={loading || checking}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh Data
        </button>
      </header>

      {checking ? (
        <p className="text-sm text-slate-500">
          Checking account permissions...
        </p>
      ) : !authorized ? (
        <p role="alert" className="rounded-xl border p-4 text-sm text-red-700">
          {error || "You do not have access to company payments."}
        </p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {([
              ["verified", "Verified Collections"],
              ["pending", "Pending Verification"],
              ["rejected", "Rejected Payments"],
            ] as const).map(([key, label]) => {
              const rows = summaries.filter(
                (item) => item.status === key,
              );

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {label}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {rows.reduce(
                      (total, item) =>
                        total + Number(item.record_count || 0),
                      0,
                    )}{" "}
                    payment(s)
                  </p>

                  <div className="mt-3 space-y-2">
                    {rows.length === 0 ? (
                      <p className="text-lg font-semibold text-slate-400">
                        No records
                      </p>
                    ) : (
                      rows.map((item) => (
                        <p
                          key={`${key}-${item.currency}`}
                          className="text-lg font-bold text-[#263956]"
                        >
                          {money(item.total_amount, item.currency)}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#263956]">
                  Payment Records
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Records and totals follow your access permissions.
                  Different currencies are displayed separately.
                </p>
              </div>

              <p className="text-sm text-slate-600">
                {payments?.total ?? 0} matching records
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Payment type
                <select
                  className={`${inputClass} mt-1`}
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All payments</option>
                  {records?.access.rentals && (
                    <option value="rental">Rental payments</option>
                  )}
                  {records?.access.sales && (
                    <option value="sale">Sales payments</option>
                  )}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Verification status
                <select
                  className={`${inputClass} mt-1`}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(searchInput.trim());
                  setPage(1);
                }}
                className="flex items-end gap-2"
              >
                <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
                  Search
                  <input
                    className={`${inputClass} mt-1`}
                    placeholder="Payment, customer, property..."
                    maxLength={120}
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                  />
                </label>

                <button type="submit" className={buttonClass}>
                  Search
                </button>
              </form>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {actionError && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {actionError}
              </p>
            )}

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Customer / Property</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Date / Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Loading payments...
                      </td>
                    </tr>
                  ) : !payments || payments.data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No payments found for these filters.
                      </td>
                    </tr>
                  ) : (
                    payments.data.map((row) => (
                      <tr
                        key={`${row.category}-${row.payment_id}`}
                        className="align-top"
                      >
                        <td className="p-3">
                          <p className="font-semibold text-[#263956]">
                            {row.reference}
                          </p>
                          <p className="mt-1 capitalize text-xs text-slate-500">
                            {readable(row.category)} ·{" "}
                            {row.agreement_reference}
                          </p>
                        </td>

                        <td className="p-3">
                          <p className="font-medium">
                            {row.customer_name || "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.property_title || "—"}
                          </p>
                        </td>

                        <td className="p-3 whitespace-nowrap font-semibold">
                          {money(row.amount, row.currency)}
                        </td>

                        <td className="p-3">
                          <p>{row.payment_date?.slice(0, 10) || "—"}</p>
                          <p className="mt-1 capitalize text-xs text-slate-500">
                            {readable(row.payment_method)}
                          </p>
                        </td>

                        <td className="p-3">
                          <span
                            className={
                              "inline-flex rounded-full px-3 py-1 text-xs " +
                              "font-semibold capitalize " +
                              statusClass(row.status)
                            }
                          >
                            {readable(row.status)}
                          </span>
                        </td>

                        <td className="p-3">
                          {row.category === "rental" &&
                          records.access.rentals ? (
                            <button
                              type="button"
                              className={buttonClass}
                              disabled={openingId !== null}
                              onClick={() =>
                                void openRentalPayments(row)
                              }
                            >
                              {openingId === row.payment_id
                                ? "Opening..."
                                : "Manage Payment"}
                            </button>
                          ) : (
                            <Link
                              href="/dashboard/sales"
                              className="text-sm font-semibold text-indigo-600 hover:underline"
                            >
                              Open Sales
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Page {payments?.current_page ?? page} of{" "}
                {payments?.last_page ?? 1}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={loading || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={buttonClass}
                  disabled={
                    loading ||
                    !payments ||
                    page >= payments.last_page
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Verified collection totals are gross payment figures.
            Refunds are managed separately and are not deducted here.
            Pending payments are not verified collections.
          </p>
        </>
      )}

      {paymentRental && account && (
        <RentalPaymentsModal
          key={paymentRental.id}
          rentalId={paymentRental.id}
          rentalReference={paymentRental.reference}
          rentalStatus={paymentRental.status}
          currency={paymentRental.currency}
          account={account}
          onClose={() => setPaymentRental(null)}
          onChanged={() => setReload((value) => value + 1)}
        />
      )}
    </main>
  );
}
