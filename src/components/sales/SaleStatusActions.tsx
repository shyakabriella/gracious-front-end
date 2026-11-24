"use client";

import { useState } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Sale = {
  id: number;
  reference: string;
  status: string;
  agent?: {
    id: number;
    name: string;
  } | null;
};

type Action = "agreement" | "pending-completion" | "cancel";

type Props = {
  sale: Sale;
  account: Account;
  onChanged: (message: string) => void;
};

const API = "/api/dashboard/manage";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

const buttonClass =
  "rounded-lg border border-slate-300 px-4 py-2 " +
  "text-sm font-semibold text-[#263956] " +
  "hover:bg-slate-50 disabled:opacity-40";

function errorMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== "object") {
    return fallback;
  }

  const data = result as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (data.errors && typeof data.errors === "object") {
    for (const value of Object.values(data.errors)) {
      if (Array.isArray(value)) {
        const first = value.find(
          (item): item is string =>
            typeof item === "string",
        );

        if (first) return first;
      }
    }
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return fallback;
}

export default function SaleStatusActions({
  sale,
  account,
  onChanged,
}: Props) {
  const [agreementDate, setAgreementDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const isAssignedAgent =
    account.roles.includes("agent") &&
    sale.agent?.id === account.id;

  const canConfirmAgreement =
    isAdmin && sale.status === "negotiation";

  const canMovePending =
    isAdmin && sale.status === "agreement";

  const canCancel =
    (isAdmin &&
      ["negotiation", "agreement", "pending_completion"].includes(
        sale.status,
      )) ||
    (isAssignedAgent && sale.status === "negotiation");

  if (!canConfirmAgreement && !canMovePending && !canCancel) {
    return null;
  }

  async function changeStatus(action: Action) {
    if (busy) return;

    setError("");

    if (action === "agreement") {
      if (!canConfirmAgreement) return;

      if (!agreementDate) {
        setError("Select the date the agreement was signed.");
        return;
      }
    }

    if (action === "pending-completion" && !canMovePending) {
      return;
    }

    if (action === "cancel") {
      if (!canCancel) return;

      if (!reason.trim()) {
        setError("Provide a reason for cancelling this sale.");
        return;
      }
    }

    if (notes.length > 3000 || reason.length > 2000) {
      setError("The notes or cancellation reason is too long.");
      return;
    }

    const expectedStatus =
      action === "pending-completion"
        ? "pending_completion"
        : action === "cancel"
          ? "cancelled"
          : "agreement";

    const description =
      action === "agreement"
        ? "confirm the signed agreement"
        : action === "pending-completion"
          ? "move this sale to pending completion"
          : "cancel this property sale";

    if (
      !window.confirm(
        `Are you sure you want to ${description}?\n\n` +
          `Sale: ${sale.reference}\n` +
          `Current status: ${sale.status}`,
      )
    ) {
      return;
    }

    let payload: Record<string, string>;

    if (action === "agreement") {
      payload = {
        agreement_date: agreementDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
    } else if (action === "pending-completion") {
      payload = notes.trim()
        ? { notes: notes.trim() }
        : {};
    } else {
      payload = {
        reason: reason.trim(),
      };
    }

    setBusy(true);

    try {
      const response = await fetch(
        `${API}/sales/${sale.id}/${action}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result: unknown = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            result,
            `Sale update rejected (HTTP ${response.status}).`,
          ),
        );
      }

      const data = result as {
        sale?: {
          status?: string;
        };
      } | null;

      if (data?.sale?.status !== expectedStatus) {
        throw new Error(
          "The backend response was unexpected. " +
            "Refresh the sales list before trying again.",
        );
      }

      const success =
        action === "agreement"
          ? "Sale agreement confirmed successfully."
          : action === "pending-completion"
            ? "Sale moved to pending completion."
            : "Sale cancelled successfully.";

      onChanged(success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update the sale.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-base font-bold text-[#263956]">
        Sale Agreement & Status Management
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Status changes are validated and recorded by Laravel.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {(canConfirmAgreement || canMovePending) && (
        <div className="mt-4 space-y-3">
          {canConfirmAgreement && (
            <div>
              <label
                htmlFor="sale-agreement-date"
                className="block text-sm font-semibold text-slate-700"
              >
                Signed agreement date
              </label>

              <input
                id="sale-agreement-date"
                type="date"
                value={agreementDate}
                onChange={(event) =>
                  setAgreementDate(event.target.value)
                }
                disabled={busy}
                className={`mt-2 ${inputClass}`}
              />

              <p className="mt-1 text-xs text-slate-500">
                The date must not be in the future.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="sale-status-notes"
              className="block text-sm font-semibold text-slate-700"
            >
              Workflow notes (optional)
            </label>

            <textarea
              id="sale-status-notes"
              rows={3}
              maxLength={3000}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              disabled={busy}
              className={`mt-2 ${inputClass}`}
            />
          </div>

          <button
            type="button"
            disabled={
              busy ||
              (canConfirmAgreement && !agreementDate)
            }
            onClick={() =>
              void changeStatus(
                canConfirmAgreement
                  ? "agreement"
                  : "pending-completion",
              )
            }
            className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy
              ? "Updating..."
              : canConfirmAgreement
                ? "Confirm Agreement"
                : "Move to Pending Completion"}
          </button>
        </div>
      )}

      {canCancel && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <label
            htmlFor="sale-cancel-reason"
            className="block text-sm font-semibold text-slate-700"
          >
            Cancellation reason
          </label>

          <textarea
            id="sale-cancel-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            disabled={busy}
            placeholder="Explain why this sale is being cancelled."
            className={`mt-2 ${inputClass}`}
          />

          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void changeStatus("cancel")}
            className={`mt-3 ${buttonClass}`}
          >
            Cancel Sale
          </button>
        </div>
      )}
    </section>
  );
}
