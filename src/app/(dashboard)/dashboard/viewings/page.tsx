"use client";

import { useEffect, useState } from "react";
import ViewingScheduleModal from "@/components/viewings/ViewingScheduleModal";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type ViewingStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type Viewing = {
  id: number;
  reference: string;
  status: ViewingStatus;
  lead_id: number;
  property_id: number;
  agent_id: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  notes: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  lead?: {
    reference: string;
    customer?: {
      name: string;
      phone?: string | null;
      email?: string | null;
    } | null;
  } | null;
  property?: {
    reference: string;
    title: string;
  } | null;
  agent?: {
    id: number;
    name: string;
  } | null;
  creator?: {
    name: string;
  } | null;
};

type ViewingPage = {
  data: Viewing[];
  current_page: number;
  last_page: number;
  total: number;
};

type History = {
  id: number;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  changed_by_name: string;
  created_at: string;
};

type Action = "confirm" | "cancel" | "complete" | "no-show";

const API = "/api/dashboard/manage";

const statuses = [
  "all",
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;

  const result = value as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (result.errors && typeof result.errors === "object") {
    for (const errors of Object.values(result.errors)) {
      if (Array.isArray(errors)) {
        const first = errors.find(
          (item): item is string => typeof item === "string",
        );

        if (first) return first;
      }
    }
  }

  return typeof result.message === "string"
    ? result.message
    : fallback;
}

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorMessage(
        result,
        `Request rejected (HTTP ${response.status}).`,
      ),
    );
  }

  if (!result || typeof result !== "object") {
    throw new Error("Unexpected response from Laravel.");
  }

  return result as T;
}

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [records, setRecords] = useState<ViewingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Viewing | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRefresh, setDetailRefresh] = useState(0);

  const [reason, setReason] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState("");
  const [notice, setNotice] = useState("");

  const canView =
    !!account &&
    account.permissions.includes("viewings.view") &&
    account.roles.some((role) =>
      ["super_admin", "admin", "agent"].includes(role),
    );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const result = await requestJson<{ user: Account }>(
          "/api/auth/me",
          { signal: controller.signal },
        );

        if (
          !result.user ||
          !Array.isArray(result.user.roles) ||
          !Array.isArray(result.user.permissions)
        ) {
          throw new Error("Unable to verify account permissions.");
        }

        if (!controller.signal.aborted) {
          setAccount(result.user);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAuthError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your account.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setAuthLoading(false);
      }
    }

    void loadAccount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canView) return;

    const controller = new AbortController();

    async function loadViewings() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: "15",
        });

        if (status !== "all") {
          params.set("status", status);
        }

        const result = await requestJson<ViewingPage>(
          `${API}/viewings?${params}`,
          { signal: controller.signal },
        );

        if (
          !Array.isArray(result.data) ||
          typeof result.total !== "number"
        ) {
          throw new Error("Unexpected viewing list response.");
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
              : "Unable to load viewings.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadViewings();
    return () => controller.abort();
  }, [canView, status, page, refreshKey]);

  useEffect(() => {
    if (!canView || selectedId === null) return;

    const controller = new AbortController();

    async function loadDetails() {
      setDetailLoading(true);
      setDetailError("");

      try {
        const [detailResult, historyResult] = await Promise.all([
          requestJson<{ viewing: Viewing }>(
            `${API}/viewings/${selectedId}`,
            { signal: controller.signal },
          ),
          requestJson<{ history: History[] }>(
            `${API}/viewings/${selectedId}/history`,
            { signal: controller.signal },
          ),
        ]);

        if (
          detailResult.viewing?.id !== selectedId ||
          !Array.isArray(historyResult.history)
        ) {
          throw new Error("Unexpected viewing details response.");
        }

        if (!controller.signal.aborted) {
          setSelected(detailResult.viewing);
          setHistory(historyResult.history);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setSelected(null);
          setHistory([]);
          setDetailError(
            cause instanceof Error
              ? cause.message
              : "Unable to load viewing details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [canView, selectedId, detailRefresh]);

  async function updateStatus(action: Action) {
    if (!selected || busy) return;

    const isAdmin = account?.roles.some((role) =>
      ["super_admin", "admin"].includes(role),
    );

    const isAssignedAgent =
      account?.roles.includes("agent") &&
      selected.agent_id === account.id;

    if (!isAdmin && !isAssignedAgent) return;

    const allowed =
      (selected.status === "requested" &&
        ["confirm", "cancel"].includes(action)) ||
      (selected.status === "confirmed" &&
        ["complete", "cancel", "no-show"].includes(action));

    if (!allowed) return;

    setDetailError("");

    if (action === "cancel" && !reason.trim()) {
      setDetailError("Enter a cancellation reason.");
      return;
    }

    if (reason.length > 2000 || completionNotes.length > 3000) {
      setDetailError("The reason or notes are too long.");
      return;
    }

    if (
      ["complete", "no-show"].includes(action) &&
      Date.now() < new Date(selected.scheduled_start_at).getTime()
    ) {
      setDetailError(
        "The scheduled viewing start time has not yet arrived.",
      );
      return;
    }

    const expected =
      action === "no-show" ? "no_show" :
      action === "confirm" ? "confirmed" :
      action === "cancel" ? "cancelled" : "completed";

    if (
      !window.confirm(
        `Change viewing ${selected.reference} to ` +
        `${readable(expected).toUpperCase()}?\n\n` +
        "This change will be recorded in the audit history.",
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const payload =
        action === "cancel"
          ? { reason: reason.trim() }
          : action === "complete"
            ? {
                ...(completionNotes.trim()
                  ? { notes: completionNotes.trim() }
                  : {}),
              }
            : {};

      const result = await requestJson<{
        viewing: Viewing;
        message?: string;
      }>(
        `${API}/viewings/${selected.id}/${action}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (
        result.viewing?.id !== selected.id ||
        result.viewing.status !== expected
      ) {
        throw new Error(
          "Unexpected response. Refresh the viewing before retrying.",
        );
      }

      setNotice(
        `Viewing ${selected.reference} updated to ${readable(expected)}.`,
      );

      setReason("");
      setCompletionNotes("");
      setSelected(result.viewing);
      setRefreshKey((value) => value + 1);
      setDetailRefresh((value) => value + 1);
    } catch (cause) {
      setDetailError(
        cause instanceof Error
          ? cause.message
          : "Unable to update viewing.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openDetails(id: number) {
    setSelectedId(id);
    setSelected(null);
    setHistory([]);
    setNotice("");
    setDetailError("");
    setReason("");
    setCompletionNotes("");
  }

  function closeDetails() {
    if (busy) return;
    setSelectedId(null);
    setSelected(null);
    setHistory([]);
    setNotice("");
  }

  const isAdmin = account?.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const canManageSelected =
    !!selected &&
    (isAdmin ||
      (account?.roles.includes("agent") &&
        selected.agent_id === account.id));

  const hasStarted =
    !!selected &&
    Number.isFinite(new Date(selected.scheduled_start_at).getTime()) &&
    Date.now() >= new Date(selected.scheduled_start_at).getTime();

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#263956]">
            Property Viewings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage property appointments, confirmations, outcomes and history.
          </p>
        </div>

        {canView && account && (
          <button
            type="button"
            onClick={() => {
              setScheduleNotice("");
              setScheduleOpen(true);
            }}
            className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white"
          >
            + Schedule Viewing
          </button>
        )}

        {canView && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setRefreshKey((value) => value + 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Refresh Viewings
          </button>
        )}
      </div>

      {authLoading ? (
        <p className="mt-6 text-sm text-slate-500">
          Checking your permissions...
        </p>
      ) : authError ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {authError}
        </p>
      ) : !canView ? (
        <p className="mt-6 rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
          Your account does not have access to Property Viewings.
        </p>
      ) : (
        <>
          {scheduleNotice && (
            <p
              role="status"
              className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              {scheduleNotice}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-slate-700">
              Filter by status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="mt-2 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? "All Viewings" : readable(item)}
                  </option>
                ))}
              </select>
            </label>

            {records && (
              <p className="pb-2 text-sm text-slate-500">
                Total: {records.total} appointments
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-5 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">
              Loading appointments...
            </p>
          ) : records?.data.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
              No property viewings match this filter.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {records?.data.map((viewing) => (
                <article
                  key={viewing.id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#263956]">
                        {viewing.reference}
                      </p>
                      <p className="mt-1 text-base font-semibold">
                        {viewing.property?.title || "Property unavailable"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">
                      {readable(viewing.status)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      <span className="text-slate-500">Buyer:</span>{" "}
                      {viewing.lead?.customer?.name || "—"}
                    </p>
                    <p>
                      <span className="text-slate-500">Agent:</span>{" "}
                      {viewing.agent?.name || "—"}
                    </p>
                    <p>
                      <span className="text-slate-500">Start:</span>{" "}
                      {dateTime(viewing.scheduled_start_at)}
                    </p>
                    <p>
                      <span className="text-slate-500">End:</span>{" "}
                      {dateTime(viewing.scheduled_end_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDetails(viewing.id)}
                    className="mt-5 rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white"
                  >
                    View Appointment Details
                  </button>
                </article>
              ))}
            </div>
          )}

          {records && records.last_page > 1 && (
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-slate-600">
                Page {records.current_page} of {records.last_page}
              </span>

              <button
                type="button"
                disabled={loading || page >= records.last_page}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {scheduleOpen && account && (
        <ViewingScheduleModal
          account={account}
          onClose={() => setScheduleOpen(false)}
          onCreated={() => {
            setScheduleOpen(false);
            setScheduleNotice(
              "Property viewing scheduled successfully.",
            );
            setStatus("all");
            setPage(1);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}

      {selectedId !== null && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Viewing appointment details"
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#263956]">
                Viewing Appointment Details
              </h2>

              <button
                type="button"
                disabled={busy}
                onClick={closeDetails}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Close
              </button>
            </div>

            {notice && (
              <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                {notice}
              </p>
            )}

            {detailError && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {detailError}
              </p>
            )}

            {detailLoading ? (
              <p className="mt-6 text-sm text-slate-500">
                Loading appointment details...
              </p>
            ) : selected ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Reference</p>
                    <p className="font-bold">{selected.reference}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="font-semibold capitalize">
                      {readable(selected.status)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Property</p>
                    <p>{selected.property?.title || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p>{selected.lead?.customer?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Assigned agent</p>
                    <p>{selected.agent?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Lead</p>
                    <p>{selected.lead?.reference || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Scheduled start</p>
                    <p>{dateTime(selected.scheduled_start_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Scheduled end</p>
                    <p>{dateTime(selected.scheduled_end_at)}</p>
                  </div>
                </div>

                {selected.notes && (
                  <div>
                    <p className="text-sm font-semibold">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {selected.notes}
                    </p>
                  </div>
                )}

                {selected.cancellation_reason && (
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Cancellation reason
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {selected.cancellation_reason}
                    </p>
                  </div>
                )}

                {canManageSelected &&
                  ["requested", "confirmed"].includes(selected.status) && (
                    <div className="space-y-4 border-t border-slate-200 pt-5">
                      <h3 className="font-bold text-[#263956]">
                        Manage Appointment
                      </h3>

                      {selected.status === "requested" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void updateStatus("confirm")}
                          className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Confirm Appointment
                        </button>
                      )}

                      {selected.status === "confirmed" && (
                        <div className="space-y-3">
                          <label className="block text-sm font-semibold">
                            Completion notes (optional)
                            <textarea
                              value={completionNotes}
                              rows={2}
                              maxLength={3000}
                              disabled={busy}
                              onChange={(event) =>
                                setCompletionNotes(event.target.value)
                              }
                              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
                            />
                          </label>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={busy || !hasStarted}
                              onClick={() => void updateStatus("complete")}
                              className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                            >
                              Mark Completed
                            </button>

                            <button
                              type="button"
                              disabled={busy || !hasStarted}
                              onClick={() => void updateStatus("no-show")}
                              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                            >
                              Mark No-Show
                            </button>
                          </div>

                          {!hasStarted && (
                            <p className="text-xs text-slate-500">
                              Completion and no-show actions become available
                              after the scheduled start time.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="border-t border-slate-200 pt-4">
                        <label className="block text-sm font-semibold">
                          Cancellation reason
                          <textarea
                            value={reason}
                            rows={3}
                            maxLength={2000}
                            disabled={busy}
                            onChange={(event) =>
                              setReason(event.target.value)
                            }
                            placeholder="Explain the cancellation."
                            className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={busy || !reason.trim()}
                          onClick={() => void updateStatus("cancel")}
                          className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
                        >
                          Cancel Appointment
                        </button>
                      </div>
                    </div>
                  )}

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="font-bold text-[#263956]">
                    Appointment Status History
                  </h3>

                  {history.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No status changes recorded yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {history.map((entry) => (
                        <article
                          key={entry.id}
                          className="rounded-lg bg-slate-50 p-3 text-sm"
                        >
                          <p className="font-semibold capitalize">
                            {readable(entry.to_status)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {entry.changed_by_name} ·{" "}
                            {dateTime(entry.created_at)}
                          </p>
                          {entry.notes && (
                            <p className="mt-2 whitespace-pre-wrap text-slate-600">
                              {entry.notes}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                Appointment details are unavailable.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
