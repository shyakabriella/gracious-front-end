"use client";

import {
  useEffect,
  useState,
} from "react";

import RentalRefundsModal from "@/components/rentals/RentalRefundsModal";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Rental = {
  id: number;
  reference: string;
  status: string;
  currency: string;
  monthly_rent: string;
  property?: {
    title: string;
  } | null;
  customer?: {
    name: string;
  } | null;
};

type RentalPage = {
  data: Rental[];
  current_page: number;
  last_page: number;
  total: number;
};

type SelectedRental = {
  id: number;
  reference: string;
  status: string;
  currency: string;
};

const API = "/api/dashboard/manage";

const buttonClass =
  "rounded-lg border border-slate-300 bg-white " +
  "px-4 py-2 text-sm font-semibold text-[#263956] " +
  "hover:bg-slate-50 disabled:cursor-not-allowed " +
  "disabled:opacity-40";

const primaryClass =
  "rounded-lg bg-[#263956] px-4 py-2 " +
  "text-sm font-semibold text-white " +
  "hover:bg-[#344d72] disabled:opacity-40";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function money(value: string, currency: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${currency} ${value}`;
  }

  return `${currency} ${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readResponse<T>(
  response: Response,
): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (data && typeof data === "object") {
      const result = data as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      const firstError = result.errors
        ? Object.values(result.errors).flat()[0]
        : undefined;

      throw new Error(
        firstError ||
        result.message ||
        `Request failed (${response.status}).`,
      );
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return data as T;
}

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [records, setRecords] = useState<RentalPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedRental, setSelectedRental] =
    useState<SelectedRental | null>(null);

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

        const result = await readResponse<{
          user?: Account;
        }>(response);

        if (!result.user) {
          throw new Error("Please sign in again.");
        }

        if (!controller.signal.aborted) {
          setAccount(result.user);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAuthError(
            cause instanceof Error
              ? cause.message
              : "Unable to verify your account.",
          );
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
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<RentalPage>(
          response,
        );

        if (!Array.isArray(result.data)) {
          throw new Error(
            "Unexpected rental agreement response.",
          );
        }

        if (!controller.signal.aborted) {
          setRecords(result);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRecords(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rental agreements.",
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

  if (checking) {
    return (
      <main className="p-5 sm:p-8">
        <p className="text-sm text-slate-500">
          Checking refund management access...
        </p>
      </main>
    );
  }

  if (authError || !canView) {
    return (
      <main className="p-5 sm:p-8">
        <h1 className="text-2xl font-bold text-[#263956]">
          Refund Management
        </h1>

        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {authError ||
            "Your account does not have permission to view rental refunds."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
            Finance / Rental Management
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Refund Management
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Review rental overpayments, request refunds against
            verified payments, and track refund requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          disabled={loading}
          className={buttonClass}
        >
          Refresh Data
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Refund requests can only be created for terminated
        or expired rentals. A request does not approve a
        refund or confirm that money has been transferred.
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#263956]">
              Rental Agreements
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select an agreement to view its refund
              balance and request history.
            </p>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Rental status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All agreements</option>
              <option value="terminated">Terminated</option>
              <option value="expired">Expired</option>
            </select>
          </label>
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
          <p className="py-10 text-center text-sm text-slate-500">
            Loading rental agreements...
          </p>
        ) : !records || records.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No rental agreements found for this filter.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {records.data.map((rental) => {
              const ended = ["terminated", "expired"].includes(
                rental.status,
              );

              return (
                <article
                  key={rental.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#263956]">
                        {rental.reference}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                        {readable(rental.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-700">
                      {rental.property?.title || "Property unavailable"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Tenant: {rental.customer?.name || "—"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Monthly rent:{" "}
                      {money(rental.monthly_rent, rental.currency)}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRental({
                          id: rental.id,
                          reference: rental.reference,
                          status: rental.status,
                          currency: rental.currency,
                        })
                      }
                      className={ended ? primaryClass : buttonClass}
                    >
                      {ended
                        ? "Manage Refunds"
                        : "View Refund History"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {records && records.last_page > 1 && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() =>
                setPage((value) => Math.max(1, value - 1))
              }
              className={buttonClass}
            >
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {records.current_page} of{" "}
              {records.last_page}
            </span>

            <button
              type="button"
              disabled={
                loading || page >= records.last_page
              }
              onClick={() =>
                setPage((value) => value + 1)
              }
              className={buttonClass}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {selectedRental && account && (
        <RentalRefundsModal
          key={selectedRental.id}
          rentalId={selectedRental.id}
          rentalReference={selectedRental.reference}
          rentalStatus={selectedRental.status}
          currency={selectedRental.currency}
          account={account}
          onClose={() => setSelectedRental(null)}
          onChanged={() =>
            setReload((value) => value + 1)
          }
        />
      )}
    </main>
  );
}
