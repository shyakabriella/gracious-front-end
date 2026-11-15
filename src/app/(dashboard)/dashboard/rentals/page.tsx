"use client";

import { useEffect, useState } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Rental = {
  id: number;
  reference: string;
  property_id: number;
  customer_id: number;
  agent_id: number | null;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  security_deposit: string;
  currency: string;
  payment_due_day: number;
  status: string;
  notes: string | null;
  property?: {
    id: number;
    reference: string;
    title: string;
  } | null;
  customer?: {
    id: number;
    reference: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  agent?: {
    id: number;
    name: string;
  } | null;
};

type RentalPage = {
  data: Rental[];
  current_page: number;
  last_page: number;
  total: number;
};

type Period = {
  schedule_id: number;
  reference: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount_due: string;
  credits: string;
  debits: string;
  revised_amount: string;
  verified_paid: string;
  balance: string;
  bucket: string;
};

type Statement = {
  rental_id: number;
  rental_reference: string;
  currency: string;
  as_of: string;
  summary: {
    total_billed: string;
    total_credits: string;
    total_debits: string;
    net_billed: string;
    verified_paid: string;
    total_outstanding: string;
    overpayment: string;
    overdue: string;
    due_today: string;
    future: string;
  };
  periods: Period[];
};

const API = "/api/dashboard/manage";

const statuses = [
  "all",
  "draft",
  "active",
  "terminated",
  "expired",
  "cancelled",
];

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "—";
}

