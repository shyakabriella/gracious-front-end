"use client";

import { useEffect, useState } from "react";
import SalesRegistrationModal from "@/components/sales/SalesRegistrationModal";
import SaleStatusActions from "@/components/sales/SaleStatusActions";
import SalePaymentsPanel from "@/components/sales/SalePaymentsPanel";
import SaleCompletionPanel from "@/components/sales/SaleCompletionPanel";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Sale = {
  id: number;
  reference: string;
  status: string;
  asking_price: string;
  agreed_price: string;
  currency: string;
  agreement_date?: string | null;
  expected_completion_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
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
  } | null;
  agent?: {
    id: number;
    name: string;
  } | null;
  status_history?: {
    id: number;
    from_status: string | null;
    to_status: string;
    created_at: string;
    changed_by?: { name: string } | null;
  }[];
};

type SalePage = {
  data: Sale[];
  current_page: number;
  last_page: number;
  total: number;
};

type SaleDetail = {
  sale: Sale;
};

const API = "/api/dashboard/manage";

const statuses = [
  "all",
  "negotiation",
  "agreement",
  "pending_completion",
  "completed",
  "cancelled",
];

const buttonClass =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm " +
  "font-semibold text-[#263956] hover:bg-slate-50 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "—";
}

function money(
  value: string | number | null | undefined,
  currency: string,
) {
  if (value === null || value === undefined) return "—";

  const [whole, fraction] = String(value).split(".");
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    `${currency} ${formatted}` +
    (fraction !== undefined ? `.${fraction}` : "")
  );
}

