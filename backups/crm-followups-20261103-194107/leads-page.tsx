"use client";

import UnassignedLeadsInbox from "@/components/crm/UnassignedLeadsInbox";

import { ArchiveAction, ArchivedRecords } from "@/components/crm/ArchiveControls";


import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  apiError,
  readJson,
  type Customer,
} from "@/lib/crm/customers";

type Lead = {
  id: number;
  reference: string;
  subject: string | null;
  lead_type: string;
  status: string;
  priority: string;
  source: string;
  assigned_agent_id: number | null;
  next_follow_up_at: string | null;
  customer?: {
    id: number;
    name: string;
    phone: string | null;
  };
  assigned_agent?: { id: number; name: string } | null;
};

type Activity = {
  id: number;
  activity_type: string;
  description: string;
  scheduled_at: string | null;
  completed_at: string | null;
  creator?: { name: string };
};

type Agent = { id: number; name: string };

type PageResult<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

const statuses = [
  "new", "contacted", "qualified", "viewing",
  "negotiating", "won", "lost",
];

const leadTypes = ["buy", "sell", "rent", "let", "consultation"];

const field =
  "w-full rounded-xl border border-[#dfe5f0] bg-white px-3 py-2.5 text-sm text-[#34435e] focus:border-[#626df1] outline-none";

