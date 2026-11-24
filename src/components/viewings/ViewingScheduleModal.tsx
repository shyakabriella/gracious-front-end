"use client";

import { useEffect, useState, type FormEvent } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Lead = {
  id: number;
  reference: string;
  subject?: string | null;
  status: string;
  property_id: number | null;
  assigned_agent_id: number | null;
  property?: {
    id: number;
    reference: string;
    title: string;
  } | null;
  customer?: {
    id: number;
    name: string;
    phone?: string | null;
  } | null;
  assigned_agent?: {
    id: number;
    name: string;
  } | null;
};

type LeadPage = {
  data: Lead[];
  current_page: number;
  last_page: number;
  total: number;
};

type Props = {
  account: Account;
  onClose: () => void;
  onCreated: () => void;
};

const API = "/api/dashboard/manage";

function errorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") {
    return fallback;
  }

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

async function readResponse<T>(
  response: Response,
): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorMessage(
        data,
        `Request rejected (HTTP ${response.status}).`,
      ),
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Unexpected Laravel response.");
  }

  return data as T;
}

function eligibleLead(lead: Lead, account: Account): boolean {
  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  return (
    typeof lead.property_id === "number" &&
    lead.property_id > 0 &&
    typeof lead.assigned_agent_id === "number" &&
    lead.assigned_agent_id > 0 &&
    !["won", "lost"].includes(lead.status) &&
    (isAdmin || lead.assigned_agent_id === account.id)
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

export default function ViewingScheduleModal({
  account,
  onClose,
  onCreated,
}: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<LeadPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submissionUncertain, setSubmissionUncertain] =
    useState(false);

  const canSearch = account.permissions.includes("leads.view");

  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const isAgent = account.roles.includes("agent") && !isAdmin;

  useEffect(() => {
    if (!canSearch) return;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      async function loadLeads() {
        setLoading(true);
        setSearchError("");

        try {
          const params = new URLSearchParams({
            per_page: "50",
            page: String(page),
          });

          if (search.trim()) {
            params.set("search", search.trim());
          }

          if (isAgent) {
            params.set(
              "assigned_agent_id",
              String(account.id),
            );
          }

          const response = await fetch(
            `${API}/leads?${params}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );

          const result = await readResponse<LeadPage>(
            response,
          );

          if (
            !Array.isArray(result.data) ||
            typeof result.total !== "number"
          ) {
            throw new Error("Unexpected leads response.");
          }

          if (!controller.signal.aborted) {
            setRecords(result);
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            setRecords(null);
            setSearchError(
              cause instanceof Error
                ? cause.message
                : "Unable to load leads.",
            );
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }

      void loadLeads();
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, canSearch, isAgent, account.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      busy ||
      submissionUncertain ||
      !canSearch ||
      !selectedLead ||
      !eligibleLead(selectedLead, account)
    ) {
      return;
    }

    setError("");

    const startDate = new Date(start);
    const endDate = new Date(end);

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime)
    ) {
      setError("Select valid appointment start and end times.");
      return;
    }

    if (startTime <= Date.now()) {
      setError("The appointment must start in the future.");
      return;
    }

    if (endTime <= startTime) {
      setError("The end time must be later than the start time.");
      return;
    }

    if (endTime - startTime > 4 * 60 * 60 * 1000) {
      setError("A property viewing cannot exceed four hours.");
      return;
    }

    if (notes.length > 3000) {
      setError("Notes must not exceed 3,000 characters.");
      return;
    }

    const propertyId = selectedLead.property_id;

    if (!propertyId) {
      setError("The selected lead has no matching property.");
      return;
    }

    if (
      !window.confirm(
        "SCHEDULE PROPERTY VIEWING?\n\n" +
          `Lead: ${selectedLead.reference}\n` +
          `Customer: ${selectedLead.customer?.name || "—"}\n` +
          `Property: ${selectedLead.property?.title || "—"}\n` +
          `Start: ${startDate.toLocaleString()}\n` +
          `End: ${endDate.toLocaleString()}\n\n` +
          "Laravel will check the assigned agent and overlapping appointments.",
      )
    ) {
      return;
    }

    setBusy(true);

    let response: Response;

    try {
      response = await fetch(`${API}/viewings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          property_id: propertyId,
          scheduled_start_at: startDate.toISOString(),
          scheduled_end_at: endDate.toISOString(),
          ...(notes.trim()
            ? { notes: notes.trim() }
            : {}),
        }),
      });
    } catch {
      setSubmissionUncertain(true);
      setError(
        "The appointment request may have reached Laravel. " +
          "Check the Viewings list before submitting again.",
      );
      setBusy(false);
      return;
    }

    try {
      if (response.status >= 500) {
        setSubmissionUncertain(true);
      }

      const result = await readResponse<{
        viewing?: {
          id?: number;
          status?: string;
          lead_id?: number;
          property_id?: number;
        };
      }>(response);

      if (
        !result.viewing?.id ||
        result.viewing.status !== "requested" ||
        result.viewing.lead_id !== selectedLead.id ||
        result.viewing.property_id !== propertyId
      ) {
        setSubmissionUncertain(true);
        throw new Error(
          "Unexpected appointment response. " +
            "Check the Viewings list before retrying.",
        );
      }

      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to schedule the viewing.",
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
        aria-label="Schedule property viewing"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#263956]">
              Schedule Property Viewing
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a lead, then choose the appointment date and time.
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

        {!canSearch && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          >
            Your account needs the leads.view permission to select
            an existing lead. Contact your administrator.
          </p>
        )}

        {canSearch && (
          <form onSubmit={(event) => void submit(event)}>
            <div className="mt-6">
              <label
                htmlFor="viewing-lead-search"
                className="block text-sm font-semibold text-slate-700"
              >
                Search for customer or lead
              </label>

              <input
                id="viewing-lead-search"
                type="search"
                value={search}
                maxLength={100}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                disabled={busy}
                placeholder="Customer name, phone, lead reference..."
                className={`mt-2 ${inputClass}`}
              />

              <p className="mt-2 text-xs text-slate-500">
                Only open leads with a matching property and assigned
                agent can be selected.
              </p>
            </div>

            {searchError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {searchError}
              </p>
            )}

            <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
              {loading ? (
                <p className="p-3 text-sm text-slate-500">
                  Searching leads...
                </p>
              ) : records?.data.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  No matching leads found.
                </p>
              ) : (
                records?.data.map((lead) => {
                  const eligible = eligibleLead(lead, account);
                  const chosen = selectedLead?.id === lead.id;

                  return (
                    <button
                      key={lead.id}
                      type="button"
                      disabled={!eligible || busy}
                      onClick={() => setSelectedLead(lead)}
                      className={
                        "w-full rounded-lg border p-3 text-left text-sm " +
                        (chosen
                          ? "border-blue-500 bg-blue-50 "
                          : "border-slate-200 bg-white ") +
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      }
                    >
                      <span className="block font-semibold text-[#263956]">
                        {lead.reference} ·{" "}
                        {lead.customer?.name || "Unknown customer"}
                      </span>

                      <span className="mt-1 block text-xs text-slate-600">
                        {lead.property?.title || "No property"}
                        {" · "}
                        {lead.assigned_agent?.name ||
                          "No assigned agent"}
                        {" · "}
                        {lead.status}
                      </span>

                      {!eligible && (
                        <span className="mt-1 block text-xs text-red-700">
                          Not eligible for scheduling
                        </span>
                      )}

                      {chosen && (
                        <span className="mt-1 block text-xs font-semibold text-blue-700">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {records && records.last_page > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={loading || busy || page <= 1}
                  onClick={() =>
                    setPage((value) => Math.max(1, value - 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-xs text-slate-600">
                  Page {records.current_page} of {records.last_page}
                </span>

                <button
                  type="button"
                  disabled={
                    loading ||
                    busy ||
                    page >= records.last_page
                  }
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}

            {selectedLead && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-[#263956]">
                  Selected Appointment Details
                </h3>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-semibold">
                      {selectedLead.customer?.name || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Lead reference</p>
                    <p className="font-semibold">
                      {selectedLead.reference}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Property (automatically matched)
                    </p>
                    <p className="font-semibold">
                      {selectedLead.property?.title || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Assigned agent</p>
                    <p className="font-semibold">
                      {selectedLead.assigned_agent?.name || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Appointment start
                <input
                  type="datetime-local"
                  required
                  disabled={busy}
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Appointment end
                <input
                  type="datetime-local"
                  required
                  disabled={busy}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </label>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Appointments must start in the future and last
              no longer than four hours.
            </p>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Viewing notes (optional)
              <textarea
                rows={3}
                maxLength={3000}
                value={notes}
                disabled={busy}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Meeting instructions or important details..."
                className={`mt-2 ${inputClass}`}
              />
            </label>

            {submissionUncertain && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
              >
                This request may have reached Laravel. Close this form
                and check the Viewings list before scheduling again.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  busy ||
                  submissionUncertain ||
                  !selectedLead ||
                  !eligibleLead(selectedLead, account) ||
                  !start ||
                  !end
                }
                className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Scheduling..." : "Schedule Appointment"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
