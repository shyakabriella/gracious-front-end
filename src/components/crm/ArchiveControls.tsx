"use client";

import { useEffect, useState } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Kind = "customers" | "leads";

type ArchivedRecord = {
  id: number;
  reference: string;
  name?: string;
  subject?: string | null;
  lead_type?: string;
  customer?: { name: string } | null;
  deleted_at?: string | null;
};

type ArchivedPage = {
  data: ArchivedRecord[];
  current_page: number;
  last_page: number;
  total: number;
};

async function archiveRequest(
  kind: Kind,
  id: number,
  action: "archive" | "restore",
): Promise<void> {
  const response = await fetch(
    `/api/dashboard/manage/${kind}/${id}/${action}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiError(result, `Unable to ${action} record.`),
    );
  }
}

export function ArchiveAction({
  kind,
  id,
  reference,
  onArchived,
}: {
  kind: Kind;
  id: number;
  reference: string;
  onArchived: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function archive() {
    if (busy) return;

    if (
      !window.confirm(
        `Archive ${reference}? The record will be hidden from active lists but can be restored later.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await archiveRequest(kind, id, "archive");
      onArchived(`${reference} archived successfully.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to archive record.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void archive()}
        className="text-sm font-semibold text-amber-700 disabled:opacity-50"
      >
        {busy ? "Archiving..." : "Archive"}
      </button>

      {error && (
        <span
          role="alert"
          className="max-w-56 text-xs text-red-700"
        >
          {error}
        </span>
      )}
    </span>
  );
}

export function ArchivedRecords({
  kind,
  refreshKey,
  onRestored,
}: {
  kind: Kind;
  refreshKey: number;
  onRestored: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<ArchivedPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/dashboard/manage/${kind}/archived?page=${page}&per_page=15`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(result));
        }

        const data = result as ArchivedPage;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid archived record list.");
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
              : "Unable to load archived records.",
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [kind, open, page, refreshKey, version]);

  function toggle() {
    if (!open) {
      setLoading(true);
      setError("");
    }

    setOpen(!open);
  }

  function changePage(next: number) {
    setLoading(true);
    setPage(next);
  }

  async function restore(record: ArchivedRecord) {
    if (busyId !== null) return;

    setBusyId(record.id);
    setError("");

    try {
      await archiveRequest(kind, record.id, "restore");

      if (records?.data.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setVersion((current) => current + 1);
      }

      setLoading(true);
      onRestored(`${record.reference} restored successfully.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to restore record.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e9edf5] bg-white">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-bold text-[#263956]">
            Archived {kind === "customers" ? "Customers" : "Leads"}
          </h2>
          <p className="mt-1 text-sm text-[#8190a9]">
            Recover records that were previously archived.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="rounded-xl border border-[#dfe5f0] px-4 py-2 text-sm font-semibold text-[#526481]"
        >
          {open ? "Hide Archived" : "View Archived"}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#e9edf5] p-5">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {loading && (
            <p className="text-sm text-[#8190a9]">
              Loading archived records...
            </p>
          )}

          {!loading && records?.data.length === 0 && (
            <p className="text-sm text-[#8190a9]">
              No archived records found.
            </p>
          )}

          {!loading && records?.data.map((record) => (
            <div
              key={record.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f6] py-4"
            >
              <div>
                <p className="font-semibold text-[#263956]">
                  {record.name ??
                    record.customer?.name ??
                    record.subject ??
                    record.reference}
                </p>

                <p className="mt-1 text-xs text-[#8190a9]">
                  {record.reference}
                  {record.deleted_at
                    ? ` · Archived ${new Date(record.deleted_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void restore(record)}
                className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
              >
                {busyId === record.id
                  ? "Restoring..."
                  : "Restore"}
              </button>
            </div>
          ))}

          {!loading && records && records.last_page > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-[#8190a9]">
                Page {records.current_page} of {records.last_page}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= records.last_page}
                  onClick={() => changePage(page + 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
