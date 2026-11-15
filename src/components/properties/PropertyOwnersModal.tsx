"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Owner = {
  id: number;
  reference: string;
  name: string;
  owner_type: "individual" | "company";
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
};

type OwnerPage = {
  data: Owner[];
  current_page: number;
  last_page: number;
  total: number;
};

type Props = {
  propertyId: number;
  propertyTitle: string;
  canEdit: boolean;
  onChanged: () => void;
  onClose: () => void;
};

const API = "/api/dashboard/manage";

const smallButton =
  "rounded-lg border border-slate-300 px-3 py-2 text-xs " +
  "font-semibold text-[#263956] disabled:opacity-40";

export default function PropertyOwnersModal({
  propertyId,
  propertyTitle,
  canEdit,
  onChanged,
  onClose,
}: Props) {
  const [linkedOwners, setLinkedOwners] = useState<Owner[]>([]);
  const [candidates, setCandidates] = useState<OwnerPage | null>(null);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [loadingLinked, setLoadingLinked] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const linkedIds = new Set(linkedOwners.map((owner) => owner.id));

  useEffect(() => {
    const controller = new AbortController();

    async function loadLinked() {
      setLoadingLinked(true);

      try {
        const response = await fetch(
          `${API}/properties/${propertyId}/owners`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property owners."),
          );
        }

        const data = result as { owners?: Owner[] };

        if (!Array.isArray(data.owners)) {
          throw new Error("Invalid property owners response.");
        }

        if (!controller.signal.aborted) {
          setLinkedOwners(data.owners);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load linked owners.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingLinked(false);
        }
      }
    }

    void loadLinked();

    return () => controller.abort();
  }, [propertyId, reload]);

  useEffect(() => {
    if (!canEdit) return;

    const controller = new AbortController();

    async function loadCandidates() {
      setLoadingCandidates(true);

      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (appliedSearch) {
        params.set("search", appliedSearch);
      }

      try {
        const response = await fetch(
          `${API}/owners?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to search available owners."),
          );
        }

        const data = result as OwnerPage;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid owner directory response.");
        }

        if (!controller.signal.aborted) {
          setCandidates(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setCandidates(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to search owners.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCandidates(false);
        }
      }
    }

    void loadCandidates();

    return () => controller.abort();
  }, [canEdit, page, appliedSearch, reload]);

  async function attachOwner(owner: Owner) {
    if (busy || !canEdit || linkedIds.has(owner.id)) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/properties/${propertyId}/owners`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ owner_id: owner.id }),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to link property owner."),
        );
      }

      setNotice(
        (result as { message?: string }).message ||
          "Owner linked successfully.",
      );

      setReload((value) => value + 1);
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to link property owner.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function detachOwner(owner: Owner) {
    if (busy || !canEdit) return;

    const confirmed = window.confirm(
      `Remove ${owner.name} (${owner.reference}) ` +
      `from "${propertyTitle}"?\n\n` +
      "This removes the ownership link. " +
      "It does not delete or archive the owner.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/properties/${propertyId}/owners/${owner.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to remove ownership link."),
        );
      }

      setNotice(
        (result as { message?: string }).message ||
          "Ownership link removed successfully.",
      );

      setReload((value) => value + 1);
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to remove ownership link.",
      );
    } finally {
      setBusy(false);
    }
  }

  function searchOwners(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPage(1);
    setAppliedSearch(search.trim());
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-owners-title"
        className="mx-auto my-5 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <h2
              id="property-owners-title"
              className="text-xl font-bold text-[#263956]"
            >
              Manage Property Owners
            </h2>
            <p className="mt-1 break-words text-sm text-slate-500">
              {propertyTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={smallButton}
          >
            Close
          </button>
        </header>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-[#263956]">
              Linked Owners
            </h3>

            <button
              type="button"
              disabled={busy || loadingLinked}
              onClick={() => setReload((value) => value + 1)}
              className={smallButton}
            >
              Refresh
            </button>
          </div>

          {loadingLinked ? (
            <p className="mt-3 text-sm text-slate-500">
              Loading linked owners...
            </p>
          ) : linkedOwners.length === 0 ? (
            <p className="mt-3 rounded-xl border p-4 text-sm text-slate-500">
              No owners linked to this property.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {linkedOwners.map((owner) => (
                <div
                  key={owner.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#263956]">
                      {owner.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {owner.reference} · {owner.owner_type}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {owner.phone || "No phone provided"}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy || loadingLinked}
                      onClick={() => void detachOwner(owner)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                    >
                      Remove Link
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {canEdit && (
          <section className="mt-7 border-t pt-5">
            <h3 className="font-bold text-[#263956]">
              Attach Existing Owner
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Select an owner you are authorized to access.
              Create new owners in the Property Owners dashboard.
            </p>

            <form
              onSubmit={searchOwners}
              className="mt-4 flex flex-wrap gap-2"
            >
              <input
                aria-label="Search owners to link"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, reference or phone"
                className="min-w-[150px] flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />

              <button
                type="submit"
                disabled={busy || loadingCandidates}
                className="rounded-xl bg-[#263956] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Search
              </button>
            </form>

            {loadingCandidates && (
              <p className="mt-4 text-sm text-slate-500">
                Loading available owners...
              </p>
            )}

            {!loadingCandidates && candidates?.data.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">
                No matching owners found.
              </p>
            )}

            {!loadingCandidates && (
              <div className="mt-4 space-y-2">
                {candidates?.data.map((owner) => {
                  const attached = linkedIds.has(owner.id);

                  return (
                    <div
                      key={owner.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#263956]">
                          {owner.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {owner.reference} · {owner.owner_type}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busy || attached || loadingLinked}
                        onClick={() => void attachOwner(owner)}
                        className={smallButton}
                      >
                        {attached ? "Already Linked" : "Link Owner"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {candidates && candidates.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                <button
                  type="button"
                  disabled={busy || loadingCandidates || page <= 1}
                  onClick={() =>
                    setPage((value) => Math.max(1, value - 1))
                  }
                  className={smallButton}
                >
                  Previous
                </button>

                <span className="text-xs text-slate-500">
                  Page {candidates.current_page} of {candidates.last_page}
                </span>

                <button
                  type="button"
                  disabled={
                    busy ||
                    loadingCandidates ||
                    page >= candidates.last_page
                  }
                  onClick={() => setPage((value) => value + 1)}
                  className={smallButton}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
