"use client";

import { useEffect, useState, type FormEvent } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Rental = {
  id: number;
  reference: string;
  status: string;
  start_date: string;
  end_date: string;
  currency: string;
  property?: { title: string } | null;
  customer?: { name: string } | null;
};

type StatusHistory = {
  id: number;
  from_status: string | null;
  to_status: string;
  notes?: string | null;
  changed_by?: number | { id?: number; name?: string } | null;
  changed_by_name?: string | null;
  created_at?: string | null;
};

type RentStatement = {
  currency: string;
  summary: {
    total_billed: string | number;
    total_credits: string | number;
    total_debits: string | number;
    net_billed: string | number;
    verified_paid: string | number;
    total_outstanding: string | number;
    overpayment: string | number;
  };
};

type Action = "activate" | "cancel" | "terminate" | "expire";

type Props = {
  account: Account;
  rentalId: number;
  rentalReference: string;
  onClose: () => void;
  onChanged: () => void;
};

const API = "/api/dashboard/manage";

const actionLabels: Record<Action, string> = {
  activate: "Activate Lease",
  cancel: "Cancel Draft",
  terminate: "Terminate Lease",
  expire: "Close Expired Lease",
};

const expectedStatuses: Record<Action, string> = {
  activate: "active",
  cancel: "cancelled",
  terminate: "terminated",
  expire: "expired",
};

const buttonClass =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm " +
  "font-semibold text-[#263956] disabled:cursor-not-allowed " +
  "disabled:opacity-40";

function readable(value: string | null | undefined): string {
  return value ? value.replaceAll("_", " ") : "—";
}

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—";
}

function money(value: string | number, currency: string): string {
  const raw = String(value);
  const [whole, fraction] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${currency} ${grouped}${fraction !== undefined ? "." + fraction : ""}`;
}

function messageFrom(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;

  const data = value as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (data.errors && typeof data.errors === "object") {
    for (const entries of Object.values(data.errors)) {
      if (Array.isArray(entries)) {
        const first = entries.find(
          (item): item is string => typeof item === "string",
        );
        if (first) return first;
      }
    }
  }

  return typeof data.message === "string" ? data.message : fallback;
}

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    cache: "no-store",
    ...options,
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      messageFrom(result, `Request failed (HTTP ${response.status}).`),
    );
  }

  if (!result || typeof result !== "object") {
    throw new Error("Unexpected Laravel response.");
  }

  return result as T;
}

function actorName(entry: StatusHistory): string {
  if (entry.changed_by_name) return entry.changed_by_name;

  if (
    entry.changed_by &&
    typeof entry.changed_by === "object" &&
    typeof entry.changed_by.name === "string"
  ) {
    return entry.changed_by.name;
  }

  if (typeof entry.changed_by === "number") {
    return `Staff #${entry.changed_by}`;
  }

  return "Staff member";
}

