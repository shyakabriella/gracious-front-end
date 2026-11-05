"use client";

import { useEffect, useState, type FormEvent } from "react";
import CustomerForm from "@/components/crm/CustomerForm";
import {
  apiError,
  customerTypes,
  parseCustomerPage,
  readJson,
  type Customer,
  type CustomerPage,
} from "@/lib/crm/customers";

type Account = {
  permissions?: string[];
};

export default function CustomersPage() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accountState, setAccountState] = useState<
    "loading" | "ready" | "denied"
  >("loading");

  const [records, setRecords] = useState<CustomerPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const canView = permissions.includes("customers.view");
  const canCreate = permissions.includes("customers.create");
  const canEdit = permissions.includes("customers.update");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await readJson(response)) as {
          user?: Account;
        };

        if (!response.ok || !data.user) {
          if (!controller.signal.aborted) setAccountState("denied");
          return;
        }

        if (controller.signal.aborted) return;

        setPermissions(
          Array.isArray(data.user.permissions)
            ? data.user.permissions
            : [],
        );
        setAccountState("ready");
      } catch {
        if (!controller.signal.aborted) setAccountState("denied");
      }
    }

    void loadAccount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (accountState !== "ready" || !canView) return;

    const controller = new AbortController();

    async function loadCustomers() {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        page: String(page),
        per_page: "15",
      });

      if (filters.search) query.set("search", filters.search);
      if (filters.type) query.set("customer_type", filters.type);
      if (filters.status) query.set("status", filters.status);

      try {
        const response = await fetch(
          `/api/dashboard/manage/customers?${query.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(data, "Unable to load customers."));
        }

        if (!controller.signal.aborted) {
          setRecords(parseCustomerPage(data));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load customers.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCustomers();
    return () => controller.abort();
  }, [accountState, canView, filters, page, reload]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      search: search.trim(),
      type,
      status,
    });
  }

  function saved(message: string) {
    setShowForm(false);
    setEditing(null);
    setFeedback(message);
    setPage(1);
    setReload((value) => value + 1);
  }

  const inputClass =
    "rounded-xl border border-[#e1e6f0] bg-white px-4 py-2.5 text-sm text-[#405575] outline-none focus:border-[#626df1]";

  if (accountState === "loading") {
    return (
      <main className="p-8 text-sm text-[#8190a9]">
        Loading customer permissions...
      </main>
    );
  }

  if (accountState === "denied" || !canView) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold text-[#263956]">
          Customer Management
        </h1>
        <p className="mt-3 text-sm text-[#8190a9]">
          You do not have permission to view customer records.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#626df1]">
            Gracious Investment · CRM
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#263956]">
            Customer Management
          </h1>
          <p className="mt-2 text-sm text-[#8796ad]">
            Register and manage customers using real CRM records.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
              setFeedback("");
            }}
            className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#515cde]"
          >
            + Register Customer
          </button>
        )}
      </div>

      {feedback && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e9edf5] bg-white p-5">
          <p className="text-sm text-[#8292aa]">Matching Customers</p>
          <p className="mt-2 text-2xl font-bold text-[#263956]">
            {records?.total ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e9edf5] bg-white p-5">
          <p className="text-sm text-[#8292aa]">Current Page</p>
          <p className="mt-2 text-2xl font-bold text-[#263956]">
            {records?.current_page ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e9edf5] bg-white p-5">
          <p className="text-sm text-[#8292aa]">Total Pages</p>
          <p className="mt-2 text-2xl font-bold text-[#263956]">
            {records?.last_page ?? "—"}
          </p>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e9edf5] bg-white p-5"
      >
        <div className="min-w-[180px] flex-1">
          <label htmlFor="customer-search" className="mb-2 block text-xs font-semibold text-[#73839d]">
            Search Customers
          </label>
          <input
            id="customer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, email or reference"
            className={`${inputClass} w-full`}
          />
        </div>

        <div>
          <label htmlFor="customer-filter-type" className="mb-2 block text-xs font-semibold text-[#73839d]">
            Customer Type
          </label>
          <select
            id="customer-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="">All Types</option>
            {customerTypes.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="customer-filter-status" className="mb-2 block text-xs font-semibold text-[#73839d]">
            Status
          </label>
          <select
            id="customer-filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="rounded-xl border border-[#e1e6f0] px-5 py-2.5 text-sm font-semibold text-[#526481]"
        >
          Refresh
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf5] bg-white">
        <div className="border-b border-[#e9edf5] px-6 py-5">
          <h2 className="font-bold text-[#263956]">Customer Directory</h2>
        </div>

        {error && (
          <p role="alert" className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[#f8f9fd] text-xs uppercase tracking-wide text-[#8190a9]">
              <tr>
                <th className="px-5 py-4">Reference</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f6]">
              {!loading && records?.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#8796ad]">
                    No customers match your filters.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#8796ad]">
                    Loading customer records...
                  </td>
                </tr>
              )}

              {!loading && records?.data.map((customer) => (
                <tr key={customer.id} className="hover:bg-[#fafbff]">
                  <td className="px-5 py-4 font-semibold text-[#626df1]">
                    {customer.reference}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#263956]">
                      {customer.name}
                    </p>
                    <p className="mt-1 text-xs text-[#8292aa]">
                      {customer.phone || customer.email || "No contact provided"}
                    </p>
                  </td>
                  <td className="px-5 py-4 capitalize text-[#526481]">
                    {customer.customer_type || "—"}
                  </td>
                  <td className="px-5 py-4 text-[#526481]">
                    {customer.preferred_location || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      customer.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {customer.status || "Unknown"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(customer);
                          setShowForm(true);
                        }}
                        className="font-semibold text-[#626df1]"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-xs text-[#9ca8ba]">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e9edf5] p-5">
          <p className="text-xs text-[#8190a9]">
            Page {records?.current_page ?? 1} of {records?.last_page ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-[#dfe5f0] px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || !records || page >= records.last_page}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-[#dfe5f0] px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <CustomerForm
          key={editing?.id ?? "new"}
          customer={editing}
          onClose={() => setShowForm(false)}
          onSaved={saved}
        />
      )}
    </main>
  );
}
