"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { apiError, readJson } from "@/lib/crm/customers";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Owner = {
  id: number;
  reference: string;
  owner_type: "individual" | "company";
  name: string;
  phone: string | null;
  email: string | null;
  province: string | null;
  district: string | null;
  sector: string | null;
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_by: number;
};

type OwnerPage = {
  data: Owner[];
  current_page: number;
  last_page: number;
  total: number;
};

type LinkedProperty = {
  id: number;
  reference: string;
  title: string;
  listing_type: string;
  verification_status: string;
  availability_status: string;
};

type OwnerForm = {
  owner_type: "individual" | "company";
  name: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  sector: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
};

const API = "/api/dashboard/manage/owners";

const inputClass =
  "w-full rounded-xl border border-slate-300 " +
  "bg-white px-3 py-2.5 text-sm";

const buttonClass =
  "rounded-lg border border-slate-300 px-3 py-2 " +
  "text-xs font-semibold disabled:opacity-40";

function emptyForm(): OwnerForm {
  return {
    owner_type: "individual",
    name: "",
    phone: "",
    email: "",
    province: "",
    district: "",
    sector: "",
    address: "",
    notes: "",
    status: "active",
  };
}

function ownerForm(owner: Owner): OwnerForm {
  return {
    owner_type: owner.owner_type,
    name: owner.name,
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    province: owner.province ?? "",
    district: owner.district ?? "",
    sector: owner.sector ?? "",
    address: owner.address ?? "",
    notes: owner.notes ?? "",
    status: owner.status,
  };
}