function money(amount: string | number | null | undefined, currency: string) {
  if (amount === null || amount === undefined) return "—";

  const raw = String(amount);
  const [integer, decimals] = raw.split(".");

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${currency} ${grouped}${decimals !== undefined ? "." + decimals : ""}`;
}

const buttonClass =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm " +
  "font-semibold text-[#263956] disabled:opacity-40";

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [records, setRecords] = useState<RentalPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Rental | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statementError, setStatementError] = useState("");

  const canView =
    account?.permissions?.includes("rentals.view") ?? false;

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readJson(response) as {
          user?: Account;
        };

        if (!response.ok || !result.user) {
          throw new Error("Please sign in again.");
        }

        if (!controller.signal.aborted) {
          setAccount(result.user);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to verify your account permissions.");
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
    if (!canView) return;

    const controller = new AbortController();

    async function loadRentals() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (status !== "all") {
        params.set("status", status);
      }

      try {
        const response = await fetch(
          `${API}/rentals?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load rental agreements."),
          );
        }

        const data = result as RentalPage;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid rental listing response.");
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
              : "Unable to load rentals.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadRentals();

    return () => controller.abort();
  }, [canView, page, status, reload]);

  useEffect(() => {
    if (selectedId === null || !canView) return;

    const controller = new AbortController();

    async function loadDetails() {
      setDetailLoading(true);
      setSelected(null);
      setStatement(null);
      setDetailError("");
      setStatementError("");

      try {
        const response = await fetch(
          `${API}/rentals/${selectedId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load rental details."),
          );
        }

        const data = result as { rental?: Rental };

        if (!data.rental) {
          throw new Error("Invalid rental details response.");
        }

        if (!controller.signal.aborted) {
          setSelected(data.rental);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setDetailError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rental details.",
          );
        }
      }

      try {
        const response = await fetch(
          `${API}/rentals/${selectedId}/statement`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load adjusted rent statement."),
          );
        }

        const data = result as { statement?: Statement };

        if (
          !data.statement ||
          !data.statement.summary ||
          !Array.isArray(data.statement.periods)
        ) {
          throw new Error("Invalid adjusted rent statement response.");
        }

        if (!controller.signal.aborted) {
          setStatement(data.statement);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setStatementError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rent statement.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [selectedId, canView, reload]);

  if (checking) {
    return (
      <main className="p-6 text-sm text-slate-500">
        Checking rental permissions...
      </main>
    );
  }

  if (!account) {
    return (
      <main className="p-6 text-red-700">
        {error || "Please sign in to access Rental Management."}
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold text-[#263956]">
          Rental Management
        </h1>
        <p className="mt-4 text-sm text-red-700">
          Your account does not have permission to view rental agreements.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#263956]">
            Rental Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rental agreements, tenant information and adjusted rent statements.
          </p>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#263956]">
            Lease Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All statuses" : readable(item)}
                </option>
              ))}
            </select>
          </label>

          <span className="text-sm text-slate-500">
            {records ? `${records.total} rental agreements` : "—"}
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Loading rental agreements...
          </p>
        ) : records?.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No rental agreements found.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Property</th>
                  <th className="p-3">Tenant</th>
                  <th className="p-3">Monthly Rent</th>
                  <th className="p-3">Lease Dates</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {records?.data.map((rental) => (
                  <tr key={rental.id}>
                    <td className="p-3 font-semibold text-[#263956]">
                      {rental.reference}
                    </td>
                    <td className="p-3">
                      {rental.property?.title || "—"}
                    </td>
                    <td className="p-3">
                      {rental.customer?.name || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {money(rental.monthly_rent, rental.currency)}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs">
                      {dateOnly(rental.start_date)}
                      <span className="mx-1">to</span>
                      {dateOnly(rental.end_date)}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {readable(rental.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(rental.id)}
                        className={buttonClass}
                      >
                        View Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {records && records.last_page > 1 && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={buttonClass}
            >
              Previous
            </button>

            <span className="text-xs text-slate-500">
              Page {records.current_page} of {records.last_page}
            </span>

            <button
              type="button"
              disabled={loading || page >= records.last_page}
              onClick={() => setPage((value) => value + 1)}
              className={buttonClass}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {selectedId !== null && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rent-details-title"
            className="mx-auto my-5 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7"
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
              <div>
                <h2
                  id="rent-details-title"
                  className="text-xl font-bold text-[#263956]"
                >
                  Rental Agreement and Statement
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected?.reference || `Rental #${selectedId}`}
                </p>
              </div>

              <button
                type="button"
                className={buttonClass}
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </header>

            {detailLoading && (
              <p className="mt-5 text-sm text-slate-500">
                Loading rental information...
              </p>
            )}

            {detailError && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {detailError}
              </p>
            )}

            {selected && (
              <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Property", selected.property?.title || "—"],
                  ["Tenant", selected.customer?.name || "—"],
                  ["Agent", selected.agent?.name || "Unassigned"],
                  ["Status", readable(selected.status)],
                  ["Start Date", dateOnly(selected.start_date)],
                  ["End Date", dateOnly(selected.end_date)],
                  ["Monthly Rent", money(selected.monthly_rent, selected.currency)],
                  ["Security Deposit", money(selected.security_deposit, selected.currency)],
                  ["Payment Due Day", String(selected.payment_due_day)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-[#263956]">
                      {value}
                    </p>
                  </div>
                ))}
              </section>
            )}

            {statementError && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {statementError}
              </p>
            )}

            {statement && (
              <>
                <section className="mt-7">
                  <h3 className="text-lg font-bold text-[#263956]">
                    Adjusted Rent Statement
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    As of {dateOnly(statement.as_of)}. Amounts are calculated by Laravel.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Original Billed", statement.summary.total_billed],
                      ["Approved Credits", statement.summary.total_credits],
                      ["Debits", statement.summary.total_debits],
                      ["Adjusted Billed", statement.summary.net_billed],
                      ["Verified Payments", statement.summary.verified_paid],
                      ["Adjusted Outstanding", statement.summary.total_outstanding],
                      ["Overdue", statement.summary.overdue],
                      ["Due Today", statement.summary.due_today],
                      ["Future Balance", statement.summary.future],
                      ["Overpayment", statement.summary.overpayment],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-2 break-words text-base font-bold text-[#263956]">
                          {money(value, statement.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-7">
                  <h3 className="text-lg font-bold text-[#263956]">
                    Rent Billing Periods
                  </h3>

                  {statement.periods.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      No rent schedules are available for this agreement.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[850px] text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="p-3">Period</th>
                            <th className="p-3">Original Rent</th>
                            <th className="p-3">Credits</th>
                            <th className="p-3">Debits</th>
                            <th className="p-3">Adjusted Rent</th>
                            <th className="p-3">Paid</th>
                            <th className="p-3">Balance</th>
                            <th className="p-3">Due</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {statement.periods.map((period) => (
                            <tr key={period.schedule_id}>
                              <td className="p-3">
                                <p className="font-semibold">
                                  {period.reference}
                                </p>
                                <p className="mt-1 whitespace-nowrap text-slate-500">
                                  {dateOnly(period.period_start)} – {dateOnly(period.period_end)}
                                </p>
                              </td>
                              <td className="p-3">
                                {money(period.amount_due, statement.currency)}
                              </td>
                              <td className="p-3">
                                {money(period.credits, statement.currency)}
                              </td>
                              <td className="p-3">
                                {money(period.debits, statement.currency)}
                              </td>
                              <td className="p-3">
                                {money(period.revised_amount, statement.currency)}
                              </td>
                              <td className="p-3">
                                {money(period.verified_paid, statement.currency)}
                              </td>
                              <td className="p-3 font-semibold">
                                {money(period.balance, statement.currency)}
                              </td>
                              <td className="p-3">
                                <p>{dateOnly(period.due_date)}</p>
                                <p className="mt-1 capitalize text-slate-500">
                                  {readable(period.bucket)}
                                </p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            <div className="mt-7 flex justify-end border-t pt-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={buttonClass}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
