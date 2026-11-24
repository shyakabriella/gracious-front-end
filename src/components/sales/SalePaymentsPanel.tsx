"use client";

import { useEffect, useState, type FormEvent } from "react";
import SalePaymentEvidenceModal from "@/components/sales/SalePaymentEvidenceModal";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Sale = {
  id: number;
  reference: string;
  status: string;
  agreed_price: string;
  currency: string;
  agent?: {
    id: number;
    name: string;
  } | null;
};

type Payment = {
  id: number;
  reference: string;
  payment_type: string;
  payment_method: string;
  amount: string;
  currency: string;
  transaction_reference: string | null;
  payment_date: string;
  status: string;
  rejection_reason?: string | null;
  recorder?: { name: string } | null;
  verifier?: { name: string } | null;
};

type PaymentSummary = {
  currency: string;
  agreed_price: string;
  verified_amount: string;
  balance: string;
};

type PaymentResult = {
  payments: Payment[];
  summary: PaymentSummary;
};

type Props = {
  account: Account;
  sale: Sale;
  onChanged: () => void;
};

const API = "/api/dashboard/manage";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

function money(
  value: string | number | null | undefined,
  currency: string,
) {
  if (value === null || value === undefined) return "—";

  const [whole, fraction] = String(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    `${currency} ${grouped}` +
    (fraction !== undefined ? `.${fraction}` : "")
  );
}

function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const data = value as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (data.errors && typeof data.errors === "object") {
    for (const fieldErrors of Object.values(data.errors)) {
      if (Array.isArray(fieldErrors)) {
        const first = fieldErrors.find(
          (item): item is string =>
            typeof item === "string",
        );

        if (first) return first;
      }
    }
  }

  return typeof data.message === "string"
    ? data.message
    : fallback;
}

async function readResponse<T>(response: Response): Promise<T> {
  const value: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorMessage(
        value,
        `Request failed (HTTP ${response.status}).`,
      ),
    );
  }

  if (!value || typeof value !== "object") {
    throw new Error("Unexpected response from Laravel.");
  }

  return value as T;
}

