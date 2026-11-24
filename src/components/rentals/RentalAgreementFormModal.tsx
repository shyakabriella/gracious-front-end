"use client";

import { useEffect, useState, type FormEvent } from "react";

const API = "/api/dashboard/manage";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type PropertyOption = {
  id: number;
  reference: string;
  title: string;
  listing_type: string;
  verification_status: string;
  availability_status: string;
  is_published: boolean | number;
  currency?: string;
  agent_id?: number | null;
};

type CustomerOption = {
  id: number;
  reference?: string;
  name: string;
};

type AgentOption = {
  id: number;
  name: string;
  status?: string;
};

export type RentalDraft = {
  id: number;
  status: string;
  property_id: number;
  customer_id: number;
  agent_id: number | null;
  start_date: string;
  end_date: string;
  monthly_rent: string | number;
  security_deposit: string | number;
  payment_due_day: number;
  notes: string | null;
  currency?: string;
  property?: {
    id: number;
    title: string;
    reference?: string;
  } | null;
  customer?: {
    id: number;
    name: string;
    reference?: string;
  } | null;
  agent?: {
    id: number;
    name: string;
  } | null;
};

type Props = {
  account: Account;
  rental?: RentalDraft | null;
  onClose: () => void;
  onSaved: () => void;
};

type PageResult<T> = {
  data: T[];
};

type ApiErrorData = {
  message?: string;
  errors?: Record<string, string[]>;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 " +
  "bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-500 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-100 disabled:opacity-50";

const buttonClass =
  "rounded-lg border border-slate-300 px-4 py-2 " +
  "text-sm font-semibold text-[#263956] disabled:opacity-50";

const primaryClass =
  "rounded-lg bg-[#263956] px-5 py-2.5 " +
  "text-sm font-bold text-white disabled:opacity-50";

async function readApi<T>(response: Response): Promise<T> {
  const raw: unknown = await response.json().catch(() => null);

  const data =
    raw && typeof raw === "object"
      ? (raw as ApiErrorData)
      : null;

  if (!response.ok) {
    const firstError = Object.values(data?.errors || {})
      .flat()
      .find((item) => typeof item === "string");

    throw new Error(
      firstError ||
        data?.message ||
        `Request failed (HTTP ${response.status}).`,
    );
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Unexpected response from the server.");
  }

  return raw as T;
}

function validAmount(value: string, positive: boolean): boolean {
  const amount = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    return false;
  }

  const numeric = Number(amount);

  return (
    Number.isFinite(numeric) &&
    (positive ? numeric > 0 : numeric >= 0)
  );
}

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function hasRole(account: Account): boolean {
  return (account.roles || []).some((role) =>
    ["super_admin", "admin", "property_manager"].includes(role),
  );
}

