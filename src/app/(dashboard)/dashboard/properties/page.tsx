"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";
import PropertyRegistrationForm from "@/components/properties/PropertyRegistrationForm";
import PropertyDetailsModal from "@/components/properties/PropertyDetailsModal";
import PropertyEditModal from "@/components/properties/PropertyEditModal";
import PropertyDocumentsModal from "@/components/properties/PropertyDocumentsModal";

type Property = {
  id: number;
  reference: string;
  title: string;
  listing_type: string;
  asking_price: string | number;
  currency: string;
  verification_status: string;
  availability_status: string;
  is_published: boolean;
  is_featured: boolean;
  created_by?: number;
  category?: { name: string } | null;
  agent?: { name: string } | null;
};

type PropertyPage = {
  data: Property[];
  current_page: number;
  last_page: number;
  total: number;
};

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

const base = "/api/dashboard/manage";

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function eligible(property: Property) {
  return (
    property.verification_status === "verified" &&
    property.availability_status === "available" &&
    property.is_published === true
  );
}

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [records, setRecords] = useState<PropertyPage | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const [documentsProperty, setDocumentsProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await readJson(response) as {
          user?: Account;
        };

        if (!response.ok || !result.user) {
          throw new Error("Please sign in again.");
        }

        if (!controller.signal.aborted) {
          setAccount(result.user);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to verify your account permissions.");
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }

    void loadAccount();
    return () => controller.abort();
  }, []);

  const canView = account?.permissions?.includes("properties.view") ?? false;
  const canUpdate = account?.permissions?.includes("properties.update") ?? false;
  const canDelete = account?.permissions?.includes("properties.delete") ?? false;
  const manager = account?.roles?.some((role) =>
    role === "admin" || role === "super_admin"
  ) ?? false;
  const canCreate = account?.permissions?.includes("properties.create") ?? false;
  const canFeature = Boolean(
    account?.roles?.some((role) =>
      role === "super_admin" || role === "admin"
    ) && account?.permissions?.includes("properties.publish")
  );

  useEffect(() => {
    if (!canView) return;

    const controller = new AbortController();

    async function loadProperties() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: "15",
        });

        if (appliedSearch) params.set("search", appliedSearch);

        const response = await fetch(
          `${base}/properties?${params.toString()}`,
          { cache: "no-store", signal: controller.signal }
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(result, "Unable to load properties."));
        }

        const data = result as PropertyPage;

        if (
          !Array.isArray(data.data) ||
          !Number.isFinite(Number(data.last_page))
        ) {
          throw new Error("Invalid property list response.");
        }

        if (!controller.signal.aborted) setRecords(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load properties."
          );
          setRecords(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProperties();
    return () => controller.abort();
  }, [canView, page, appliedSearch, reload]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
    setReload((value) => value + 1);
  }

  async function archiveProperty(property: Property) {
    const allowed =
      canDelete &&
      (
        manager ||
        (
          account?.id !== undefined &&
          property.created_by === account.id
        )
      );

    if (!allowed || busyId !== null) return;

    const confirmed = window.confirm(
      `Archive "${property.title}" (${property.reference})?\n\n` +
      "This will remove the property from active records and " +
      "unpublish it. The database record will not be " +
      "permanently deleted."
    );

    if (!confirmed) return;

    setBusyId(property.id);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(
        `${base}/properties/${property.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to archive property.")
        );
      }

      setFeedback(
        `"${property.title}" was archived successfully.`
      );

      setPage(1);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to archive property."
      );
    } finally {
      setBusyId(null);
    }
  }

  const updateFeatured = useCallback(async (
    property: Property,
    next: boolean
  ) => {
    if (!canFeature || busyId !== null) return;

    const action = next ? "feature" : "remove featured status from";

    if (!window.confirm(
      `Do you want to ${action} "${property.title}"?`
    )) return;

    setBusyId(property.id);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(
        `${base}/properties/${property.id}/featured`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_featured: next }),
        }
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to update featured status.")
        );
      }

      setFeedback(
        next
          ? `"${property.title}" is now featured.`
          : `Featured status removed from "${property.title}".`
      );

      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update featured status."
      );
    } finally {
      setBusyId(null);
    }
  }, [canFeature, busyId]);

  if (checking) {
    return <main className="p-8">Checking property permissions...</main>;
  }

  if (!canView) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold text-[#263956]">
          Property Management
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          You do not have permission to view property records.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-5 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#626df1]">
          Gracious Investment · Properties
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#263956]">
          Property Management
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage the featured visibility of verified and published properties.
        </p>
      </header>

      {canCreate && (
        <div className="flex flex-wrap items-center gap-4">
          <PropertyRegistrationForm
            onCreated={() => {
              setPage(1);
              setReload((value) => value + 1);
            }}
          />
        </div>
      )}

      {selectedPropertyId !== null && (
        <PropertyDetailsModal
          propertyId={selectedPropertyId}
          onClose={() => setSelectedPropertyId(null)}
        />
      )}

      {documentsProperty !== null && (
        <PropertyDocumentsModal
          propertyId={documentsProperty.id}
          propertyTitle={documentsProperty.title}
          canEdit={
            canUpdate &&
            (
              manager ||
              (
                account?.id !== undefined &&
                documentsProperty.created_by === account.id
              )
            )
          }
          onClose={() => setDocumentsProperty(null)}
        />
      )}

      {editingPropertyId !== null && (
        <PropertyEditModal
          propertyId={editingPropertyId}
          onClose={() => setEditingPropertyId(null)}
          onSaved={() => {
            setEditingPropertyId(null);
            setReload((value) => value + 1);
            setFeedback("Property updated successfully. Check its verification status.");
          }}
        />
      )}

      {feedback && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {feedback}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={applySearch}
        className="flex flex-wrap gap-3 rounded-2xl border border-[#e9edf5] bg-white p-5">
        <input
          aria-label="Search properties"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
          placeholder="Search title, reference or address"
          className="min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm"
        />
        <button type="submit"
          className="rounded-xl bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white">
          Search
        </button>
        <button type="button"
          onClick={() => setReload((value) => value + 1)}
          className="rounded-xl border px-5 py-2.5 text-sm font-semibold">
          Refresh
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-[#e9edf5] bg-white">
        <div className="flex flex-wrap justify-between gap-3 border-b p-5">
          <h2 className="font-bold text-[#263956]">Property Directory</h2>
          <span className="text-sm text-slate-500">
            {records?.total ?? 0} matching properties
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f8f9fd] text-xs uppercase text-[#8190a9]">
              <tr>
                <th className="p-4">Property</th>
                <th className="p-4">Price</th>
                <th className="p-4">Verification</th>
                <th className="p-4">Availability</th>
                <th className="p-4">Publication</th>
                <th className="p-4">Featured</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr><td colSpan={7} className="p-8 text-center">
                  Loading properties...
                </td></tr>
              )}

              {!loading && records?.data.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">
                  No properties found.
                </td></tr>
              )}

              {!loading && records?.data.map((property) => (
                <tr key={property.id} className="hover:bg-[#fafbff]">
                  <td className="p-4">
                    <p className="font-bold text-[#263956]">
                      {property.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {property.reference} · {readable(property.listing_type)}
                    </p>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {property.currency}{" "}
                    {Number(property.asking_price).toLocaleString("en-RW")}
                  </td>
                  <td className="p-4 capitalize">
                    {readable(property.verification_status)}
                  </td>
                  <td className="p-4 capitalize">
                    {readable(property.availability_status)}
                  </td>
                  <td className="p-4">
                    {property.is_published ? "Published" : "Unpublished"}
                  </td>
                  <td className="p-4 font-semibold">
                    {property.is_featured ? "Featured" : "Not featured"}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPropertyId(property.id)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-[#263956]"
                      >
                        View Details
                      </button>
                      {(
                        manager ||
                        (
                          account?.id !== undefined &&
                          property.created_by === account.id
                        )
                      ) && (
                        <button
                          type="button"
                          onClick={() => setDocumentsProperty(property)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-[#263956]"
                        >
                          Manage Documents
                        </button>
                      )}
                      {canUpdate && (
                        manager || (
                          account?.id !== undefined &&
                          property.created_by === account.id
                        )
                      ) && (
                        <button
                          type="button"
                          onClick={() => setEditingPropertyId(property.id)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-[#263956]"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete &&
                        (
                          manager ||
                          (
                            account?.id !== undefined &&
                            property.created_by === account.id
                          )
                        ) && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void archiveProperty(property)}
                            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                          >
                            {busyId === property.id
                              ? "Processing..."
                              : "Archive"}
                          </button>
                        )}
                      {canFeature ? (
                      <button
                        type="button"
                        disabled={
                          busyId !== null ||
                          (!property.is_featured && !eligible(property))
                        }
                        onClick={() =>
                          void updateFeatured(
                            property,
                            !property.is_featured
                          )
                        }
                        className="rounded-lg bg-[#626df1] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyId === property.id
                          ? "Updating..."
                          : property.is_featured
                            ? "Remove Featured"
                            : "Feature Property"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        View only
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5">
          <p className="text-sm text-slate-500">
            Page {records?.current_page ?? page} of {records?.last_page ?? 1}
          </p>
          <div className="flex gap-2">
            <button type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">
              Previous
            </button>
            <button type="button"
              disabled={loading || !records || page >= records.last_page}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