export default function PropertyOwnersPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);

  const [owners, setOwners] = useState<OwnerPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Owner | null>(null);
  const [linked, setLinked] = useState<LinkedProperty[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form, setForm] = useState<OwnerForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const permissions = account?.permissions ?? [];
  const canView = permissions.includes("owners.view");
  const canCreate = permissions.includes("owners.create");
  const canUpdate = permissions.includes("owners.update");
  const canDelete = permissions.includes("owners.delete");
  const canViewProperties = permissions.includes("properties.view");

  const manager = account?.roles?.some(
    (role) => role === "admin" || role === "super_admin",
  ) ?? false;

  function canManage(owner: Owner) {
    return manager || (
      account !== null && owner.created_by === account.id
    );
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await readJson(response) as {
          user?: Account;
        };

        if (!response.ok || !data.user) {
          throw new Error("Please sign in again.");
        }

        if (!controller.signal.aborted) {
          setAccount(data.user);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to verify account permissions.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    }

    void loadAccount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canView) return;

    const controller = new AbortController();

    async function loadOwners() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (appliedSearch) params.set("search", appliedSearch);
      if (typeFilter) params.set("owner_type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);

      try {
        const response = await fetch(
          `${API}?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property owners."),
          );
        }

        const data = result as OwnerPage;

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid owner list response.");
        }

        if (!controller.signal.aborted) {
          setOwners(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setOwners(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property owners.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadOwners();

    return () => controller.abort();
  }, [
    canView,
    page,
    reload,
    appliedSearch,
    typeFilter,
    statusFilter,
  ]);

  useEffect(() => {
    if (selectedId === null || !canView) return;

    const controller = new AbortController();

    async function loadDetails() {
      setDetailLoading(true);
      setDetailError("");
      setSelected(null);
      setLinked([]);

      try {
        const response = await fetch(`${API}/${selectedId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load owner details."),
          );
        }

        const data = result as { owner?: Owner };

        if (!data.owner) {
          throw new Error("Invalid owner details response.");
        }

        if (!controller.signal.aborted) {
          setSelected(data.owner);
        }

        if (canViewProperties) {
          const propertiesResponse = await fetch(
            `${API}/${selectedId}/properties`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );

          const propertiesResult =
            await readJson(propertiesResponse);

          if (!propertiesResponse.ok) {
            throw new Error(
              apiError(
                propertiesResult,
                "Unable to load linked properties.",
              ),
            );
          }

          const linkedData = propertiesResult as {
            properties?: LinkedProperty[];
          };

          if (!Array.isArray(linkedData.properties)) {
            throw new Error("Invalid linked-property response.");
          }

          if (!controller.signal.aborted) {
            setLinked(linkedData.properties);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setDetailError(
            cause instanceof Error
              ? cause.message
              : "Unable to load details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [selectedId, canView, canViewProperties]);

  function startCreate() {
    if (!canCreate) return;

    setEditing(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(owner: Owner) {
    if (!canUpdate || !canManage(owner)) return;

    setEditing(owner);
    setForm(ownerForm(owner));
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function setField<K extends keyof OwnerForm>(
    key: K,
    value: OwnerForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || (!editing && !canCreate)) return;
    if (editing && (!canUpdate || !canManage(editing))) return;

    if (!form.name.trim()) {
      setError("Owner name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      province: form.province.trim() || null,
      district: form.district.trim() || null,
      sector: form.sector.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      const response = await fetch(
        editing ? `${API}/${editing.id}` : API,
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to save property owner."),
        );
      }

      setFormOpen(false);
      setEditing(null);
      setNotice(
        editing
          ? "Property owner updated successfully."
          : "Property owner registered successfully.",
      );

      setPage(1);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save property owner.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveOwner(owner: Owner) {
    if (!canDelete || !canManage(owner) || archivingId !== null) {
      return;
    }

    if (!window.confirm(
      `Archive "${owner.name}" (${owner.reference})?\n\n` +
      "An owner linked to a property cannot be archived. " +
      "Laravel will enforce this restriction.",
    )) {
      return;
    }

    setArchivingId(owner.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/${owner.id}`, {
        method: "DELETE",
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to archive owner."),
        );
      }

      setNotice(`"${owner.name}" archived successfully.`);
      setPage(1);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to archive owner.",
      );
    } finally {
      setArchivingId(null);
    }
  }

  if (checking) {
    return (
      <p className="p-8 text-sm text-slate-500">
        Checking Property Owner permissions...
      </p>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">Property Owners</h1>
        <p className="mt-3 text-sm text-red-700">
          You do not have permission to view property owners.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#626df1]">
            Gracious Investment · Properties
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Property Owners
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Register and manage property owners securely.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white"
          >
            + Register Owner
          </button>
        )}
      </header>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {error && !formOpen && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setAppliedSearch(search.trim());
          setReload((value) => value + 1);
        }}
        className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5"
      >
        <input
          aria-label="Search property owners"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, reference or phone"
          className={`${inputClass} min-w-[180px] flex-1`}
        />

        <select
          aria-label="Owner type filter"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            setPage(1);
          }}
          className={`${inputClass} sm:w-auto`}
        >
          <option value="">All owner types</option>
          <option value="individual">Individual</option>
          <option value="company">Company</option>
        </select>

        <select
          aria-label="Owner status filter"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className={`${inputClass} sm:w-auto`}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          type="submit"
          className="rounded-xl bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className={buttonClass}
        >
          Refresh
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex justify-between gap-3 border-b p-5">
          <h2 className="font-bold text-[#263956]">
            Owner Directory
          </h2>
          <span className="text-sm text-slate-500">
            {owners?.total ?? 0} owners
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-4">Owner</th>
                <th className="p-4">Type</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    Loading owners...
                  </td>
                </tr>
              )}

              {!loading && owners?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No property owners found.
                  </td>
                </tr>
              )}

              {!loading && owners?.data.map((owner) => (
                <tr key={owner.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="font-semibold text-[#263956]">
                      {owner.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {owner.reference}
                    </p>
                  </td>

                  <td className="p-4 capitalize">
                    {owner.owner_type}
                  </td>

                  <td className="p-4">
                    <p>{owner.phone || "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {owner.email || "—"}
                    </p>
                  </td>

                  <td className="p-4 capitalize">
                    {owner.status}
                  </td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(owner.id)}
                        className={buttonClass}
                      >
                        View Details
                      </button>

                      {canUpdate && canManage(owner) && (
                        <button
                          type="button"
                          onClick={() => startEdit(owner)}
                          className={buttonClass}
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && canManage(owner) && (
                        <button
                          type="button"
                          disabled={archivingId !== null}
                          onClick={() => void archiveOwner(owner)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                        >
                          {archivingId === owner.id
                            ? "Archiving..."
                            : "Archive"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {owners && owners.last_page > 1 && (
          <div className="flex items-center justify-between border-t p-4">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={buttonClass}
            >
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {owners.current_page} of {owners.last_page}
            </span>

            <button
              type="button"
              disabled={loading || page >= owners.last_page}
              onClick={() => setPage((value) => value + 1)}
              className={buttonClass}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-form-title"
            className="mx-auto my-6 max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex justify-between gap-4">
              <h2 id="owner-form-title" className="text-xl font-bold text-[#263956]">
                {editing ? "Edit Property Owner" : "Register Property Owner"}
              </h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setFormOpen(false);
                  setError("");
                }}
                className={buttonClass}
              >
                Close
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <form onSubmit={(event) => void saveOwner(event)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Owner Type *</span>
                  <select
                    className={inputClass}
                    value={form.owner_type}
                    onChange={(event) =>
                      setField(
                        "owner_type",
                        event.target.value as OwnerForm["owner_type"],
                      )
                    }
                  >
                    <option value="individual">Individual</option>
                    <option value="company">Company</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Status</span>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(event) =>
                      setField(
                        "status",
                        event.target.value as OwnerForm["status"],
                      )
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              {([
                ["name", "Full Name / Company Name", true],
                ["phone", "Phone", false],
                ["email", "Email", false],
                ["province", "Province", false],
                ["district", "District", false],
                ["sector", "Sector", false],
                ["address", "Address", false],
              ] as const).map(([key, label, required]) => (
                <label key={key} className="block space-y-1 text-sm">
                  <span className="font-semibold">
                    {label}{required ? " *" : ""}
                  </span>
                  <input
                    type={key === "email" ? "email" : "text"}
                    className={inputClass}
                    value={form[key]}
                    required={required}
                    maxLength={
                      key === "phone" ? 30 :
                      ["province", "district", "sector"].includes(key)
                        ? 100 : 255
                    }
                    onChange={(event) => setField(key, event.target.value)}
                  />
                </label>
              ))}

              <label className="block space-y-1 text-sm">
                <span className="font-semibold">Notes</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={5000}
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                />
              </label>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setFormOpen(false);
                    setError("");
                  }}
                  className={buttonClass}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#626df1] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Register Owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedId !== null && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-details-title"
            className="mx-auto my-6 max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex justify-between gap-4">
              <h2 id="owner-details-title" className="text-xl font-bold text-[#263956]">
                Property Owner Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={buttonClass}
              >
                Close
              </button>
            </div>

            {detailLoading && (
              <p className="text-sm text-slate-500">Loading details...</p>
            )}

            {detailError && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {detailError}
              </p>
            )}

            {selected && (
              <div className="space-y-3 text-sm">
                {([
                  ["Reference", selected.reference],
                  ["Name", selected.name],
                  ["Type", selected.owner_type],
                  ["Status", selected.status],
                  ["Phone", selected.phone],
                  ["Email", selected.email],
                  ["Province", selected.province],
                  ["District", selected.district],
                  ["Sector", selected.sector],
                  ["Address", selected.address],
                  ["Notes", selected.notes],
                ] as const).map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[110px_1fr] gap-3 border-b py-2">
                    <strong className="text-slate-500">{label}</strong>
                    <span className="break-words">{value || "—"}</span>
                  </div>
                ))}

                {canViewProperties && (
                  <section className="pt-4">
                    <h3 className="mb-3 font-bold text-[#263956]">
                      Linked Properties
                    </h3>

                    {!detailLoading && linked.length === 0 && !detailError && (
                      <p className="text-slate-500">No linked properties.</p>
                    )}

                    {linked.map((property) => (
                      <div
                        key={property.id}
                        className="mb-2 rounded-xl border p-3"
                      >
                        <p className="font-semibold">{property.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {property.reference} · {property.listing_type}
                        </p>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
