"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Category = {
  id: number;
  name: string;
};

type FormValues = {
  title: string;
  description: string;
  category_id: string;
  listing_type: string;
  asking_price: string;
  currency: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  address: string;
  land_size_sqm: string;
  building_size_sqm: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  floors: string;
  is_negotiable: string;
  is_furnished: string;
};

const initial: FormValues = {
  title: "",
  description: "",
  category_id: "",
  listing_type: "sale",
  asking_price: "",
  currency: "RWF",
  province: "",
  district: "",
  sector: "",
  cell: "",
  village: "",
  address: "",
  land_size_sqm: "",
  building_size_sqm: "",
  bedrooms: "",
  bathrooms: "",
  parking_spaces: "",
  floors: "",
  is_negotiable: "false",
  is_furnished: "false",
};

const endpoint = "/api/dashboard/manage";

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

const optionalNumbers = [
  "land_size_sqm",
  "building_size_sqm",
  "bedrooms",
  "bathrooms",
  "parking_spaces",
  "floors",
] as const;

export default function PropertyRegistrationForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [form, setForm] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    async function loadCategories() {
      setLoadingCategories(true);
      setError("");

      try {
        const response = await fetch(
          `${endpoint}/property-categories`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property categories."),
          );
        }

        const data = result as { categories?: Category[] };

        if (!Array.isArray(data.categories)) {
          throw new Error("Invalid property categories response.");
        }

        if (!controller.signal.aborted) {
          setCategories(data.categories);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property categories.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCategories(false);
        }
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, [open]);

  function update(key: keyof FormValues, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");
    setNotice("");

    if (
      !form.title.trim() ||
      !form.category_id ||
      !form.asking_price.trim()
    ) {
      setError("Title, category and asking price are required.");
      return;
    }

    const price = Number(form.asking_price);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Asking price must be greater than zero.");
      return;
    }

    const categoryId = Number(form.category_id);

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0 ||
      !categories.some((category) => category.id === categoryId)
    ) {
      setError("Select a valid property category.");
      return;
    }

    const payload: Record<string, string | number | boolean> = {
      title: form.title.trim(),
      category_id: categoryId,
      listing_type: form.listing_type,
      asking_price: price,
      currency: form.currency,
      is_negotiable: form.is_negotiable === "true",
      is_furnished: form.is_furnished === "true",
    };

    const optionalText: (keyof FormValues)[] = [
      "description",
      "province",
      "district",
      "sector",
      "cell",
      "village",
      "address",
    ];

    for (const key of optionalText) {
      const value = form[key].trim();
      if (value) payload[key] = value;
    }

    for (const key of optionalNumbers) {
      const value = form[key].trim();

      if (!value) continue;

      const number = Number(value);
      const integerField = [
        "bedrooms",
        "bathrooms",
        "parking_spaces",
        "floors",
      ].includes(key);

      if (
        !Number.isFinite(number) ||
        (integerField
          ? !Number.isInteger(number) || number < 0 || number > 999
          : number <= 0)
      ) {
        setError(`Please enter a valid ${key.replaceAll("_", " ")}.`);
        return;
      }

      payload[key] = number;
    }

    setBusy(true);

    try {
      const response = await fetch(`${endpoint}/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to register property."),
        );
      }

      const data = result as {
        property?: {
          id?: number;
          reference?: string;
        };
      };

      if (!data.property?.id) {
        throw new Error("Invalid property registration response.");
      }

      setNotice(
        `Property ${data.property.reference ?? ""} registered successfully.`,
      );
      setForm({ ...initial });
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to register property.",
      );
    } finally {
      setBusy(false);
    }
  }

  const textField = (
    key: keyof FormValues,
    label: string,
    type: "text" | "number" = "text",
    required = false,
  ) => (
    <label key={key} className="block space-y-1.5">
      <span className="text-sm font-semibold text-[#263956]">
        {label}
      </span>
      <input
        className={fieldClass}
        type={type}
        value={form[key]}
        onChange={(event) => update(key, event.target.value)}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        maxLength={type === "text" ? 255 : undefined}
      />
    </label>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setNotice("");
          setOpen(true);
        }}
        className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white"
      >
        + Register Property
      </button>

      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-registration-title"
            className="mx-auto my-5 max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="property-registration-title"
                  className="text-xl font-bold text-[#263956]"
                >
                  Register New Property
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  New properties are saved as unpublished drafts.
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                aria-label="Close registration form"
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <form onSubmit={(event) => void submit(event)} className="space-y-6">
              <section className="space-y-4">
                <h3 className="font-bold text-[#263956]">
                  Basic Information
                </h3>

                {textField("title", "Property Title *", "text", true)}

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[#263956]">
                    Description
                  </span>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    className={fieldClass}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[#263956]">
                      Property Category *
                    </span>
                    <select
                      value={form.category_id}
                      onChange={(event) =>
                        update("category_id", event.target.value)
                      }
                      required
                      disabled={loadingCategories}
                      className={fieldClass}
                    >
                      <option value="">
                        {loadingCategories
                          ? "Loading categories..."
                          : "Select category"}
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[#263956]">
                      Listing Type *
                    </span>
                    <select
                      value={form.listing_type}
                      onChange={(event) =>
                        update("listing_type", event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="sale">For Sale</option>
                      <option value="rent">For Rent</option>
                    </select>
                  </label>

                  {textField(
                    "asking_price",
                    "Asking Price *",
                    "number",
                    true,
                  )}

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[#263956]">
                      Currency
                    </span>
                    <select
                      value={form.currency}
                      onChange={(event) =>
                        update("currency", event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="RWF">RWF</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[#263956]">
                      Negotiable Price
                    </span>
                    <select
                      value={form.is_negotiable}
                      onChange={(event) =>
                        update("is_negotiable", event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-4 border-t pt-5">
                <h3 className="font-bold text-[#263956]">
                  Property Location
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  {textField("province", "Province")}
                  {textField("district", "District")}
                  {textField("sector", "Sector")}
                  {textField("cell", "Cell")}
                  {textField("village", "Village")}
                  {textField("address", "Street / Address")}
                </div>
              </section>

              <section className="space-y-4 border-t pt-5">
                <h3 className="font-bold text-[#263956]">
                  Property Specifications
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  {textField("land_size_sqm", "Land Size (m²)", "number")}
                  {textField("building_size_sqm", "Building Size (m²)", "number")}
                  {textField("bedrooms", "Bedrooms", "number")}
                  {textField("bathrooms", "Bathrooms", "number")}
                  {textField("parking_spaces", "Parking Spaces", "number")}
                  {textField("floors", "Floors", "number")}

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[#263956]">
                      Furnished
                    </span>
                    <select
                      value={form.is_furnished}
                      onChange={(event) =>
                        update("is_furnished", event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                </div>
              </section>

              <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={busy || loadingCategories || categories.length === 0}
                  className="rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? "Registering..." : "Save Property as Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
