"use client";

import { useState, type FormEvent } from "react";
import {
  apiError,
  customerTypes,
  readJson,
  type Customer,
} from "@/lib/crm/customers";

type Props = {
  customer: Customer | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function CustomerForm({
  customer,
  onClose,
  onSaved,
}: Props) {
  const editing = customer !== null;

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [type, setType] = useState(customer?.customer_type ?? "buyer");
  const [location, setLocation] = useState(
    customer?.preferred_location ?? "",
  );
  const [minimum, setMinimum] = useState(
    customer?.budget_min?.toString() ?? "",
  );
  const [maximum, setMaximum] = useState(
    customer?.budget_max?.toString() ?? "",
  );
  const [currency, setCurrency] = useState(customer?.currency ?? "RWF");
  const [status, setStatus] = useState(customer?.status ?? "active");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const field =
    "w-full rounded-xl border border-[#dfe5f0] bg-white px-4 py-3 text-sm text-[#34435e] outline-none focus:border-[#626df1]";
  const label = "mb-2 block text-sm font-semibold text-[#405575]";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError("");

    if (
      minimum !== "" &&
      maximum !== "" &&
      Number(maximum) < Number(minimum)
    ) {
      setError("Maximum budget cannot be below minimum budget.");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      customer_type: type,
      preferred_location: location.trim() || null,
      budget_min: minimum === "" ? null : Number(minimum),
      budget_max: maximum === "" ? null : Number(maximum),
      currency,
      notes: notes.trim() || null,
      status,
    };

    try {
      const response = await fetch(
        editing
          ? `/api/dashboard/manage/customers/${customer.id}`
          : "/api/dashboard/manage/customers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(apiError(result, "Unable to save customer."));
      }

      onSaved(
        editing
          ? "Customer updated successfully."
          : "Customer registered successfully.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save customer.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17243d]/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-form-title"
        className="mx-auto my-8 w-full max-w-[740px] rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#e7ecf5] p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#626df1]">
              Gracious Investment · CRM
            </p>
            <h2
              id="customer-form-title"
              className="mt-2 text-xl font-bold text-[#263956]"
            >
              {editing ? "Edit Customer" : "Register Customer"}
            </h2>
            <p className="mt-2 text-sm text-[#8190a9]">
              {editing
                ? `Update ${customer.reference}`
                : "Enter the customer's information below."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close customer form"
            className="rounded-lg border border-[#e1e6ef] px-3 py-2"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="customer-name" className={label}>
                Full Name *
              </label>
              <input
                id="customer-name"
                required
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="Customer name"
              />
            </div>

            <div>
              <label htmlFor="customer-type" className={label}>
                Customer Type
              </label>
              <select
                id="customer-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={field}
              >
                {customerTypes.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="customer-phone" className={label}>
                Phone Number
              </label>
              <input
                id="customer-phone"
                type="tel"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
                placeholder="078..."
              />
            </div>

            <div>
              <label htmlFor="customer-email" className={label}>
                Email Address
              </label>
              <input
                id="customer-email"
                type="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <label htmlFor="customer-location" className={label}>
                Preferred Location
              </label>
              <input
                id="customer-location"
                maxLength={255}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={field}
                placeholder="Kigali, Gasabo..."
              />
            </div>

            <div>
              <label htmlFor="customer-status" className={label}>
                Status
              </label>
              <select
                id="customer-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={field}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label htmlFor="customer-min" className={label}>
                Minimum Budget
              </label>
              <input
                id="customer-min"
                type="number"
                min="0"
                step="any"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                className={field}
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="customer-max" className={label}>
                Maximum Budget
              </label>
              <input
                id="customer-max"
                type="number"
                min="0"
                step="any"
                value={maximum}
                onChange={(e) => setMaximum(e.target.value)}
                className={field}
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="customer-currency" className={label}>
                Currency
              </label>
              <select
                id="customer-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={field}
              >
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="customer-notes" className={label}>
              Notes
            </label>
            <textarea
              id="customer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={5000}
              className={field}
              placeholder="Customer preferences or additional information..."
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#e7ecf5] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#dfe5f0] px-5 py-3 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Register Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