async function readResponse<T>(response: Response): Promise<T> {
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = "Unable to complete the request.";

    if (
      result &&
      typeof result === "object" &&
      "message" in result &&
      typeof result.message === "string"
    ) {
      message = result.message;
    }

    throw new Error(message);
  }

  return result as T;
}

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<SalePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState("");
  const [salesRefresh, setSalesRefresh] = useState(0);
  const [saleDetailRefresh, setSaleDetailRefresh] = useState(0);
  const [saleStatusNotice, setSaleStatusNotice] = useState("");

  const canView =
    !!account &&
    account.permissions.includes("sales.view") &&
    account.roles.some((role) =>
      ["super_admin", "admin", "agent"].includes(role),
    );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readResponse<{
          user: Account;
        }>(response);

        if (
          !result.user ||
          !Array.isArray(result.user.roles) ||
          !Array.isArray(result.user.permissions)
        ) {
          throw new Error("Unexpected account response.");
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

    async function loadSales() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        per_page: "10",
      });

      if (status !== "all") {
        params.set("status", status);
      }

      try {
        const response = await fetch(
          `${API}/sales?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<SalePage>(response);

        if (!Array.isArray(result.data)) {
          throw new Error("Unexpected sales response.");
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
              : "Unable to load sales.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSales();

    return () => controller.abort();
  }, [canView, status, page, salesRefresh]);

  useEffect(() => {
    if (!canView || selectedId === null) return;

    const controller = new AbortController();

    async function loadDetails() {
      setDetailsLoading(true);
      setDetailsError("");
      setSelectedSale(null);

      try {
        const response = await fetch(
          `${API}/sales/${selectedId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<SaleDetail>(response);

        if (!result.sale || result.sale.id !== selectedId) {
          throw new Error("Unexpected sale details response.");
        }

        if (!controller.signal.aborted) {
          setSelectedSale(result.sale);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setDetailsError(
            cause instanceof Error
              ? cause.message
              : "Unable to load sale details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailsLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [canView, selectedId, saleDetailRefresh]);

  if (checking) {
    return (
      <main className="p-5 sm:p-8">
        <p className="text-sm text-slate-500">
          Checking Sales Management access...
        </p>
      </main>
    );
  }

  if (authError || !canView) {
    return (
      <main className="p-5 sm:p-8">
        <h1 className="text-2xl font-bold text-[#263956]">
          Sales Management
        </h1>
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {authError ||
            "Your account does not have permission to access sales."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
            Property Management / Sales
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Sales Management
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            View property sale transactions, buyers, assigned agents,
            and agreement progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRegistrationNotice("");
              setRegistrationOpen(true);
            }}
            className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white hover:bg-[#354e72]"
          >
            + Register New Sale
          </button>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3">
          <p className="text-xs text-slate-500">Total sales in filter</p>
          <p className="text-2xl font-bold text-[#263956]">
            {records?.total ?? "—"}
          </p>
          </div>
        </div>
      </div>

      {registrationNotice && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {registrationNotice}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#263956]">
              Sale Transactions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sales are retrieved securely from Laravel.
            </p>
          </div>

          <label className="text-sm font-semibold text-slate-700">
            Sale status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All statuses" : readable(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Loading sales...
          </p>
        ) : !records || records.data.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No sale transactions found for this filter.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {records.data.map((sale) => (
              <article
                key={sale.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[#263956]">
                      {sale.reference}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                      {readable(sale.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    {sale.property?.title || "Property unavailable"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Buyer: {sale.customer?.name || "—"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Agent: {sale.agent?.name || "—"}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#263956]">
                    Agreed price: {money(sale.agreed_price, sale.currency)}
                  </p>
                </div>

                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setSaleStatusNotice("");
                    setSelectedId(sale.id);
                  }}
                >
                  View Sale Details
                </button>
              </article>
            ))}
          </div>
        )}

        {records && records.last_page > 1 && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              className={buttonClass}
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            <span className="text-sm text-slate-600">
              Page {records.current_page} of {records.last_page}
            </span>

            <button
              type="button"
              className={buttonClass}
              disabled={loading || page >= records.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {registrationOpen && account && (
        <SalesRegistrationModal
          account={account}
          onClose={() => setRegistrationOpen(false)}
          onCreated={() => {
            setRegistrationOpen(false);
            setRegistrationNotice(
              "Sale negotiation registered successfully.",
            );
            setStatus("all");
            setPage(1);
            setSalesRefresh((value) => value + 1);
          }}
        />
      )}

      {selectedId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Sale transaction details"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-[#263956]">
                Sale Details
              </h2>

              <button
                type="button"
                className={buttonClass}
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>

            {saleStatusNotice && (
              <p
                role="status"
                className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {saleStatusNotice}
              </p>
            )}

            {detailsLoading ? (
              <p className="mt-6 text-sm text-slate-500">
                Loading sale details...
              </p>
            ) : detailsError ? (
              <p
                role="alert"
                className="mt-6 text-sm text-red-700"
              >
                {detailsError}
              </p>
            ) : selectedSale ? (
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-slate-500">Sale reference</p>
                  <p className="font-bold">{selectedSale.reference}</p>
                </div>

                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-semibold capitalize">
                    {readable(selectedSale.status)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Property</p>
                  <p>{selectedSale.property?.title || "—"}</p>
                </div>

                <div>
                  <p className="text-slate-500">Buyer</p>
                  <p>{selectedSale.customer?.name || "—"}</p>
                </div>

                <div>
                  <p className="text-slate-500">Assigned agent</p>
                  <p>{selectedSale.agent?.name || "—"}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Asking price</p>
                    <p className="font-semibold">
                      {money(
                        selectedSale.asking_price,
                        selectedSale.currency,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Agreed price</p>
                    <p className="font-semibold">
                      {money(
                        selectedSale.agreed_price,
                        selectedSale.currency,
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Agreement date</p>
                    <p>{dateOnly(selectedSale.agreement_date)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      Expected completion
                    </p>
                    <p>
                      {dateOnly(
                        selectedSale.expected_completion_date,
                      )}
                    </p>
                  </div>
                </div>

                {selectedSale.notes && (
                  <div>
                    <p className="text-slate-500">Notes</p>
                    <p className="whitespace-pre-wrap">
                      {selectedSale.notes}
                    </p>
                  </div>
                )}

                {account && (
                  <SaleStatusActions
                    key={`${selectedSale.id}:${selectedSale.status}`}
                    sale={selectedSale}
                    account={account}
                    onChanged={(message) => {
                      setSaleStatusNotice(message);
                      setSaleDetailRefresh((value) => value + 1);
                      setSalesRefresh((value) => value + 1);
                    }}
                  />
                )}

                {account && (
                  <SalePaymentsPanel
                    sale={selectedSale}
                    account={account}
                    onChanged={() => {
                      setSalesRefresh((value) => value + 1);
                    }}
                  />
                )}

                {account && (
                  <SaleCompletionPanel
                    sale={selectedSale}
                    account={account}
                    onChanged={(notice) => {
                      setSaleStatusNotice(notice);
                      setSaleDetailRefresh((value) => value + 1);
                      setSalesRefresh((value) => value + 1);
                    }}
                  />
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
