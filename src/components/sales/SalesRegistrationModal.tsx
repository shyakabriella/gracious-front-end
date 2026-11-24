"use client";

import { FormEvent, useEffect, useState } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Property = {
  id: number;
  reference: string;
  title: string;
  listing_type: string;
  verification_status: string;
  availability_status: string;
  is_published: boolean | number;
  agent_id: number | null;
  currency: string;
  asking_price: string | number;
};

type Customer = {
  id: number;
  reference: string;
  name: string;
  created_by?: number | null;
};

type Staff = {
  id: number;
  name: string;
  status: string;
};

type PageResult<T> = {
  data: T[];
  total: number;
  last_page: number;
};

type Props = {
  account: Account;
  onClose: () => void;
  onCreated: () => void;
};

const API = "/api/dashboard/manage";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 " +
  "text-sm text-slate-900 focus:border-blue-600 focus:outline-none";

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (data && typeof data === "object") {
      const result = data as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      const firstError = result.errors
        ? Object.values(result.errors)
            .flat()
            .find((message) => typeof message === "string")
        : undefined;

      throw new Error(
        firstError ||
          result.message ||
          "The request could not be completed.",
      );
    }

    throw new Error(`Request failed (HTTP ${response.status}).`);
  }

  return data as T;
}

export default function SalesRegistrationModal({
  account,
  onClose,
  onCreated,
}: Props) {
  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const [propertySearch, setPropertySearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");

  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Staff[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [agentId, setAgentId] = useState("");

  const [agreedPrice, setAgreedPrice] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [propertyError, setPropertyError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [agentError, setAgentError] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canReadProperties =
    account.permissions.includes("properties.view");

  const canReadCustomers =
    account.permissions.includes("customers.view");

  const canReadAgents =
    account.permissions.includes("users.view");

  useEffect(() => {
    if (!canReadProperties) {
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoadingProperties(true);
      setPropertyError("");

      try {
        const params = new URLSearchParams({
          listing_type: "sale",
          availability_status: "available",
          per_page: "100",
        });

        if (propertySearch.trim()) {
          params.set("search", propertySearch.trim());
        }

        const response = await fetch(
          `${API}/properties?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<PageResult<Property>>(
          response,
        );

        if (!Array.isArray(result.data)) {
          throw new Error("Unexpected properties response.");
        }

        if (!controller.signal.aborted) {
          setProperties(
            result.data.filter(
              (property) =>
                property.listing_type === "sale" &&
                property.availability_status === "available" &&
                property.verification_status === "verified" &&
                Boolean(property.is_published) &&
                (isAdmin ||
                  Number(property.agent_id) === account.id),
            ),
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setProperties([]);
          setPropertyError(
            cause instanceof Error
              ? cause.message
              : "Unable to load properties.",
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
  }, [propertySearch, canReadProperties, isAdmin, account.id]);

  useEffect(() => {
    if (!canReadCustomers) {
      return;
    }

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
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<PageResult<Customer>>(
          response,
        );

        if (!Array.isArray(result.data)) {
          throw new Error("Unexpected customers response.");
        }

        if (!controller.signal.aborted) {
          setCustomers(
            isAdmin
              ? result.data
              : result.data.filter(
                  (customer) =>
                    Number(customer.created_by) === account.id,
                ),
          );
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
  }, [customerSearch, canReadCustomers, isAdmin, account.id]);

  useEffect(() => {
    if (!isAdmin || !canReadAgents) {
      return;
    }

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
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<PageResult<Staff>>(
          response,
        );

        if (!Array.isArray(result.data)) {
          throw new Error("Unexpected staff response.");
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
              : "Unable to load sales agents.",
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
  }, [agentSearch, isAdmin, canReadAgents]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");

    const property = properties.find(
      (item) => item.id === Number(propertyId),
    );

    const customer = customers.find(
      (item) => item.id === Number(customerId),
    );

    if (!property || !customer) {
      setError(
        "Select an eligible property and an authorized buyer.",
      );
      return;
    }

    if (
      isAdmin &&
      !agents.some((agent) => agent.id === Number(agentId))
    ) {
      setError("Select an active sales agent.");
      return;
    }

    const price = agreedPrice.trim();

    if (
      !/^\d+(\.\d{1,2})?$/.test(price) ||
      !(Number(price) > 0) ||
      !Number.isFinite(Number(price))
    ) {
      setError("Enter a valid agreed price greater than zero.");
      return;
    }

    if (notes.length > 3000) {
      setError("Notes must not exceed 3,000 characters.");
      return;
    }

    if (
      !window.confirm(
        `Register a new sale negotiation for ${property.title} ` +
          `with ${customer.name} for ${property.currency} ${price}?`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const payload: Record<string, unknown> = {
        property_id: property.id,
        customer_id: customer.id,
        agreed_price: price,
      };

      if (isAdmin) {
        payload.agent_id = Number(agentId);
      }

      if (completionDate) {
        payload.expected_completion_date = completionDate;
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      const response = await fetch(`${API}/sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await readResponse<{
        sale: { id: number };
      }>(response);

      if (!result.sale?.id) {
        throw new Error(
          "Sale was submitted, but the response was unexpected. " +
            "Check Sales Management before submitting again.",
        );
      }

      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to register the sale.",
      );
    } finally {
      setBusy(false);
    }
  }

  const missingPermissions = [
    !canReadProperties ? "properties.view" : null,
    !canReadCustomers ? "customers.view" : null,
    isAdmin && !canReadAgents ? "users.view" : null,
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Register property sale"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#263956]">
              Register New Sale
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Start a new property sale negotiation.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        {missingPermissions.length > 0 && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            Your account needs these permissions to use the
            registration selectors: {missingPermissions.join(", ")}.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="sale-property-search"
              className="block text-sm font-semibold text-slate-700"
            >
              Search sale property
            </label>

            <input
              id="sale-property-search"
              value={propertySearch}
              onChange={(event) => {
                setPropertySearch(event.target.value);
                setPropertyId("");
              }}
              placeholder="Property name or reference"
              className={`mt-2 ${fieldClass}`}
              disabled={busy || !canReadProperties}
              maxLength={100}
            />

            <label
              htmlFor="sale-property"
              className="mt-3 block text-sm font-semibold text-slate-700"
            >
              Eligible property
            </label>

            <select
              id="sale-property"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              className={`mt-2 ${fieldClass}`}
              disabled={busy || loadingProperties || !canReadProperties}
              required
            >
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title} — {property.reference}
                </option>
              ))}
            </select>

            {loadingProperties && (
              <p className="mt-1 text-xs text-slate-500">
                Searching properties...
              </p>
            )}

            {propertyError && (
              <p className="mt-1 text-xs text-red-700">
                {propertyError}
              </p>
            )}

            {!loadingProperties &&
              !propertyError &&
              properties.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  No eligible properties found. A property must be
                  verified, published, available, and listed for sale.
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="sale-customer-search"
              className="block text-sm font-semibold text-slate-700"
            >
              Search buyer
            </label>

            <input
              id="sale-customer-search"
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setCustomerId("");
              }}
              placeholder="Buyer name, phone, or reference"
              className={`mt-2 ${fieldClass}`}
              disabled={busy || !canReadCustomers}
              maxLength={100}
            />

            <label
              htmlFor="sale-customer"
              className="mt-3 block text-sm font-semibold text-slate-700"
            >
              Buyer
            </label>

            <select
              id="sale-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={`mt-2 ${fieldClass}`}
              disabled={busy || loadingCustomers || !canReadCustomers}
              required
            >
              <option value="">Select buyer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.reference}
                </option>
              ))}
            </select>

            {loadingCustomers && (
              <p className="mt-1 text-xs text-slate-500">
                Searching customers...
              </p>
            )}

            {customerError && (
              <p className="mt-1 text-xs text-red-700">
                {customerError}
              </p>
            )}
          </div>

          {isAdmin && (
            <div>
              <label
                htmlFor="sale-agent-search"
                className="block text-sm font-semibold text-slate-700"
              >
                Search sales agent
              </label>

              <input
                id="sale-agent-search"
                value={agentSearch}
                onChange={(event) => {
                  setAgentSearch(event.target.value);
                  setAgentId("");
                }}
                placeholder="Agent name or email"
                className={`mt-2 ${fieldClass}`}
                disabled={busy || !canReadAgents}
                maxLength={100}
              />

              <label
                htmlFor="sale-agent"
                className="mt-3 block text-sm font-semibold text-slate-700"
              >
                Assigned sales agent
              </label>

              <select
                id="sale-agent"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className={`mt-2 ${fieldClass}`}
                disabled={busy || loadingAgents || !canReadAgents}
                required
              >
                <option value="">Select active agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>

              {loadingAgents && (
                <p className="mt-1 text-xs text-slate-500">
                  Searching sales agents...
                </p>
              )}

              {agentError && (
                <p className="mt-1 text-xs text-red-700">
                  {agentError}
                </p>
              )}
            </div>
          )}

          {!isAdmin && (
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              This sale will be assigned to your agent account.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sale-price"
                className="block text-sm font-semibold text-slate-700"
              >
                Agreed selling price
              </label>

              <input
                id="sale-price"
                type="text"
                inputMode="decimal"
                value={agreedPrice}
                onChange={(event) =>
                  setAgreedPrice(event.target.value)
                }
                placeholder="e.g. 85000000.00"
                className={`mt-2 ${fieldClass}`}
                disabled={busy}
                required
              />
            </div>

            <div>
              <label
                htmlFor="sale-completion-date"
                className="block text-sm font-semibold text-slate-700"
              >
                Expected completion (optional)
              </label>

              <input
                id="sale-completion-date"
                type="date"
                value={completionDate}
                onChange={(event) =>
                  setCompletionDate(event.target.value)
                }
                className={`mt-2 ${fieldClass}`}
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="sale-notes"
              className="block text-sm font-semibold text-slate-700"
            >
              Notes (optional)
            </label>

            <textarea
              id="sale-notes"
              rows={3}
              maxLength={3000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`mt-2 ${fieldClass}`}
              disabled={busy}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                loadingProperties ||
                loadingCustomers ||
                loadingAgents ||
                missingPermissions.length > 0 ||
                !propertyId ||
                !customerId ||
                (isAdmin && !agentId)
              }
              className="rounded-lg bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Registering..." : "Register Sale"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