function display(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function requestApi(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`/api/dashboard/manage/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(apiError(data, `Request failed (HTTP ${response.status}).`));
  }

  return data;
}

export default function LeadsPage() {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [leads, setLeads] = useState<PageResult<Lead> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", type: "" });
  const [reload, setReload] = useState(0);

  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [leadType, setLeadType] = useState("buy");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");

  const [activityType, setActivityType] = useState("note");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canView = permissions?.includes("leads.view") ?? false;
  const canCreate = permissions?.includes("leads.create") ?? false;
  const canUpdate = permissions?.includes("leads.update") ?? false;
  const canAssign = permissions?.includes("leads.assign") ?? false;

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await readJson(response) as {
          user?: { permissions?: string[] };
        };

        if (active) {
          setPermissions(
            response.ok && Array.isArray(data.user?.permissions)
              ? data.user.permissions
              : [],
          );
        }
      } catch {
        if (active) setPermissions([]);
      }
    }

    void loadPermissions();
    return () => { active = false; };
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("lead_type", filters.type);

      const data = await requestApi(`leads?${params}`) as PageResult<Lead>;

      if (!Array.isArray(data.data)) {
        throw new Error("Invalid lead list received.");
      }

      setLeads(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load leads.");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    if (!canView) return;

    // Start the asynchronous load after the effect setup.
    // Avoid a synchronous state update inside the effect.
    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadLeads();
      }
    });

    return () => controller.abort();
  }, [canView, loadLeads, reload]);

  useEffect(() => {
    if (!canCreate) return;

    let active = true;

    async function loadCustomers() {
      try {
        const params = new URLSearchParams({
          per_page: "100",
        });

        if (customerSearch.trim()) {
          params.set("search", customerSearch.trim());
        }

        const data = await requestApi(
          `customers?${params}`,
        ) as PageResult<Customer>;

        if (active) setCustomers(data.data ?? []);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load customers.");
        }
      }
    }

    void loadCustomers();
    return () => { active = false; };
  }, [canCreate, customerSearch]);

  useEffect(() => {
    if (!canAssign) return;

    let active = true;

    async function loadAgents() {
      try {
        const data = await requestApi(
          "users?role=agent&status=active&per_page=100",
        ) as PageResult<Agent>;

        if (active) setAgents(data.data ?? []);
      } catch {
        if (active) setAgents([]);
      }
    }

    void loadAgents();
    return () => { active = false; };
  }, [canAssign]);

  async function loadActivities(lead: Lead) {
    try {
      const data = await requestApi(
        `leads/${lead.id}/activities`,
      ) as { activities: Activity[] };

      setActivities(data.activities ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load activities.");
    }
  }

  async function runAction(action: () => Promise<void>) {
    if (busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      if (!customerId) throw new Error("Select an existing customer.");

      await requestApi("leads", "POST", {
        customer_id: Number(customerId),
        lead_type: leadType,
        subject: subject.trim() || null,
        message: message.trim() || null,
        priority,
        source: "staff",
      });

      setCreating(false);
      setCustomerId("");
      setSubject("");
      setMessage("");
      setPage(1);
      setReload((n) => n + 1);
      setNotice("Lead registered successfully.");
    });
  }

  async function openLead(lead: Lead) {
    setSelected(lead);
    setActivities([]);
    setNotice("");
    setError("");
    await loadActivities(lead);
  }

  async function updateStatus(status: string) {
    if (!selected) return;

    await runAction(async () => {
      await requestApi(`leads/${selected.id}/status`, "PATCH", { status });
      setSelected({ ...selected, status });
      setReload((n) => n + 1);
      await loadActivities(selected);
      setNotice("Lead status updated.");
    });
  }

  async function assignAgent(value: string) {
    if (!selected) return;

    await runAction(async () => {
      await requestApi(`leads/${selected.id}/assign`, "PATCH", {
        assigned_agent_id: value ? Number(value) : null,
      });

      setSelected({
        ...selected,
        assigned_agent_id: value ? Number(value) : null,
      });

      setReload((n) => n + 1);
      await loadActivities(selected);
      setNotice("Lead assignment updated.");
    });
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    await runAction(async () => {
      if (activityType === "follow_up" && !scheduledAt) {
        throw new Error("A future follow-up date is required.");
      }

      await requestApi(
        `leads/${selected.id}/activities`,
        "POST",
        {
          activity_type: activityType,
          description: description.trim(),
          ...(activityType === "follow_up"
            ? { scheduled_at: new Date(scheduledAt).toISOString() }
            : {}),
        },
      );

      setDescription("");
      setScheduledAt("");
      await loadActivities(selected);
      setReload((n) => n + 1);
      setNotice("Activity recorded successfully.");
    });
  }

  async function completeFollowUp(activityId: number) {
    if (!selected) return;

    await runAction(async () => {
      await requestApi(
        `leads/${selected.id}/activities/${activityId}/complete`,
        "PATCH",
        {},
      );

      await loadActivities(selected);
      setReload((n) => n + 1);
      setNotice("Follow-up completed successfully.");
    });
  }

  if (permissions === null) {
    return <main className="p-8">Loading CRM permissions...</main>;
  }

  if (!canView) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Lead Management</h1>
        <p className="mt-3 text-sm text-slate-500">
          You do not have permission to view leads.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#626df1]">
            Gracious Investment · CRM
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Lead Management
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage property inquiries, activities, assignments and follow-ups.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white"
          >
            + Register Lead
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters({
            search: search.trim(),
            status: statusFilter,
            type: typeFilter,
          });
        }}
        className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-4"
      >
        <input
          aria-label="Search leads"
          className={field}
          placeholder="Search leads or customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className={field}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{display(s)}</option>)}
        </select>
        <select
          aria-label="Filter by lead type"
          className={field}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All lead types</option>
          {leadTypes.map((t) => <option key={t} value={t}>{display(t)}</option>)}
        </select>
        <button className="rounded-xl bg-[#263956] px-4 py-2 text-sm font-semibold text-white">
          Apply Filters
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-semibold text-[#263956]">
            Lead Directory ({leads?.total ?? "—"})
          </h2>
          <button
            onClick={() => setReload((n) => n + 1)}
            className="text-sm font-semibold text-[#626df1]"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Reference", "Customer", "Type", "Priority", "Status", "Agent", "Action"].map((h) => (
                  <th key={h} className="px-4 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center">Loading leads...</td></tr>
              ) : leads?.data.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center">No leads found.</td></tr>
              ) : leads?.data.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-[#626df1]">{lead.reference}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium">{lead.customer?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{lead.subject || ""}</div>
                  </td>
                  <td className="px-4 py-4">{display(lead.lead_type)}</td>
                  <td className="px-4 py-4">{display(lead.priority || "medium")}</td>
                  <td className="px-4 py-4">{display(lead.status)}</td>
                  <td className="px-4 py-4">{lead.assigned_agent?.name ?? "Unassigned"}</td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => void openLead(lead)}
                      className="font-semibold text-[#626df1]"
                    >
                      View / Manage
                    </button>
                    {canUpdate && (
                      <div className="mt-2">
                        <ArchiveAction
                          kind="leads"
                          id={lead.id}
                          reference={lead.reference}
                          onArchived={(message) => {
                            setNotice(message);
                            setSelected(null);
                            setReload((n) => n + 1);
                          }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t p-5">
          <span className="text-sm text-slate-500">
            Page {leads?.current_page ?? 1} of {leads?.last_page ?? 1}
          </span>
          <div className="flex gap-2">
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={loading || !leads || page >= leads.last_page}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {canUpdate && (
        <ArchivedRecords
          kind="leads"
          refreshKey={reload}
          onRestored={(message) => {
            setNotice(message);
            setReload((n) => n + 1);
          }}
        />
      )}

      {canAssign && (
        <UnassignedLeadsInbox
          refreshKey={reload}
          onAssigned={() => setReload((n) => n + 1)}
        />
      )}

      {creating && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17243d]/60 p-4">
          <form
            onSubmit={(e) => void createLead(e)}
            className="mx-auto my-8 max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold text-[#263956]">Register Lead</h2>
              <button type="button" onClick={() => setCreating(false)}>✕</button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Find Customer</label>
              <input
                className={field}
                placeholder="Search customer by name, phone or reference"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Customer *</label>
              <select required className={field} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.reference} — {c.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Search to locate customers beyond the first 100 results.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Lead Type *</label>
              <select className={field} value={leadType} onChange={(e) => setLeadType(e.target.value)}>
                {leadTypes.map((t) => <option key={t} value={t}>{display(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Priority</label>
              <select className={field} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {["low", "medium", "high"].map((p) => (
                  <option key={p} value={p}>{display(p)}</option>
                ))}
              </select>
            </div>
            <input
              className={field}
              placeholder="Lead subject"
              maxLength={255}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className={field}
              placeholder="Customer inquiry"
              rows={3}
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              disabled={busy}
              className="w-full rounded-xl bg-[#626df1] p-3 font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Saving..." : "Register Lead"}
            </button>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17243d]/60 p-4">
          <div className="mx-auto my-8 max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#263956]">{selected.reference}</h2>
                <p className="text-sm text-slate-500">
                  {selected.customer?.name ?? "Customer"} · {display(selected.lead_type)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close lead details">✕</button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">Lead Status</label>
                <select
                  disabled={!canUpdate || busy}
                  value={selected.status}
                  onChange={(e) => void updateStatus(e.target.value)}
                  className={field}
                >
                  {statuses.map((s) => <option key={s} value={s}>{display(s)}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Assigned Agent</label>
                {canAssign ? (
                  <select
                    disabled={busy}
                    value={selected.assigned_agent_id ?? ""}
                    onChange={(e) => void assignAgent(e.target.value)}
                    className={field}
                  >
                    <option value="">Unassigned</option>
                    {selected.assigned_agent_id &&
                      !agents.some((a) => a.id === selected.assigned_agent_id) && (
                      <option value={selected.assigned_agent_id}>
                        {selected.assigned_agent?.name ?? "Current agent"}
                      </option>
                    )}
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm">
                    {selected.assigned_agent?.name ?? "Unassigned"}
                  </p>
                )}
              </div>
            </div>

            {canUpdate && (
              <form onSubmit={(e) => void addActivity(e)} className="space-y-3 rounded-xl border p-4">
                <h3 className="font-bold">Record Activity / Follow-up</h3>
                <select
                  className={field}
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  {["note", "call", "email", "meeting", "follow_up"].map((a) => (
                    <option key={a} value={a}>{display(a)}</option>
                  ))}
                </select>
                <textarea
                  required
                  className={field}
                  rows={3}
                  maxLength={5000}
                  placeholder="Describe the activity"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {activityType === "follow_up" && (
                  <div>
                    <label className="mb-2 block text-sm">Follow-up Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className={field}
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                )}
                <button
                  disabled={busy}
                  className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Save Activity
                </button>
              </form>
            )}

            <div>
              <h3 className="mb-3 font-bold">Activity History</h3>
              {activities.length === 0 && (
                <p className="text-sm text-slate-500">No activities recorded yet.</p>
              )}

              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border p-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{display(activity.activity_type)}</strong>
                      {activity.creator?.name && (
                        <span className="text-slate-500">{activity.creator.name}</span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{activity.description}</p>
                    {activity.scheduled_at && (
                      <p className="mt-2 text-xs text-slate-500">
                        Scheduled: {new Date(activity.scheduled_at).toLocaleString()}
                      </p>
                    )}
                    {activity.completed_at && (
                      <p className="mt-1 text-xs text-emerald-700">
                        Completed: {new Date(activity.completed_at).toLocaleString()}
                      </p>
                    )}
                    {canUpdate &&
                      activity.activity_type === "follow_up" &&
                      !activity.completed_at && (
                        <button
                          disabled={busy}
                          onClick={() => void completeFollowUp(activity.id)}
                          className="mt-3 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700"
                        >
                          Mark Follow-up Complete
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
