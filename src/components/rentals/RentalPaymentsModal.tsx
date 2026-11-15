"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type Account = {
  roles: string[];
  permissions: string[];
};

type Payment = {
  id: number;
  reference: string;
  payment_method: string;
  amount: string;
  currency: string;
  transaction_reference: string | null;
  payment_date: string;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  recorder?: { name: string } | null;
  verifier?: { name: string } | null;
};

type Evidence = {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploader?: { name: string } | null;
};

type History = {
  id: number;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  changed_by?: { name: string } | null;
  created_at?: string;
};

type Statement = {
  currency: string;
  summary: {
    total_outstanding: string;
    verified_paid: string;
    overpayment: string;
  };
};

type Props = {
  rentalId: number;
  rentalReference: string;
  rentalStatus: string;
  currency: string;
  account: Account;
  onClose: () => void;
  onChanged?: () => void;
};

const API = "/api/dashboard/manage";
const RECEIPTS = "/api/dashboard/rental-payment-evidence";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm " +
  "text-slate-900 focus:border-blue-600 focus:outline-none";

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 " +
  "text-sm font-semibold text-slate-700 hover:bg-slate-50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const primaryClass =
  "rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold " +
  "text-white hover:bg-[#344d72] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function formatMoney(value: string, currency: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${value} ${currency}`;
  }

  return `${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function dateOnly(value: string) {
  return value?.slice(0, 10) || "—";
}

function readable(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

async function readResponse<T>(response: Response): Promise<T> {
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

export default function RentalPaymentsModal({
  rentalId,
  rentalReference,
  rentalStatus,
  currency,
  account,
  onClose,
  onChanged,
}: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const roles = account.roles || [];
  const canUpdate = (account.permissions || []).includes("rentals.update");

  const canRecord =
    canUpdate &&
    roles.some((role) =>
      ["super_admin", "admin", "property_manager"].includes(role),
    );

  const canReview =
    canUpdate &&
    roles.some((role) => ["super_admin", "admin"].includes(role));

  const eligibleRental =
    ["active", "terminated", "expired"].includes(rentalStatus);

  const selected = payments.find((payment) => payment.id === selectedPayment);

  const base = `${API}/rentals/${rentalId}/payments`;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [paymentsResponse, statementResponse] = await Promise.all([
      fetch(base, { cache: "no-store", signal }),
      fetch(`${API}/rentals/${rentalId}/statement`, {
        cache: "no-store",
        signal,
      }),
    ]);

    const paymentData = await readResponse<{ payments: Payment[] }>(
      paymentsResponse,
    );

    const statementData = await readResponse<{ statement: Statement }>(
      statementResponse,
    );

    if (!signal?.aborted) {
      setPayments(paymentData.payments || []);
      setStatement(statementData.statement);
    }
  }, [base, rentalId]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      try {
        await refresh(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rental payments.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (selectedPayment === null) {
      return;
    }

    const controller = new AbortController();

    async function loadDetails() {
      setDetailsLoading(true);
      setError("");
      setEvidences([]);
      setHistory([]);

      try {
        const [evidenceResponse, historyResponse] = await Promise.all([
          fetch(`${base}/${selectedPayment}/evidences`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`${base}/${selectedPayment}/history`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const evidenceData = await readResponse<{ evidences: Evidence[] }>(
          evidenceResponse,
        );

        const historyData = await readResponse<{ history: History[] }>(
          historyResponse,
        );

        if (!controller.signal.aborted) {
          setEvidences(evidenceData.evidences || []);
          setHistory(historyData.history || []);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load payment evidence.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setDetailsLoading(false);
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [base, selectedPayment]);

  async function reload() {
    await refresh();

    if (selectedPayment !== null) {
      const [evidenceResponse, historyResponse] = await Promise.all([
        fetch(`${base}/${selectedPayment}/evidences`, {
          cache: "no-store",
        }),
        fetch(`${base}/${selectedPayment}/history`, {
          cache: "no-store",
        }),
      ]);

      const evidenceData = await readResponse<{ evidences: Evidence[] }>(
        evidenceResponse,
      );

      const historyData = await readResponse<{ history: History[] }>(
        historyResponse,
      );

      setEvidences(evidenceData.evidences || []);
      setHistory(historyData.history || []);
    }

    onChanged?.();
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRecord || !eligibleRental || busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: method,
          amount,
          transaction_reference:
            method === "cash" ? null : transactionReference.trim(),
          payment_date: paymentDate,
          notes: notes.trim() || null,
        }),
      });

      const result = await readResponse<{ payment: Payment }>(response);

      setAmount("");
      setTransactionReference("");
      setNotes("");
      setMessage("Payment recorded as pending. Upload its receipt before verification.");
      setSelectedPayment(result.payment.id);
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to record payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadReceipt() {
    if (!selected || !receipt || !canRecord || busy) return;

    if (receipt.size === 0 || receipt.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty receipt of 5 MB or less.");
      return;
    }

    const extension = receipt.name.split(".").pop()?.toLowerCase();

    if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      setError("Only PDF, JPG, JPEG and PNG receipts are supported.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", receipt);

      const response = await fetch(
        `${RECEIPTS}/${rentalId}/${selected.id}`,
        { method: "POST", body: form },
      );

      await readResponse(response);

      setReceipt(null);
      setMessage("Receipt uploaded successfully.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Receipt upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reviewPayment(action: "verify" | "reject") {
    if (!selected || !canReview || busy || selected.status !== "pending") {
      return;
    }

    if (action === "verify" && evidences.length === 0) {
      setError("Upload payment evidence before verification.");
      return;
    }

    if (action === "reject" && rejectReason.trim().length < 5) {
      setError("Provide a rejection reason with at least 5 characters.");
      return;
    }

    const confirmed = window.confirm(
      action === "verify"
        ? `Verify payment ${selected.reference} for ${formatMoney(
            selected.amount,
            selected.currency,
          )}? This will allocate the payment to rent bills.`
        : `Reject payment ${selected.reference}?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${base}/${selected.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject" ? { reason: rejectReason.trim() } : {},
        ),
      });

      await readResponse(response);

      setRejectReason("");
      setMessage(
        action === "verify"
          ? "Payment verified and allocated by Laravel."
          : "Payment rejected.",
      );

      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Payment review failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rental-payment-title"
        className="mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h2
              id="rental-payment-title"
              className="text-xl font-bold text-[#263956]"
            >
              Manage Rental Payments
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {rentalReference}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttonClass}
          >
            Close
          </button>
        </header>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
            {message}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-sm text-slate-500">Loading payments...</p>
        ) : (
          <>
            {statement && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Adjusted Outstanding", statement.summary.total_outstanding],
                  ["Verified Payments", statement.summary.verified_paid],
                  ["Overpayment", statement.summary.overpayment],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 font-bold text-[#263956]">
                      {formatMoney(value, statement.currency || currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {canRecord && eligibleRental && (
              <form
                onSubmit={(event) => void recordPayment(event)}
                className="mt-6 rounded-xl border border-slate-200 p-4"
              >
                <h3 className="mb-3 font-bold text-[#263956]">
                  Record a Pending Payment
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Payment Method
                    <select
                      value={method}
                      onChange={(event) => setMethod(event.target.value)}
                      disabled={busy}
                      className={`mt-1 ${inputClass}`}
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    Amount ({currency})
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={busy}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>

                  <label className="text-sm">
                    Transaction Reference
                    <input
                      type="text"
                      maxLength={150}
                      required={method !== "cash"}
                      value={transactionReference}
                      onChange={(event) =>
                        setTransactionReference(event.target.value)
                      }
                      disabled={busy}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>

                  <label className="text-sm">
                    Payment Date
                    <input
                      type="date"
                      required
                      max={new Date().toLocaleDateString("en-CA")}
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      disabled={busy}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                </div>

                <label className="mt-3 block text-sm">
                  Notes (Optional)
                  <textarea
                    rows={2}
                    maxLength={3000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={busy}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>

                <p className="my-3 text-xs text-slate-500">
                  The payment remains pending until evidence is reviewed.
                  Laravel validates the adjusted outstanding balance.
                </p>

                <button type="submit" disabled={busy} className={primaryClass}>
                  {busy ? "Processing..." : "Record Pending Payment"}
                </button>
              </form>
            )}

            <section className="mt-6">
              <h3 className="font-bold text-[#263956]">Payment Records</h3>

              {payments.length === 0 ? (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No rental payments recorded.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-3">Payment</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="p-3">
                            <p className="font-semibold">{payment.reference}</p>
                            <p className="text-xs text-slate-500">
                              {dateOnly(payment.payment_date)}
                            </p>
                          </td>
                          <td className="p-3 capitalize">
                            {readable(payment.payment_method)}
                          </td>
                          <td className="p-3">
                            {formatMoney(payment.amount, payment.currency)}
                          </td>
                          <td className="p-3 capitalize">
                            {readable(payment.status)}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              disabled={busy}
                              className={buttonClass}
                              onClick={() => {
                                setSelectedPayment(payment.id);
                                setError("");
                                setMessage("");
                                setRejectReason("");
                                setReceipt(null);
                              }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {selected && (
              <section className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#263956]">
                      {selected.reference}
                    </h3>
                    <p className="text-xs capitalize text-slate-500">
                      {readable(selected.status)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedPayment(null)}
                    className={buttonClass}
                  >
                    Hide Details
                  </button>
                </div>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p>Recorded by: {selected.recorder?.name || "—"}</p>
                  <p>Reviewed by: {selected.verifier?.name || "—"}</p>
                  <p>Transaction: {selected.transaction_reference || "—"}</p>
                  <p>Date: {dateOnly(selected.payment_date)}</p>
                </div>

                {selected.rejection_reason && (
                  <p className="mt-3 text-sm text-red-700">
                    Rejection reason: {selected.rejection_reason}
                  </p>
                )}

                <h4 className="mt-5 font-semibold">Payment Evidence</h4>

                {detailsLoading ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Loading evidence and history...
                  </p>
                ) : evidences.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No receipts uploaded.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {evidences.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <span className="break-all">
                          {evidence.original_name}
                        </span>
                        <a
                          href={`${RECEIPTS}/${rentalId}/${selected.id}/${evidence.id}/download`}
                          className="font-semibold text-blue-700 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {canRecord && selected.status === "pending" && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={busy}
                      onChange={(event) =>
                        setReceipt(event.target.files?.[0] || null)
                      }
                      className="max-w-full text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !receipt}
                      onClick={() => void uploadReceipt()}
                      className={buttonClass}
                    >
                      Upload Receipt
                    </button>
                  </div>
                )}

                {canReview && selected.status === "pending" && (
                  <div className="mt-5 space-y-3 border-t pt-4">
                    <button
                      type="button"
                      disabled={busy || detailsLoading || evidences.length === 0}
                      onClick={() => void reviewPayment("verify")}
                      className={primaryClass}
                    >
                      Verify Payment
                    </button>

                    <label className="block text-sm">
                      Rejection Reason
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={rejectReason}
                        onChange={(event) =>
                          setRejectReason(event.target.value)
                        }
                        disabled={busy}
                        className={`mt-1 ${inputClass}`}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={busy || rejectReason.trim().length < 5}
                      onClick={() => void reviewPayment("reject")}
                      className={buttonClass}
                    >
                      Reject Payment
                    </button>
                  </div>
                )}

                <h4 className="mt-5 border-t pt-4 font-semibold">
                  Payment Audit History
                </h4>

                {history.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No history available.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <p className="font-semibold capitalize">
                          {readable(entry.from_status)} →{" "}
                          {readable(entry.to_status)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.changed_by?.name || "System"}
                          {entry.created_at
                            ? ` • ${dateOnly(entry.created_at)}`
                            : ""}
                        </p>
                        {entry.notes && <p className="mt-1">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