export default function RentalAgreementFormModal({
  account,
  rental,
  onClose,
  onSaved,
}: Props) {
  const editing = rental !== null && rental !== undefined;

  const canSave =
    hasRole(account) &&
    (account.permissions || []).includes(
      editing ? "rentals.update" : "rentals.create",
    ) &&
    (!editing || rental?.status === "draft");

  const canReadProperties =
    account.permissions.includes("properties.view");

  const canReadCustomers =
    account.permissions.includes("customers.view");

  const canReadAgents =
    account.permissions.includes("users.view");

  const [propertySearch, setPropertySearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const [selectedProperty, setSelectedProperty] =
    useState<PropertyOption | null>(null);

  const [propertyId, setPropertyId] = useState(
    rental ? String(rental.property_id) : "",
  );

  const [customerId, setCustomerId] = useState(
    rental ? String(rental.customer_id) : "",
  );

  const [agentId, setAgentId] = useState(
    rental?.agent_id ? String(rental.agent_id) : "",
  );

  const [agentChanged, setAgentChanged] = useState(false);

  const [startDate, setStartDate] = useState(
    dateOnly(rental?.start_date),
  );

  const [endDate, setEndDate] = useState(
    dateOnly(rental?.end_date),
  );

  const [monthlyRent, setMonthlyRent] = useState(
    rental ? String(rental.monthly_rent) : "",
  );

  const [deposit, setDeposit] = useState(
    rental ? String(rental.security_deposit) : "0",
  );

  const [dueDay, setDueDay] = useState(
    rental ? String(rental.payment_due_day) : "1",
  );

  const [notes, setNotes] = useState(rental?.notes || "");

  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [propertyError, setPropertyError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [agentError, setAgentError] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canSave || editing || !canReadProperties) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoadingProperties(true);
      setPropertyError("");

      try {
        const params = new URLSearchParams({
          listing_type: "rent",
          availability_status: "available",
          per_page: "100",
        });

        if (propertySearch.trim()) {
          params.set("search", propertySearch.trim());
        }

        const response = await fetch(
          `${API}/properties?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );

        const result =
          await readApi<PageResult<PropertyOption>>(response);

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid properties response.");
        }

        if (!controller.signal.aborted) {
          setProperties(
            result.data.filter(
              (property) =>
                property.listing_type === "rent" &&
                property.verification_status === "verified" &&
                property.availability_status === "available" &&
                Boolean(property.is_published),
            ),
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setProperties([]);
          setPropertyError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rental properties.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProperties(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSave, editing, canReadProperties, propertySearch]);

  useEffect(() => {
    if (!canSave || !canReadCustomers) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoadingCustomers(true);
      setCustomerError("");

      try {
        const params = new URLSearchParams({
          per_page: "100",
        });

        if (customerSearch.trim()) {
          params.set("search", customerSearch.trim());
        }

        const response = await fetch(
          `${API}/customers?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );

        const result =
          await readApi<PageResult<CustomerOption>>(response);

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid customers response.");
        }

        if (!controller.signal.aborted) {
          setCustomers(result.data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setCustomers([]);
          setCustomerError(
            cause instanceof Error
              ? cause.message
              : "Unable to load customers.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCustomers(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSave, canReadCustomers, customerSearch]);

  useEffect(() => {
    if (!canSave || !canReadAgents) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoadingAgents(true);
      setAgentError("");

      try {
        const params = new URLSearchParams({
          role: "agent",
          status: "active",
          per_page: "100",
        });

        if (agentSearch.trim()) {
          params.set("search", agentSearch.trim());
        }

        const response = await fetch(
          `${API}/users?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );

        const result =
          await readApi<PageResult<AgentOption>>(response);

        if (!Array.isArray(result.data)) {
          throw new Error("Invalid agents response.");
        }

        if (!controller.signal.aborted) {
          setAgents(
            result.data.filter(
              (agent) => agent.status === "active",
            ),
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAgents([]);
          setAgentError(
            cause instanceof Error
              ? cause.message
              : "Unable to load active agents.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingAgents(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSave, canReadAgents, agentSearch]);

  const propertyOptions =
    selectedProperty &&
    !properties.some((item) => item.id === selectedProperty.id)
      ? [selectedProperty, ...properties]
      : properties;

  const customerOptions =
    rental?.customer &&
    !customers.some((item) => item.id === rental.customer_id)
      ? [rental.customer, ...customers]
      : customers;

  const agentOptions =
    rental?.agent &&
    !agents.some((item) => item.id === rental.agent_id)
      ? [
          {
            ...rental.agent,
            status: "existing",
          },
          ...agents,
        ]
      : agents;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || busy) return;

    setError("");

    if (!editing && !canReadProperties) {
      setError("Property viewing permission is required.");
      return;
    }

    if (!editing && !canReadCustomers) {
      setError("Customer viewing permission is required.");
      return;
    }

    const property = Number(propertyId);
    const customer = Number(customerId);

    if (
      !Number.isSafeInteger(property) ||
      property <= 0 ||
      !Number.isSafeInteger(customer) ||
      customer <= 0
    ) {
      setError("Select a valid property and customer.");
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      endDate <= startDate
    ) {
      setError("Lease end date must be after the start date.");
      return;
    }

    if (!validAmount(monthlyRent, true)) {
      setError("Monthly rent must be greater than zero, with at most two decimals.");
      return;
    }

    if (deposit.trim() && !validAmount(deposit, false)) {
      setError("Security deposit must be zero or greater.");
      return;
    }

    const paymentDay = Number(dueDay);

    if (
      !Number.isSafeInteger(paymentDay) ||
      paymentDay < 1 ||
      paymentDay > 28
    ) {
      setError("Payment due day must be between 1 and 28.");
      return;
    }

    if (notes.length > 3000) {
      setError("Notes cannot exceed 3,000 characters.");
      return;
    }

    const payload: Record<string, string | number | null> = {
      customer_id: customer,
      start_date: startDate,
      end_date: endDate,
      monthly_rent: monthlyRent.trim(),
      payment_due_day: paymentDay,
      notes: notes.trim() || null,
    };

    if (!editing) {
      payload.property_id = property;
    }

    if (deposit.trim()) {
      payload.security_deposit = deposit.trim();
    }

    if (canReadAgents && (agentChanged || (!editing && agentId))) {
      if (agentId) {
        const selectedAgent = Number(agentId);

        if (!Number.isSafeInteger(selectedAgent) || selectedAgent <= 0) {
          setError("Select a valid active agent.");
          return;
        }

        payload.agent_id = selectedAgent;
      } else if (editing && agentChanged) {
        payload.agent_id = null;
      }
    }

    setBusy(true);

    try {
      const response = await fetch(
        editing ? `${API}/rentals/${rental?.id}` : `${API}/rentals`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await readApi<{
        rental?: { id: number };
      }>(response);

      if (!result.rental?.id) {
        throw new Error(
          "Rental response was incomplete. Refresh before trying again.",
        );
      }

      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save rental agreement.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          editing ? "Edit Draft Rental Agreement" : "Register Rental Agreement"
        }
        className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#263956]">
              {editing
                ? "Edit Draft Rental Agreement"
                : "Register New Rental Agreement"}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {editing
                ? "Only draft agreements can be edited."
                : "New agreements are saved as drafts. Activation and rent billing are separate actions."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={buttonClass}
          >
            Close
          </button>
        </div>

        {!canSave ? (
          <p role="alert" className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            You do not have permission to perform this operation,
            or this agreement is no longer a draft.
          </p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <section className="space-y-3">
              <h3 className="font-bold text-[#263956]">
                Property and Customer
              </h3>

              {editing ? (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <span className="font-semibold">Property: </span>
                  {rental?.property?.title ||
                    `Property #${rental?.property_id}`}
                  <p className="mt-1 text-xs text-slate-500">
                    Property cannot be changed on an existing rental.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold">
                    Search Rental Properties
                    <input
                      type="search"
                      value={propertySearch}
                      onChange={(event) => setPropertySearch(event.target.value)}
                      disabled={busy || !canReadProperties}
                      placeholder="Search by title or reference"
                      className={inputClass}
                    />
                  </label>

                  <label className="mt-3 block text-sm font-semibold">
                    Rental Property *
                    <select
                      value={propertyId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPropertyId(value);
                        setSelectedProperty(
                          propertyOptions.find(
                            (property) => String(property.id) === value,
                          ) || null,
                        );
                      }}
                      disabled={busy || loadingProperties || !canReadProperties}
                      className={inputClass}
                      required
                    >
                      <option value="">Select an eligible property</option>
                      {propertyOptions.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.reference} — {property.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    Only verified, published, available rental properties are shown.
                    {loadingProperties ? " Searching..." : ""}
                  </p>

                  {propertyError && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                      {propertyError}
                    </p>
                  )}

                  {!canReadProperties && (
                    <p className="mt-2 text-xs text-amber-800">
                      Property viewing permission is required to select a property.
                    </p>
                  )}
                </div>
              )}

              <div>
                {canReadCustomers && (
                  <label className="block text-sm font-semibold">
                    Search Customers
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      disabled={busy}
                      placeholder="Search customers"
                      className={inputClass}
                    />
                  </label>
                )}

                <label className="mt-3 block text-sm font-semibold">
                  Customer *
                  {canReadCustomers ? (
                    <select
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      disabled={busy || loadingCustomers}
                      className={inputClass}
                      required
                    >
                      <option value="">Select a customer</option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.reference || `#${customer.id}`} — {customer.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 rounded-lg border bg-slate-50 p-3 text-sm">
                      {rental?.customer?.name ||
                        `Customer #${rental?.customer_id || "—"}`}
                    </div>
                  )}
                </label>

                {loadingCustomers && (
                  <p className="mt-1 text-xs text-slate-500">
                    Loading customers...
                  </p>
                )}

                {customerError && (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {customerError}
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t pt-5">
              <h3 className="font-bold text-[#263956]">
                Lease Period and Financial Terms
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Start Date *
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    disabled={busy}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-semibold">
                  End Date *
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    disabled={busy}
                    min={startDate || undefined}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Monthly Rent *
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthlyRent}
                    onChange={(event) => setMonthlyRent(event.target.value)}
                    disabled={busy}
                    placeholder="e.g. 350000"
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Security Deposit
                  <input
                    type="text"
                    inputMode="decimal"
                    value={deposit}
                    onChange={(event) => setDeposit(event.target.value)}
                    disabled={busy}
                    placeholder="0"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Monthly Payment Due Day *
                  <input
                    type="number"
                    min={1}
                    max={28}
                    step={1}
                    value={dueDay}
                    onChange={(event) => setDueDay(event.target.value)}
                    disabled={busy}
                    required
                    className={inputClass}
                  />
                </label>
              </div>

              <p className="text-xs text-slate-500">
                Laravel checks lease dates, overlapping agreements,
                property eligibility and financial amounts before saving.
              </p>
            </section>

            {canReadAgents && (
              <section className="space-y-3 border-t pt-5">
                <h3 className="font-bold text-[#263956]">
                  Assigned Agent (Optional)
                </h3>

                <label className="block text-sm font-semibold">
                  Search Active Agents
                  <input
                    type="search"
                    value={agentSearch}
                    onChange={(event) => setAgentSearch(event.target.value)}
                    disabled={busy}
                    placeholder="Search agent"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Agent
                  <select
                    value={agentId}
                    onChange={(event) => {
                      setAgentId(event.target.value);
                      setAgentChanged(true);
                    }}
                    disabled={busy || loadingAgents}
                    className={inputClass}
                  >
                    <option value="">
                      {editing
                        ? "No assigned agent"
                        : "Use property's assigned agent"}
                    </option>

                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>

                {agentError && (
                  <p role="alert" className="text-xs text-red-700">
                    {agentError}
                  </p>
                )}
              </section>
            )}

            <section className="border-t pt-5">
              <label className="block text-sm font-semibold">
                Agreement Notes
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={busy}
                  placeholder="Optional rental agreement notes"
                  className={inputClass}
                />
              </label>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <p className="max-w-sm text-xs text-slate-500">
                Saving a draft does not activate the lease or
                generate rental bills.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className={buttonClass}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={busy || !canSave}
                  className={primaryClass}
                >
                  {busy
                    ? "Saving..."
                    : editing
                      ? "Save Draft Changes"
                      : "Register Draft Rental"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