export default function RentalLifecycleModal({
  account,
  rentalId,
  rentalReference,
  onClose,
  onChanged,
}: Props) {
  const [rental, setRental] = useState<Rental | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [statement, setStatement] = useState<RentStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [statementError, setStatementError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const canManage =
    account.permissions.includes("rentals.update") &&
    account.roles.some((role) =>
      ["super_admin", "admin", "property_manager"].includes(role),
    );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");
      setHistoryError("");
      setStatementError("");
      setRental(null);
      setStatement(null);
      setHistory([]);

      const options = { signal: controller.signal };

      const results = await Promise.allSettled([
        api<{ rental?: Rental }>(`/rentals/${rentalId}`, options),
        api<{ history?: StatusHistory[] }>(
          `/rentals/${rentalId}/history`,
          options,
        ),
        api<RentStatement | { statement?: RentStatement }>(
          `/rentals/${rentalId}/statement`,
          options,
        ),
      ]);

      if (!active || controller.signal.aborted) return;

      const detail = results[0];
      if (
        detail.status === "fulfilled" &&
        detail.value.rental?.id === rentalId
      ) {
        setRental(detail.value.rental);
      } else {
        setLoadError("Unable to load current lease status. Refresh before making changes.");
      }

      const historyResult = results[1];
      if (
        historyResult.status === "fulfilled" &&
        Array.isArray(historyResult.value.history)
      ) {
        setHistory(historyResult.value.history);
      } else {
        setHistoryError("Status history could not be loaded.");
      }

      const statementResult = results[2];
      if (statementResult.status === "fulfilled") {
        const value = statementResult.value;
        const data =
          "statement" in value && value.statement
            ? value.statement
            : value as RentStatement;

        if (data && data.summary && data.currency) {
          setStatement(data);
        } else {
          setStatementError("Financial statement response was incomplete.");
        }
      } else {
        setStatementError("Financial statement could not be loaded.");
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [rentalId, refresh]);

  const availableActions: Action[] =
    rental?.status === "draft"
      ? ["activate", "cancel"]
      : rental?.status === "active"
        ? ["terminate", "expire"]
        : [];

  function selectAction(next: Action) {
    setAction(next);
    setReason("");
    setMoveOutDate("");
    setConfirmed(false);
    setActionError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rental || !action || !canManage || busy) return;

    if (!availableActions.includes(action)) {
      setActionError("This action is not valid for the current lease status.");
      return;
    }

    if (!confirmed) {
      setActionError("Confirm that you understand this action.");
      return;
    }

    if (
      (action === "cancel" || action === "terminate") &&
      (reason.trim().length < 5 || reason.trim().length > 2000)
    ) {
      setActionError("Provide a reason between 5 and 2000 characters.");
      return;
    }

    if (action === "terminate" && !/^\d{4}-\d{2}-\d{2}$/.test(moveOutDate)) {
      setActionError("Provide the actual move-out date.");
      return;
    }

    const payload: Record<string, string> = {};

    if (action === "cancel" || action === "terminate") {
      payload.reason = reason.trim();
    }

    if (action === "terminate") {
      payload.move_out_date = moveOutDate;
    }

    setBusy(true);
    setActionError("");
    setNotice("");

    try {
      const result = await api<{
        message?: string;
        rental?: Rental;
      }>(`/rentals/${rentalId}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Do not assume a workflow succeeded unless Laravel
      // confirms the expected agreement and final status.
      if (
        result.rental?.id !== rentalId ||
        result.rental.status !== expectedStatuses[action]
      ) {
        setActionError(
          "The server response could not be verified. Refresh the lease before trying again.",
        );
        setRefresh((value) => value + 1);
        onChanged();
        return;
      }

      setRental(result.rental);
      setNotice(
        result.message || `${actionLabels[action]} completed successfully.`,
      );
      setAction(null);
      setReason("");
      setMoveOutDate("");
      setConfirmed(false);

      // Request fresh Laravel data after every status transition.
      // This also refreshes the statement after termination credits.
      setRefresh((value) => value + 1);
      onChanged();
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : "Unable to complete action.";

      setActionError(
        `${detail} Check the current lease status before submitting again.`,
      );
      setRefresh((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lease-lifecycle-title"
        className="mx-auto my-5 w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h2
              id="lease-lifecycle-title"
              className="text-xl font-bold text-[#263956]"
            >
              Lease Status &amp; History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {rental?.reference || rentalReference}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRefresh((value) => value + 1)}
              className={buttonClass}
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={buttonClass}
            >
              Close
            </button>
          </div>
        </header>

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}

        {loading && (
          <p className="mt-5 text-sm text-slate-500">
            Loading current lease, history and financial statement...
          </p>
        )}

        {loadError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </p>
        )}

        {rental && (
          <section className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Status", readable(rental.status)],
                ["Property", rental.property?.title || "—"],
                ["Tenant", rental.customer?.name || "—"],
                ["Lease Start", dateOnly(rental.start_date)],
                ["Lease End", dateOnly(rental.end_date)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-[#263956]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {canManage && availableActions.length > 0 && (
              <section className="mt-6 rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#263956]">Manage Lease Status</h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {availableActions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={busy || loading}
                      onClick={() => selectAction(item)}
                      className={
                        buttonClass +
                        (action === item
                          ? " border-blue-600 bg-blue-50"
                          : "")
                      }
                    >
                      {actionLabels[item]}
                    </button>
                  ))}
                </div>

                {action && (
                  <form onSubmit={submit} className="mt-5 space-y-4 border-t pt-4">
                    <h4 className="font-semibold text-[#263956]">
                      Confirm: {actionLabels[action]}
                    </h4>

                    {action === "activate" && (
                      <p className="text-sm text-slate-600">
                        Laravel will activate this lease, generate the rent
                        schedule, and mark the property as rented and unpublished.
                      </p>
                    )}

                    {action === "expire" && (
                      <p className="text-sm text-slate-600">
                        Laravel only permits expiration after the lease end date.
                        The property will become available but will not be
                        automatically republished.
                      </p>
                    )}

                    {action === "terminate" && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Important: Laravel will use the actual move-out date to
                        prorate rent and credit future unpaid rent. Original
                        billing schedules and verified payments are preserved.
                        The property will not be automatically republished.
                      </p>
                    )}

                    {(action === "cancel" || action === "terminate") && (
                      <label className="block text-sm font-semibold text-slate-700">
                        Reason for {action === "cancel" ? "cancellation" : "termination"}
                        <textarea
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          required
                          minLength={5}
                          maxLength={2000}
                          rows={3}
                          disabled={busy}
                          placeholder="Explain the reason (at least 5 characters)"
                          className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal"
                        />
                      </label>
                    )}

                    {action === "terminate" && (
                      <label className="block text-sm font-semibold text-slate-700">
                        Actual move-out date
                        <input
                          type="date"
                          value={moveOutDate}
                          onChange={(event) => setMoveOutDate(event.target.value)}
                          required
                          disabled={busy}
                          className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm font-normal sm:w-auto"
                        />
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          Enter the actual move-out date, not the scheduled
                          lease end date. Laravel validates this date.
                        </span>
                      </label>
                    )}

                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        disabled={busy}
                        className="mt-1"
                      />
                      <span>
                        I have checked this rental agreement and understand
                        the consequences of this status change.
                      </span>
                    </label>

                    {actionError && (
                      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {actionError}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy || !confirmed}
                        className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        {busy ? "Submitting..." : `Confirm ${actionLabels[action]}`}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setAction(null)}
                        className={buttonClass}
                      >
                        Back
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {actionError && !action && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}
          </section>
        )}

        <section className="mt-7">
          <h3 className="text-lg font-bold text-[#263956]">
            Financial Summary
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            These values come from Laravel's current rent statement.
          </p>

          {statementError && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {statementError}
            </p>
          )}

          {statement && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Original Billed", statement.summary.total_billed],
                ["Approved Credits", statement.summary.total_credits],
                ["Debits", statement.summary.total_debits],
                ["Adjusted Rent", statement.summary.net_billed],
                ["Verified Paid", statement.summary.verified_paid],
                ["Outstanding", statement.summary.total_outstanding],
                ["Overpayment", statement.summary.overpayment],
              ].map(([label, amount]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 font-bold text-[#263956]">
                    {money(amount, statement.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7 border-t pt-5">
          <h3 className="text-lg font-bold text-[#263956]">
            Status Change History
          </h3>

          {historyError && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {historyError}
            </p>
          )}

          {!loading && !historyError && history.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              No status changes have been recorded.
            </p>
          )}

          {history.length > 0 && (
            <div className="mt-3 space-y-3">
              {history.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-[#263956]">
                      {readable(entry.from_status)} → {readable(entry.to_status)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {entry.notes || "No additional notes."}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Changed by: {actorName(entry)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-7 flex justify-end border-t pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={buttonClass}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
