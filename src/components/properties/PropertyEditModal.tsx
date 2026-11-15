"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Category = { id: number; name: string };

type Property = {
  id: number;
  title: string;
  description: string | null;
  category_id: number;
  listing_type: string;
  asking_price: string | number;
  currency: string;
  is_negotiable: boolean;
  is_furnished: boolean;
  verification_status: string;
  province: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  address: string | null;
  land_size_sqm: string | number | null;
  building_size_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;
};

type EditableKey =
  | "title" | "description" | "category_id"
  | "listing_type" | "asking_price" | "currency"
  | "province" | "district" | "sector" | "cell"
  | "village" | "address" | "land_size_sqm"
  | "building_size_sqm" | "bedrooms" | "bathrooms"
  | "parking_spaces" | "floors";

const textKeys: EditableKey[] = [
  "description", "province", "district", "sector",
  "cell", "village", "address",
];

const numberKeys: EditableKey[] = [
  "land_size_sqm", "building_size_sqm",
  "bedrooms", "bathrooms", "parking_spaces", "floors",
];

const integerKeys = new Set<EditableKey>([
  "bedrooms", "bathrooms", "parking_spaces", "floors",
]);

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";

export default function PropertyEditModal({
  propertyId,
  onClose,
  onSaved,
}: {
  propertyId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [property, setProperty] = useState<Property | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [propertyResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/dashboard/manage/properties/${propertyId}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/dashboard/manage/property-categories", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const [propertyResult, categoriesResult] = await Promise.all([
          readJson(propertyResponse),
          readJson(categoriesResponse),
        ]);

        if (!propertyResponse.ok) {
          throw new Error(
            apiError(propertyResult, "Unable to load property."),
          );
        }

        if (!categoriesResponse.ok) {
          throw new Error(
            apiError(categoriesResult, "Unable to load categories."),
          );
        }

        const item = (propertyResult as { property?: Property }).property;
        const list = (categoriesResult as { categories?: Category[] }).categories;

        if (!item || item.id !== propertyId || !Array.isArray(list)) {
          throw new Error("Invalid property editing response.");
        }

        const initial: Record<string, string> = {};

        const keys: EditableKey[] = [
          "title", "description", "category_id", "listing_type",
          "asking_price", "currency", "province", "district",
          "sector", "cell", "village", "address",
          ...numberKeys,
        ];

        for (const key of keys) {
          initial[key] = String(item[key] ?? "");
        }

        initial.is_negotiable = item.is_negotiable ? "true" : "false";
        initial.is_furnished = item.is_furnished ? "true" : "false";

        if (!controller.signal.aborted) {
          setProperty(item);
          setCategories(list);
          setValues(initial);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [propertyId]);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property || busy) return;

    setError("");

    if (!values.title?.trim()) {
      setError("Property title is required.");
      return;
    }

    const categoryId = Number(values.category_id);
    const price = Number(values.asking_price);

    if (!categories.some((c) => c.id === categoryId)) {
      setError("Select an active property category.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Asking price must be greater than zero.");
      return;
    }

    const payload: Record<string, string | number | boolean | null> = {
      title: values.title.trim(),
      category_id: categoryId,
      listing_type: values.listing_type,
      asking_price: price,
      currency: values.currency,
      is_negotiable: values.is_negotiable === "true",
      is_furnished: values.is_furnished === "true",
    };

    for (const key of textKeys) {
      payload[key] = values[key]?.trim() || null;
    }

    for (const key of numberKeys) {
      const raw = values[key]?.trim() ?? "";
      if (!raw) {
        payload[key] = null;
        continue;
      }

      const number = Number(raw);
      const valid = integerKeys.has(key)
        ? Number.isInteger(number) && number >= 0 && number <= 999
        : Number.isFinite(number) && number > 0;

      if (!valid) {
        setError(`Invalid ${key.replaceAll("_", " ")}.`);
        return;
      }

      payload[key] = number;
    }

    if (
      property.verification_status === "verified" &&
      !window.confirm(
        "Editing a verified property will require new verification " +
        "and remove it from publication. Continue?"
      )
    ) return;

    setBusy(true);

    try {
      const response = await fetch(
        `/api/dashboard/manage/properties/${propertyId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to update property."),
        );
      }

      const updated = (result as { property?: Property }).property;
      if (!updated || updated.id !== propertyId) {
        throw new Error("Invalid property update response.");
      }

      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update property.",
      );
    } finally {
      setBusy(false);
    }
  }

  function input(
    key: EditableKey,
    label: string,
    numeric = false,
    required = false,
  ) {
    return (
      <label key={key} className="block space-y-1">
        <span className="text-sm font-semibold text-[#263956]">{label}</span>
        <input
          type={numeric ? "number" : "text"}
          className={field}
          value={values[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
          required={required}
          min={numeric ? (integerKeys.has(key) ? "0" : "0.000001") : undefined}
          maxLength={numeric ? undefined : 255}
          step={numeric ? (integerKeys.has(key) ? "1" : "any") : undefined}
        />
      </label>
    );
  }

  function select(
    key: string,
    label: string,
    options: { value: string; label: string }[],
  ) {
    return (
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-[#263956]">{label}</span>
        <select
          value={values[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
          className={field}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-property-title"
        className="mx-auto my-5 max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="edit-property-title" className="text-xl font-bold text-[#263956]">
            Edit Property
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            Close
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && (
          <p className="py-8 text-sm text-slate-500">Loading property...</p>
        )}

        {!loading && property && (
          <form onSubmit={(event) => void save(event)} className="space-y-6">
            {property.verification_status === "verified" && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Saving changes to this verified property will require
                another verification and remove its published status.
              </p>
            )}

            <section className="space-y-4">
              <h3 className="font-bold text-[#263956]">Basic Information</h3>
              {input("title", "Property Title", false, true)}

              <label className="block space-y-1">
                <span className="text-sm font-semibold">Description</span>
                <textarea
                  rows={4}
                  className={field}
                  value={values.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {select(
                  "category_id",
                  "Category",
                  categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                )}
                {select("listing_type", "Listing Type", [
                  { value: "sale", label: "For Sale" },
                  { value: "rent", label: "For Rent" },
                ])}
                {input("asking_price", "Asking Price", true, true)}
                {select("currency", "Currency", [
                  { value: "RWF", label: "RWF" },
                  { value: "USD", label: "USD" },
                ])}
                {select("is_negotiable", "Negotiable", [
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ])}
                {select("is_furnished", "Furnished", [
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ])}
              </div>
            </section>

            <section className="space-y-4 border-t pt-5">
              <h3 className="font-bold text-[#263956]">Location</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("province", "Province")}
                {input("district", "District")}
                {input("sector", "Sector")}
                {input("cell", "Cell")}
                {input("village", "Village")}
                {input("address", "Address")}
              </div>
            </section>

            <section className="space-y-4 border-t pt-5">
              <h3 className="font-bold text-[#263956]">
                Property Specifications
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("land_size_sqm", "Land Size (m²)", true)}
                {input("building_size_sqm", "Building Size (m²)", true)}
                {input("bedrooms", "Bedrooms", true)}
                {input("bathrooms", "Bathrooms", true)}
                {input("parking_spaces", "Parking Spaces", true)}
                {input("floors", "Floors", true)}
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border px-5 py-2.5 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || categories.length === 0}
                className="rounded-xl bg-[#626df1] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
