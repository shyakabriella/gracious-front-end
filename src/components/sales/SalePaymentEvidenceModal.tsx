"use client";

import { useEffect, useState } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Sale = {
  id: number;
  reference: string;
  status: string;
  agent?: { id: number; name: string } | null;
};

type Payment = {
  id: number;
  reference: string;
  status: string;
  amount: string;
  currency: string;
};

type Evidence = {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploader?: { name: string } | null;
};

type Props = {
  account: Account;
  sale: Sale;
  payment: Payment;
  onClose: () => void;
  onChanged: (message: string) => void;
};

const API = "/api/dashboard/manage";
const PRIVATE = "/api/dashboard/sale-payment-evidence";

function errorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const data = value as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (data.errors && typeof data.errors === "object") {
    for (const field of Object.values(data.errors)) {
      if (Array.isArray(field)) {
        const first = field.find(
          (item): item is string => typeof item === "string",
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
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorMessage(
        data,
        `Request failed (HTTP ${response.status}).`,
      ),
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Unexpected Laravel response.");
  }

  return data as T;
}

export default function SalePaymentEvidenceModal({
  account,
  sale,
  payment,
  onClose,
  onChanged,
}: Props) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const isAssignedAgent =
    account.roles.includes("agent") &&
    sale.agent?.id === account.id;

  const isActiveSale =
    ["agreement", "pending_completion"].includes(sale.status);

  const canUpload =
    (isAdmin || isAssignedAgent) &&
    isActiveSale &&
    payment.status === "pending";

  const canReview =
    isAdmin &&
    isActiveSale &&
    payment.status === "pending";

  const base = `${API}/sales/${sale.id}/payments/${payment.id}`;
  const privateBase = `${PRIVATE}/${sale.id}/${payment.id}`;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoaded(false);
      setError("");

      try {
        const response = await fetch(`${base}/evidences`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readResponse<{
          evidences: Evidence[];
        }>(response);

        if (!Array.isArray(result.evidences)) {
          throw new Error("Invalid evidence listing response.");
        }

        if (!controller.signal.aborted) {
          setEvidences(result.evidences);
          setLoaded(true);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setEvidences([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load payment evidence.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [base, reloadKey]);

  async function upload() {
    if (!canUpload || busy || !file) return;

    setError("");
    setMessage("");

    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("Select a non-empty file of 5 MB or less.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      setError("Only PDF, JPG, JPEG and PNG receipts are supported.");
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.append("file", file, file.name);

      const response = await fetch(privateBase, {
        method: "POST",
        body: form,
      });

      const result = await readResponse<{
        evidence?: { id?: number };
      }>(response);

      if (!result.evidence?.id) {
        throw new Error(
          "Evidence upload response was unexpected. " +
          "Refresh the evidence list before retrying.",
        );
      }

      setFile(null);
      setFileKey((value) => value + 1);
      setMessage("Payment evidence uploaded successfully.");
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Upload failed. Refresh evidence before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "verify" | "reject") {
    if (!canReview || !loaded || loading || busy) return;

    setError("");
    setMessage("");

    if (action === "verify" && evidences.length === 0) {
      setError("Upload supporting evidence before verification.");
      return;
    }

    if (action === "reject" && !reason.trim()) {
      setError("Provide a reason for rejecting this payment.");
      return;
    }

    if (reason.length > 2000) {
      setError("Rejection reason must not exceed 2,000 characters.");
      return;
    }

    if (
      !window.confirm(
        `${action === "verify" ? "VERIFY" : "REJECT"} ` +
        `${payment.reference}?\n\n` +
        (action === "verify"
          ? "This will count the payment toward the sale balance."
          : "The payment will be marked as rejected."),
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`${base}/${action}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "reject" ? { reason: reason.trim() } : {},
        ),
      });

      const result = await readResponse<{
        payment?: { id?: number; status?: string };
      }>(response);

      const expected = action === "verify" ? "verified" : "rejected";

      if (
        result.payment?.id !== payment.id ||
        result.payment.status !== expected
      ) {
        throw new Error(
          "The review response was unexpected. " +
          "Refresh the payment list before attempting another action.",
        );
      }

      onChanged(
        action === "verify"
          ? "Payment verified successfully by Laravel."
          : "Payment rejected successfully.",
      );

      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Payment review failed. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sale payment evidence and review"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#263956]">
              Payment Evidence & Review
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {payment.reference} · {payment.status}
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Close
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

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[#263956]">
              Supporting receipts
            </h3>

            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setReloadKey((value) => value + 1)}
              className="text-xs font-semibold text-blue-700 disabled:opacity-40"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">
              Loading evidence...
            </p>
          ) : loaded && evidences.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No payment evidence uploaded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {evidences.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="break-all text-sm font-semibold">
                    {item.original_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {(item.file_size / 1024).toFixed(1)} KB
                    {item.uploader?.name
                      ? ` · Uploaded by ${item.uploader.name}`
                      : ""}
                  </p>

                  <a
                    href={`${privateBase}/${item.id}/download`}
                    className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
                  >
                    Download receipt
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {canUpload && (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <label className="block text-sm font-semibold text-slate-700">
              Upload payment receipt
              <input
                key={fileKey}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={busy}
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                className="mt-2 block w-full text-sm"
              />
            </label>

            <button
              type="button"
              disabled={busy || !file}
              onClick={() => void upload()}
              className="mt-3 rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Processing..." : "Upload Evidence"}
            </button>
          </div>
        )}

        {canReview && (
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-[#263956]">
              Administrator Payment Review
            </h3>

            <p className="text-xs text-slate-500">
              Only authorized administrators can verify or reject
              a pending payment. Verification requires evidence.
            </p>

            <button
              type="button"
              disabled={busy || loading || !loaded || evidences.length === 0}
              onClick={() => void review("verify")}
              className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Verify Payment
            </button>

            <label className="block text-sm font-semibold text-slate-700">
              Rejection reason
              <textarea
                rows={3}
                maxLength={2000}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this payment is rejected."
                className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </label>

            <button
              type="button"
              disabled={busy || loading || !loaded || !reason.trim()}
              onClick={() => void review("reject")}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
            >
              Reject Payment
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