export default function SalePaymentsPanel({
  account,
  sale,
  onChanged,
}: Props) {
  const [result, setResult] = useState<PaymentResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [paymentType, setPaymentType] = useState("deposit");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const isAssignedAgent =
    account.roles.includes("agent") &&
    sale.agent?.id === account.id;

  const canRecord =
    (isAdmin || isAssignedAgent) &&
    ["agreement", "pending_completion"].includes(sale.status);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API}/sales/${sale.id}/payments`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await readResponse<PaymentResult>(
          response,
        );

        if (
          !Array.isArray(data.payments) ||
          !data.summary ||
          typeof data.summary.balance !== "string"
        ) {
          throw new Error("Unexpected sales payment response.");
        }

        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load sales payments.",
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
  }, [sale.id, refreshKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRecord || busy || submissionUncertain) return;

    setError("");
    setMessage("");

    const value = amount.trim();

    if (
      !/^\d+(\.\d{1,2})?$/.test(value) ||
      !(Number(value) > 0) ||
      !Number.isFinite(Number(value))
    ) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }

    if (paymentMethod !== "cash" && !reference.trim()) {
      setError(
        "A transaction reference is required for non-cash payments.",
      );
      return;
    }

    if (!paymentDate) {
      setError("Select the payment date.");
      return;
    }

    if (reference.trim().length > 150 || notes.length > 3000) {
      setError("The transaction reference or notes are too long.");
      return;
    }

    if (
      !window.confirm(
        `Record ${money(value, sale.currency)} for ` +
        `${sale.reference}?\n\n` +
        "The payment will remain PENDING until evidence is reviewed.",
      )
    ) {
      return;
    }

    setBusy(true);

    let response: Response;

    try {
      response = await fetch(
        `${API}/sales/${sale.id}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_type: paymentType,
            payment_method: paymentMethod,
            amount: value,
            payment_date: paymentDate,
            ...(reference.trim()
              ? { transaction_reference: reference.trim() }
              : {}),
            ...(notes.trim()
              ? { notes: notes.trim() }
              : {}),
          }),
        },
      );
    } catch {
      setSubmissionUncertain(true);
      setError(
        "The payment request may have reached the server. " +
        "Close and reopen this sale to check its payment list " +
        "before attempting another submission.",
      );
      setBusy(false);
      return;
    }

    try {
      const data = await readResponse<{
        payment?: { id?: number; status?: string };
        message?: string;
      }>(response);

      if (!data.payment?.id || data.payment.status !== "pending") {
        setSubmissionUncertain(true);
        throw new Error(
          "The payment response was unexpected. " +
          "Check the payment list before submitting again.",
        );
      }

      setAmount("");
      setReference("");
      setPaymentDate("");
      setNotes("");

      setMessage(
        "Payment recorded as pending. " +
        "Upload evidence before administrator verification.",
      );

      setRefreshKey((value) => value + 1);
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record the payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  const summary = result?.summary;

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#263956]">
            Sale Payments
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Only verified payments reduce the outstanding balance.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() => setRefreshKey((value) => value + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Refresh Payments
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">
          Loading sale payments...
        </p>
      ) : summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Agreed Price",
              value: summary.agreed_price,
            },
            {
              label: "Verified Payments",
              value: summary.verified_amount,
            },
            {
              label: "Outstanding Balance",
              value: summary.balance,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg bg-slate-50 p-3"
            >
              <p className="text-xs text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 font-bold text-[#263956]">
                {money(item.value, summary.currency)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {result && (
        <div className="mt-5 space-y-3">
          <h4 className="font-semibold text-[#263956]">
            Payment Records
          </h4>

          {result.payments.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No payments have been recorded for this sale.
            </p>
          ) : (
            result.payments.map((payment) => (
              <article
                key={payment.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#263956]">
                    {payment.reference}
                  </p>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">
                    {payment.status}
                  </span>
                </div>

                <p className="mt-2 font-semibold">
                  {money(payment.amount, payment.currency)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {payment.payment_type.replaceAll("_", " ")}
                  {" · "}
                  {payment.payment_method.replaceAll("_", " ")}
                  {" · "}
                  {payment.payment_date?.slice(0, 10)}
                </p>

                {payment.transaction_reference && (
                  <p className="mt-1 break-all text-xs text-slate-500">
                    Transaction: {payment.transaction_reference}
                  </p>
                )}

                {payment.recorder?.name && (
                  <p className="mt-1 text-xs text-slate-500">
                    Recorded by: {payment.recorder.name}
                  </p>
                )}

                {payment.rejection_reason && (
                  <p className="mt-2 text-xs text-red-700">
                    Rejection reason: {payment.rejection_reason}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPayment(payment)}
                  className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#263956] hover:bg-slate-50"
                >
                  Evidence / Review
                </button>
              </article>
            ))
          )}
        </div>
      )}

      {canRecord && (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-6 space-y-4 border-t border-slate-200 pt-5"
        >
          <h4 className="font-bold text-[#263956]">
            Record New Payment
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Payment type
              <select
                value={paymentType}
                onChange={(event) =>
                  setPaymentType(event.target.value)
                }
                disabled={busy}
                className={`mt-2 ${inputClass}`}
              >
                <option value="deposit">Deposit</option>
                <option value="installment">Installment</option>
                <option value="final">Final payment</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Payment method
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                disabled={busy}
                className={`mt-2 ${inputClass}`}
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Amount ({sale.currency})
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
                placeholder="e.g. 2500000.00"
                className={`mt-2 ${inputClass}`}
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Payment date
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(event) =>
                  setPaymentDate(event.target.value)
                }
                disabled={busy}
                className={`mt-2 ${inputClass}`}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Transaction reference
            <input
              type="text"
              value={reference}
              maxLength={150}
              required={paymentMethod !== "cash"}
              onChange={(event) =>
                setReference(event.target.value)
              }
              disabled={busy}
              placeholder={
                paymentMethod === "cash"
                  ? "Optional for cash"
                  : "Bank or mobile money reference"
              }
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Notes (optional)
            <textarea
              rows={2}
              maxLength={3000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <p className="text-xs text-slate-500">
            Recording a payment does not verify receipt of funds.
            Administrator review and supporting evidence are required.
          </p>

          <button
            type="submit"
            disabled={
              busy ||
              loading ||
              submissionUncertain ||
              !amount.trim() ||
              !paymentDate ||
              (paymentMethod !== "cash" && !reference.trim())
            }
            className="rounded-lg bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Recording..." : "Record Pending Payment"}
          </button>
        </form>
      )}
      {selectedPayment && (
        <SalePaymentEvidenceModal
          sale={sale}
          payment={selectedPayment}
          account={account}
          onClose={() => setSelectedPayment(null)}
          onChanged={(notice) => {
            setMessage(notice);
            setRefreshKey((value) => value + 1);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
