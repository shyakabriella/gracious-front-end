"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Lead = {
  id: number;
  reference: string;
  subject: string | null;
  source: string | null;
  status: string;
  created_at?: string;
  customer?: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  property?: {
    title: string;
  } | null;
};

type Agent = {
  id: number;
  name: string;
  status: string;
  invitation_status?: string | null;
};

type PageData<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

const input =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500";

async function api(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(
    `/api/dashboard/manage/${path}`,
    {
      method,
      cache: "no-store",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiError(result, `Request failed: HTTP ${response.status}`),
    );
  }

  return result;
}

export default function UnassignedLeadsInbox({
  refreshKey,
  onAssigned,
}: {
  refreshKey: number;
  onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    source: "",
  });

  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<PageData<Lead> | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentVersion, setAgentVersion] = useState(0);
  const [selectedAgents, setSelectedAgents] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [agentError, setAgentError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInbox() {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (filters.search) params.set("search", filters.search);
      if (filters.source) params.set("source", filters.source);

      try {
        const response = await fetch(
          `/api/dashboard/manage/crm/unassigned-leads?${params}`,
          { cache: "no-store", signal: controller.signal },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(result, "Unable to load inbox."));
        }

        const data = result as PageData<Lead>;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid unassigned leads response.");
        }

        if (!controller.signal.aborted) {
          setRecords(data);
          setError("");
          setLoading(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load unassigned leads.",
          );
          setLoading(false);
        }
      }
    }

    void loadInbox();
    return () => controller.abort();
  }, [page, filters, refreshKey, version]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAgents() {
      const params = new URLSearchParams({
        role: "agent",
        status: "active",
        per_page: "100",
      });

      if (agentQuery.trim()) {
        params.set("search", agentQuery.trim());
      }

      try {
        const response = await fetch(
          `/api/dashboard/manage/users?${params}`,
          { cache: "no-store", signal: controller.signal },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(result, "Unable to load agents."));
        }

        const data = result as PageData<Agent>;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid agent list response.");
        }

        if (!controller.signal.aborted) {
          setAgents(
            data.data.filter(
              (user) =>
                user.status === "active" &&
                !["pending", "revoked", "expired"].includes(
                  user.invitation_status ?? "",
                ),
            ),
          );
          setAgentError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAgentError(
            cause instanceof Error
              ? cause.message
              : "Unable to load agents.",
          );
        }
      }
    }

    void loadAgents();
    return () => controller.abort();
  }, [agentQuery, agentVersion]);

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setLoading(true);
    setFilters({ search: search.trim(), source });
    setVersion((v) => v + 1);
  }

  async function assign(lead: Lead) {
    const chosen = selectedAgents[lead.id];

    if (!chosen) {
      setError("Select an active agent before assigning the lead.");
      return;
    }

    if (
      !window.confirm(
        `Assign ${lead.reference} to the selected agent?`,
      )
    ) {
      return;
    }

    setBusyId(lead.id);
    setError("");
    setNotice("");

    try {
      await api(
        `leads/${lead.id}/assign`,
        "PATCH",
        { assigned_agent_id: Number(chosen) },
      );

      setNotice(`${lead.reference} assigned successfully.`);
      setLoading(true);

      if (records?.data.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setVersion((v) => v + 1);
      }

      onAssigned();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to assign lead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-bold text-[#263956]">
          Unassigned Leads Inbox
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review new inquiries and assign them to active real estate agents.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <form
        onSubmit={filter}
        className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
      >
        <input
          className={input}
          aria-label="Search unassigned leads"
          placeholder="Lead reference, customer, email or phone"
          maxLength={100}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={input}
          aria-label="Filter leads by source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {[
            "website",
            "phone",
            "walk_in",
            "referral",
            "social_media",
            "staff",
          ].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-[#263956] px-5 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="rounded-xl bg-slate-50 p-4">
        <label
          htmlFor="inbox-agent-search"
          className="block text-sm font-semibold text-[#263956]"
        >
          Find an agent
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="inbox-agent-search"
            className={`${input} min-w-[200px] flex-1`}
            placeholder="Search active agents by name or email"
            value={agentQuery}
            onChange={(e) => setAgentQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setAgentVersion((v) => v + 1)}
            className="rounded-xl border bg-white px-4 py-2 text-sm"
          >
            Refresh agents
          </button>
        </div>
        {agentError && (
          <p className="mt-2 text-sm text-red-700">{agentError}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Select an agent for each lead below. Search if the agent is not
          among the first 100 results.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#263956]">
          Unassigned leads: {records?.total ?? "—"}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setVersion((v) => v + 1);
          }}
          className="text-sm font-semibold text-[#626df1]"
        >
          Refresh inbox
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Loading unassigned leads...
        </p>
      ) : records?.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          There are no matching unassigned leads.
        </p>
      ) : (
        <div className="space-y-3">
          {records?.data.map((lead) => (
            <article key={lead.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-[#263956]">{lead.reference}</p>
                  <p className="text-sm">
                    {lead.customer?.name ?? "Unknown customer"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lead.customer?.phone || lead.customer?.email || "No contact provided"}
                  </p>
                  {lead.subject && (
                    <p className="text-sm text-slate-600">{lead.subject}</p>
                  )}
                  {lead.property?.title && (
                    <p className="text-xs text-slate-500">
                      Property: {lead.property.title}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Source: {lead.source || "Unknown"} · Status: {lead.status}
                  </p>
                </div>

                <div className="flex min-w-[200px] flex-col gap-2">
                  <select
                    aria-label={`Agent for ${lead.reference}`}
                    className={input}
                    value={selectedAgents[lead.id] ?? ""}
                    onChange={(e) =>
                      setSelectedAgents((old) => ({
                        ...old,
                        [lead.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void assign(lead)}
                    className="rounded-xl bg-[#626df1] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busyId === lead.id ? "Assigning..." : "Assign Agent"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {records && records.last_page > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-slate-500">
            Page {records.current_page} of {records.last_page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || page >= records.last_page}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
