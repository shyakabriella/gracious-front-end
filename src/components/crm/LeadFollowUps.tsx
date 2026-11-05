"use client";

import { useEffect, useState } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type FollowUp = {
  id: number;
  lead_id: number;
  description: string;
  scheduled_at: string | null;
  completed_at: string | null;
  creator?: {
    id: number;
    name: string;
  } | null;
  lead?: {
    id: number;
    reference: string;
    status: string;
    customer?: {
      name: string;
      phone: string | null;
    } | null;
  } | null;
};

type PageResult = {
  data: FollowUp[];
  current_page: number;
  last_page: number;
  total: number;
};

type Filter = "all" | "upcoming" | "overdue";

const endpoint = "/api/dashboard/manage";

export default function LeadFollowUps({
  canComplete,
  refreshKey,
  onCompleted,
}: {
  canComplete: boolean;
  refreshKey: number;
  onCompleted: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFollowUps() {
      const params = new URLSearchParams({
        filter,
        page: String(page),
        per_page: "15",
      });

      try {
        const response = await fetch(
          `${endpoint}/crm/follow-ups?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load follow-ups."),
          );
        }

        const data = result as PageResult;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid follow-up list received.");
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
              : "Unable to load follow-ups.",
          );
          setLoading(false);
        }
      }
    }

    void loadFollowUps();

    return () => controller.abort();
  }, [filter, page, refreshKey, version]);

  function selectFilter(value: Filter) {
    setFilter(value);
    setPage(1);
    setLoading(true);
    setNotice("");
    setVersion((current) => current + 1);
  }

  async function complete(item: FollowUp) {
    if (busyId !== null || !item.lead) return;

    if (
      !window.confirm(
        `Mark the follow-up for ${item.lead.reference} as completed?`,
      )
    ) {
      return;
    }

    setBusyId(item.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${endpoint}/leads/${item.lead.id}/activities/${item.id}/complete`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to complete follow-up."),
        );
      }

      setNotice("Follow-up completed successfully.");
      setLoading(true);

      if (records?.data.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setVersion((current) => current + 1);
      }

      onCompleted();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete follow-up.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#263956]">
            Follow-ups Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage scheduled customer follow-ups across your accessible leads.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setVersion((current) => current + 1);
          }}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#626df1]"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "All Pending"],
          ["upcoming", "Upcoming"],
          ["overdue", "Overdue"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => selectFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
              filter === value
                ? "bg-[#626df1] text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#263956]">
          Matching follow-ups: {records?.total ?? "—"}
        </p>
        <p className="text-xs text-slate-500">
          {filter === "overdue"
            ? "Past due"
            : filter === "upcoming"
              ? "Scheduled ahead"
              : "Awaiting completion"}
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Loading follow-ups...
        </p>
      ) : records?.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No pending follow-ups found for this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {records?.data.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-bold text-[#263956]">
                    {item.lead?.reference ?? `Lead #${item.lead_id}`}
                  </p>

                  <p className="text-sm font-medium text-slate-700">
                    {item.lead?.customer?.name ?? "Customer"}
                  </p>

                  {item.lead?.customer?.phone && (
                    <p className="text-sm text-slate-500">
                      {item.lead.customer.phone}
                    </p>
                  )}

                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {item.description}
                  </p>

                  <p className="text-xs text-slate-500">
                    Scheduled:{" "}
                    {item.scheduled_at
                      ? new Date(item.scheduled_at).toLocaleString()
                      : "Not specified"}
                  </p>

                  {item.creator?.name && (
                    <p className="text-xs text-slate-500">
                      Created by: {item.creator.name}
                    </p>
                  )}
                </div>

                {canComplete && item.lead && (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void complete(item)}
                    className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-40"
                  >
                    {busyId === item.id
                      ? "Completing..."
                      : "Mark Complete"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {records && records.last_page > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-slate-500">
            Page {records.current_page} of {records.last_page}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((current) => current - 1);
              }}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                loading ||
                page >= records.last_page
              }
              onClick={() => {
                setLoading(true);
                setPage((current) => current + 1);
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
