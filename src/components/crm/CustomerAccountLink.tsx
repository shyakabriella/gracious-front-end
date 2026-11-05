"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type CustomerAccount = {
  id: number;
  name: string;
  email: string;
  status: string;
  roles?: Array<string | { name: string }>;
};

type AccountPage = {
  data: CustomerAccount[];
  total: number;
  current_page: number;
  last_page: number;
};

type Props = {
  customerId: number;
  customerReference: string;
  customerName: string;
  onLinked: () => void;
};

const base = "/api/dashboard/manage";

export default function CustomerAccountLink({
  customerId,
  customerReference,
  customerName,
  onLinked,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!open || linked) return;

    const controller = new AbortController();

    async function loadAccounts() {
      const params = new URLSearchParams({
        role: "customer",
        status: "active",
        per_page: "100",
      });

      if (appliedSearch) {
        params.set("search", appliedSearch);
      }

      try {
        const response = await fetch(
          `${base}/users?${params.toString()}`,
          { signal: controller.signal, cache: "no-store" },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(apiError(result, "Unable to find customer accounts."));
        }

        const page = result as AccountPage;

        if (!Array.isArray(page.data)) {
          throw new Error("Invalid account list response.");
        }

        if (!controller.signal.aborted) {
          setAccounts(
            page.data.filter((account) => {
              const roles = account.roles ?? [];
              return (
                account.status === "active" &&
                roles.length === 1 &&
                roles.some((role) =>
                  typeof role === "string"
                    ? role === "customer"
                    : role.name === "customer",
                )
              );
            }),
          );
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAccounts([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load customer accounts.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadAccounts();

    return () => controller.abort();
  }, [open, appliedSearch, linked]);

  function searchAccounts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedId("");
    setLoading(true);
    setAppliedSearch(search.trim());
  }

  const selected = accounts.find(
    (account) => String(account.id) === selectedId,
  );

  async function linkAccount() {
    if (!selected || saving || linked) return;

    const confirmed = window.confirm(
      `Confirm customer account linking:\n\n` +
        `CRM customer: ${customerName} (${customerReference})\n` +
        `Login account: ${selected.name} (${selected.email})\n\n` +
        `Only proceed after verifying this is the same person. ` +
        `This link cannot be changed using this interface.`,
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/customers/${customerId}/link-account`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: selected.id }),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to link the customer account."),
        );
      }

      setLinked(true);
      setMessage(
        `Successfully linked ${customerReference} to ${selected.email}.`,
      );
      onLinked();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to link account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={linked}
        onClick={() => {
          setOpen(true);
          setLoading(true);
          setError("");
        }}
        className="font-semibold text-indigo-600 disabled:opacity-50"
      >
        {linked ? "Linked" : "Link Account"}
      </button>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Link account for ${customerReference}`}
            className="w-full max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#263956]">
                  Link Customer Login
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {customerName} — {customerReference}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                aria-label="Close account linking"
                className="rounded-lg border px-3 py-1 text-lg"
              >
                ×
              </button>
            </div>

            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Verify the customer identity before linking. Never select
              an account just because its name or email looks similar.
            </p>

            {!linked && (
              <>
                <form onSubmit={searchAccounts} className="flex gap-2">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer login by name or email"
                    aria-label="Search customer accounts"
                    maxLength={100}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#263956] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Search
                  </button>
                </form>

                <div>
                  <label
                    htmlFor={`customer-account-${customerId}`}
                    className="block text-sm font-semibold text-[#263956]"
                  >
                    Select existing customer login
                  </label>

                  <select
                    id={`customer-account-${customerId}`}
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                    disabled={loading || saving}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                  >
                    <option value="">
                      {loading ? "Loading accounts..." : "Select customer account"}
                    </option>

                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} — {account.email}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    Only active customer-only accounts are selectable.
                    Search by email if the account is not listed.
                  </p>
                </div>
              </>
            )}

            {selected && !linked && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
                <p className="font-semibold text-indigo-900">
                  Selected account
                </p>
                <p className="mt-2 text-indigo-800">
                  {selected.name}
                </p>
                <p className="text-indigo-700">
                  {selected.email}
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
                {message}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Close
              </button>

              {!linked && (
                <button
                  type="button"
                  disabled={!selected || saving || loading}
                  onClick={() => void linkAccount()}
                  className="rounded-xl bg-[#626df1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {saving ? "Linking..." : "Confirm Link"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
