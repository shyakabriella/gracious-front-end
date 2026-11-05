"use client";

import { useEffect, useState } from "react";
import StaffForm from "@/components/staff/StaffForm";
import {
  getErrorMessage,
  parseRoles,
  parseStaffPage,
} from "@/lib/staff/types";
import type {
  StaffMember,
  StaffPage,
} from "@/lib/staff/types";

type Account = {
  id: number;
  permissions: string[];
};

const emptyPage: StaffPage = {
  members: [],
  currentPage: 1,
  lastPage: 1,
  total: 0,
};

export default function StaffManagementPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [staff, setStaff] = useState<StaffPage>(emptyPage);
  const [roles, setRoles] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const permissions = account?.permissions || [];
  const canCreate = permissions.includes("users.create");
  const canEdit = permissions.includes("users.update");
  const canSuspend = permissions.includes("users.suspend");
  const canView = permissions.includes("users.view");

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) throw new Error();

        const result = await response.json();
        if (!cancelled) {
          setAccount({
            id: result.user.id,
            permissions: result.user.permissions || [],
          });
        }
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setAccountLoaded(true);
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountLoaded || !canView) {
      if (accountLoaded) setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStaff() {
      try {
        const query = new URLSearchParams({
          page: String(page),
          per_page: "10",
        });

        if (search) query.set("search", search);
        if (role) query.set("role", role);
        if (status) query.set("status", status);

        const response = await fetch(
          `/api/dashboard/manage/users?${query.toString()}`,
          { cache: "no-store" },
        );

        const result: unknown = await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(result, "Unable to load staff."),
          );
        }

        const data = parseStaffPage(result);

        if (!cancelled) {
          setStaff(data);
          setError("");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load staff.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [accountLoaded, canView, page, search, role, status, revision]);

  useEffect(() => {
    if (!accountLoaded || !canView) return;

    let cancelled = false;

    async function loadRoles() {
      try {
        const response = await fetch("/api/dashboard/manage/roles", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const result: unknown = await response.json();

        if (!cancelled) setRoles(parseRoles(result));
      } catch {
        // Role listing may be restricted to certain administrators.
      }
    }

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [accountLoaded, canView]);

  function reload() {
    setLoading(true);
    setRevision((current) => current + 1);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setFeedback("");
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setFormOpen(true);
    setFeedback("");
  }

  async function changeStatus(member: StaffMember) {
    const nextStatus =
      member.status === "active" ? "suspended" : "active";

    if (member.id === account?.id && nextStatus === "suspended") {
      setError("You cannot suspend your own account.");
      return;
    }

    const action =
      nextStatus === "suspended" ? "suspend" : "reactivate";

    if (!window.confirm(`Are you sure you want to ${action} ${member.name}?`)) {
      return;
    }

    setUpdatingId(member.id);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(
        `/api/dashboard/manage/users/${member.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Unable to update account status."),
        );
      }

      setFeedback(`Account ${nextStatus} successfully.`);
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#6875f5]">
            ADMINISTRATION
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#263956]">
            Staff Management
          </h2>
          <p className="mt-2 text-sm text-[#8293af]">
            Manage employees, account roles and access status.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            disabled={roles.length === 0}
            className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#505cdb] disabled:opacity-50"
          >
            + Add Staff
          </button>
        )}
      </div>

      {!accountLoaded ? (
        <div className="rounded-xl bg-white p-8 text-sm text-[#8293af]">
          Checking your permissions...
        </div>
      ) : !canView ? (
        <div className="rounded-xl border border-amber-200 bg-white p-8 text-sm text-amber-800">
          Your account does not have permission to view staff records.
        </div>
      ) : (
        <div className="rounded-xl border border-[#e1e6f0] bg-white shadow-sm">
          <form
            onSubmit={submitSearch}
            className="grid gap-3 border-b border-[#e9edf5] p-5 md:grid-cols-[minmax(180px,1fr)_160px_160px_auto]"
          >
            <input
              aria-label="Search staff"
              placeholder="Search name or email..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="min-w-0 rounded-lg border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
            />

            <select
              aria-label="Filter by role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
                setLoading(true);
              }}
              className="rounded-lg border border-[#dfe5f0] bg-white px-3 py-3 text-sm"
            >
              <option value="">All roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                setLoading(true);
              }}
              className="rounded-lg border border-[#dfe5f0] bg-white px-3 py-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-[#eef0ff] px-5 py-3 text-sm font-semibold text-[#5866e6]"
            >
              Search
            </button>
          </form>

          {error && (
            <div role="alert" className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {feedback && (
            <div role="status" className="m-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-[#f8f9ff]">
                <tr className="text-[11px] uppercase tracking-wide text-[#8a9bb7]">
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#eef0f5]">
                {staff.members.map((member) => (
                  <tr key={member.id} className="text-sm">
                    <td className="px-5 py-5 font-semibold text-[#263956]">
                      {member.name}
                      {member.id === account?.id && (
                        <span className="ml-2 text-xs font-normal text-[#91a0b9]">
                          (You)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-5 text-[#7284a2]">
                      {member.email}
                    </td>

                    <td className="px-5 py-5 capitalize text-[#526784]">
                      {member.roles.join(", ").replaceAll("_", " ") || "—"}
                    </td>

                    <td className="px-5 py-5">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="px-5 py-5">
                      <div className="flex justify-end gap-3">
                        {canEdit && (
                          <button
                            type="button"
                            disabled={roles.length === 0}
                            onClick={() => openEdit(member)}
                            className="font-semibold text-[#626df1] disabled:opacity-50"
                          >
                            Edit
                          </button>
                        )}

                        {canSuspend && member.id !== account?.id && (
                          <button
                            type="button"
                            disabled={updatingId === member.id}
                            onClick={() => void changeStatus(member)}
                            className="font-semibold text-[#687995] disabled:opacity-50"
                          >
                            {updatingId === member.id
                              ? "Updating..."
                              : member.status === "active"
                                ? "Suspend"
                                : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && staff.members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#91a0b9]">
                      No staff members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e9edf5] p-5">
            <p className="text-xs text-[#8293af]">
              {loading
                ? "Loading staff..."
                : `${staff.total} staff member${staff.total === 1 ? "" : "s"}`}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setPage((current) => current - 1);
                  setLoading(true);
                }}
                className="rounded-lg border border-[#dfe5f0] px-4 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-xs text-[#7284a2]">
                {staff.currentPage} / {staff.lastPage}
              </span>

              <button
                type="button"
                disabled={page >= staff.lastPage || loading}
                onClick={() => {
                  setPage((current) => current + 1);
                  setLoading(true);
                }}
                className="rounded-lg border border-[#dfe5f0] px-4 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>

              <button
                type="button"
                onClick={reload}
                className="rounded-lg bg-[#eef0ff] px-4 py-2 text-xs font-semibold text-[#626df1]"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <StaffForm
          member={editing}
          roles={roles}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            setFeedback("Staff information saved successfully.");
            reload();
          }}
        />
      )}
    </div>
  );
}
