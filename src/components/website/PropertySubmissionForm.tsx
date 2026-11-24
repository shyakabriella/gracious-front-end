"use client";

import PropertySubmissionMediaUploader, { type SubmissionMediaItem } from "@/components/website/PropertySubmissionMediaUploader";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type Category = {
  id: number;
  name: string;
};

type Fields = {
  submitter_name: string;
  submitter_phone: string;
  submitter_email: string;
  submitter_role: string;
  owner_name: string;
  owner_phone: string;
  submission_purpose: string;
  property_title: string;
  property_description: string;
  category_id: string;
  asking_price: string;
  currency: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  address: string;
  latitude: string;
  longitude: string;
  land_size_sqm: string;
  building_size_sqm: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  floors: string;
};

const emptyFields: Fields = {
  submitter_name: "",
  submitter_phone: "",
  submitter_email: "",
  submitter_role: "owner",
  owner_name: "",
  owner_phone: "",
  submission_purpose: "sale",
  property_title: "",
  property_description: "",
  category_id: "",
  asking_price: "",
  currency: "RWF",
  province: "",
  district: "",
  sector: "",
  cell: "",
  village: "",
  address: "",
  latitude: "",
  longitude: "",
  land_size_sqm: "",
  building_size_sqm: "",
  bedrooms: "",
  bathrooms: "",
  parking_spaces: "",
  floors: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 " +
  "text-sm text-slate-900 outline-none transition focus:border-emerald-700 " +
  "focus:ring-2 focus:ring-emerald-700/10";

const labelClass = "block text-sm font-semibold text-slate-700";

type FormChange = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) => void;

function InputField({
  label,
  name,
  fields,
  onChange,
  required = false,
  type = "text",
  placeholder,
  min,
  max,
  step,
  maxLength = 255,
}: {
  label: string;
  name: keyof Fields;
  fields: Fields;
  onChange: FormChange;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label className={labelClass}>
      {label} {required && <span className="text-amber-600">*</span>}
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        value={fields[name]}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
      />
    </label>
  );
}

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4 border-b border-slate-100 pb-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F4EE] text-sm font-bold text-[#06442D]">
        {number}
      </span>
      <div>
        <h2 className="text-xl font-bold text-[#073B2A]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function PropertySubmissionForm() {
  const [fields, setFields] = useState<Fields>({ ...emptyFields });

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [categoryRetry, setCategoryRetry] = useState(0);

  const [negotiable, setNegotiable] = useState(false);
  const [furnished, setFurnished] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authorityAccepted, setAuthorityAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");

  const [mediaItems, setMediaItems] =
    useState<SubmissionMediaItem[]>([]);

  const [uploadSession, setUploadSession] = useState<{
    id: number;
    token: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setCategoryStatus("loading");

      try {
        const response = await fetch("/api/public/property-categories", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result: unknown = await response.json();

        if (!response.ok || !isRecord(result) || !Array.isArray(result.data)) {
          throw new Error("Category request failed.");
        }

        const list = result.data.filter(
          (item: unknown): item is Category =>
            isRecord(item) &&
            typeof item.id === "number" &&
            Number.isSafeInteger(item.id) &&
            item.id > 0 &&
            typeof item.name === "string",
        );

        if (list.length === 0) {
          throw new Error("No property categories are available.");
        }

        if (!controller.signal.aborted) {
          setCategories(list);
          setCategoryStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setCategoryStatus("error");
        }
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, [categoryRetry]);

  function changeField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const name = event.target.name as keyof Fields;

    setFields((current) => ({
      ...current,
      [name]: event.target.value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || categoryStatus !== "ready") return;

    setSubmitting(true);
    setSubmitError("");

    const payload: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(fields)) {
      if (value.trim()) {
        payload[key] = value.trim();
      }
    }

    payload.category_id = Number(fields.category_id);
    payload.is_negotiable = negotiable;
    payload.is_furnished = furnished;
    payload.terms_accepted = termsAccepted;
    payload.authorization_confirmed = authorityAccepted;

    if (fields.submitter_role !== "authorized_agent") {
      delete payload.owner_name;
      delete payload.owner_phone;
    }

    if (fields.submission_purpose === "management") {
      delete payload.asking_price;
    }

    try {
      const response = await fetch("/api/public/property-submissions", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json();

      if (!isRecord(result)) {
        throw new Error(
          "Unable to confirm the submission. Contact our team before trying again.",
        );
      }

      if (
        response.status === 201 &&
        typeof result.submission_reference === "string"
      ) {
        setReference(result.submission_reference);

        if (
          typeof result.submission_id === "number" &&
          Number.isSafeInteger(result.submission_id) &&
          result.submission_id > 0 &&
          typeof result.upload_token === "string" &&
          /^[a-f0-9]{64}$/.test(result.upload_token)
        ) {
          setUploadSession({
            id: result.submission_id,
            token: result.upload_token,
          });
        } else {
          setUploadSession(null);
        }
        return;
      }

      let message =
        typeof result.message === "string"
          ? result.message
          : "The submission was not accepted.";

      if (isRecord(result.errors)) {
        const firstMessage = Object.values(result.errors)
          .filter(Array.isArray)
          .flat()
          .find((item): item is string => typeof item === "string");

        if (firstMessage) message = firstMessage;
      }

      setSubmitError(message);
    } catch {
      setSubmitError(
        "We could not confirm whether your submission was received. " +
          "Please contact Gracious Investment before submitting again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-950/5 sm:p-12"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-800">
          ✓
        </span>
        <h2 className="mt-6 text-2xl font-bold text-[#073B2A]">
          Property submission received!
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
          Thank you. Our team will review your property and contact you
          if further information or verification is required.
        </p>

        <div className="mx-auto mt-7 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Your submission reference
          </p>
          <p className="mt-2 break-all font-mono text-lg font-bold text-[#073B2A]">
            {reference}
          </p>
        </div>

        <div className="mt-7 text-left">
          <PropertySubmissionMediaUploader
        items={mediaItems}
        onChange={setMediaItems}
        submissionId={uploadSession?.id ?? null}
        uploadToken={uploadSession?.token ?? null}
      />
        </div>

        <p className="mt-5 text-xs leading-6 text-slate-500">
          Save this reference. Your property is not yet approved or
          published on the website.
        </p>

        <button
          type="button"
          onClick={() => {
            setFields({ ...emptyFields });
            setNegotiable(false);
            setFurnished(false);
            setTermsAccepted(false);
            setAuthorityAccepted(false);
            mediaItems.forEach((item) => {
              if (item.preview) URL.revokeObjectURL(item.preview);
            });
            setReference("");
            setMediaItems([]);
            setUploadSession(null);
          }}
          className="mt-7 rounded-xl bg-[#06442D] px-6 py-3 text-sm font-bold text-white hover:bg-[#086B45]"
        >
          Submit another property
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-emerald-950/5 sm:p-8">
        <SectionTitle
          number="01"
          title="Your information"
          description="Tell us who is submitting the property."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Full name"
            name="submitter_name"
            required
            fields={fields}
            onChange={changeField}
            placeholder="Your full name"
          />
          <InputField
            label="Phone number"
            name="submitter_phone"
            required
            fields={fields}
            onChange={changeField}
            type="tel"
            placeholder="+250 7XX XXX XXX"
            maxLength={30}
          />
          <InputField
            label="Email address"
            name="submitter_email"
            fields={fields}
            onChange={changeField}
            type="email"
            placeholder="you@example.com"
          />

          <label className={labelClass}>
            I am submitting as <span className="text-amber-600">*</span>
            <select
              className={inputClass}
              name="submitter_role"
              value={fields.submitter_role}
              onChange={changeField}
              required
            >
              <option value="owner">Property owner</option>
              <option value="landlord">Landlord</option>
              <option value="developer">Property developer</option>
              <option value="authorized_agent">Authorized agent</option>
            </select>
          </label>
        </div>

        {fields.submitter_role === "authorized_agent" && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-bold text-amber-900">
              Property owner details
            </h3>
            <p className="mt-1 mb-4 text-sm leading-6 text-amber-800">
              We will independently confirm your authority with the
              actual property owner before approval.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="Property owner's full name"
                name="owner_name"
                required
                fields={fields}
                onChange={changeField}
              />
              <InputField
                label="Property owner's phone (recommended)"
                name="owner_phone"
                fields={fields}
                onChange={changeField}
                type="tel"
                maxLength={30}
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-emerald-950/5 sm:p-8">
        <SectionTitle
          number="02"
          title="Property information"
          description="Describe your property and choose how Gracious Investment can help."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClass}>
            Service requested <span className="text-amber-600">*</span>
            <select
              className={inputClass}
              name="submission_purpose"
              required
              value={fields.submission_purpose}
              onChange={changeField}
            >
              <option value="sale">Sell my property</option>
              <option value="rent">Rent out my property</option>
              <option value="management">Property management</option>
            </select>
          </label>

          <label className={labelClass}>
            Property category <span className="text-amber-600">*</span>
            <select
              className={inputClass}
              name="category_id"
              required
              value={fields.category_id}
              onChange={changeField}
              disabled={categoryStatus !== "ready"}
            >
              <option value="">
                {categoryStatus === "loading"
                  ? "Loading property categories..."
                  : "Select property category"}
              </option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            {categoryStatus === "error" && (
              <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Property categories could not be loaded.
                <button
                  type="button"
                  onClick={() => setCategoryRetry((value) => value + 1)}
                  className="ml-2 font-bold underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <InputField
              label="Property title"
              name="property_title"
              fields={fields}
              onChange={changeField}
              required
              placeholder="Example: Modern 3-bedroom home in Kigali"
            />
          </div>

          <label className={`${labelClass} md:col-span-2`}>
            Property description <span className="text-amber-600">*</span>
            <textarea
              name="property_description"
              value={fields.property_description}
              onChange={changeField}
              required
              minLength={20}
              maxLength={10000}
              rows={5}
              placeholder="Describe the property, its main features, condition and nearby facilities..."
              className={inputClass}
            />
          </label>

          {fields.submission_purpose !== "management" && (
            <>
              <InputField
                label={
                  fields.submission_purpose === "rent"
                    ? "Requested rent amount"
                    : "Asking price"
                }
                name="asking_price"
                fields={fields}
                onChange={changeField}
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter amount"
              />

              <label className={labelClass}>
                Currency
                <select
                  name="currency"
                  value={fields.currency}
                  onChange={changeField}
                  className={inputClass}
                >
                  <option value="RWF">Rwandan Francs (RWF)</option>
                  <option value="USD">US Dollars (USD)</option>
                </select>
              </label>
            </>
          )}

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(event) => setNegotiable(event.target.checked)}
              className="h-5 w-5 accent-emerald-800"
            />
            Price is negotiable
          </label>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-emerald-950/5 sm:p-8">
        <SectionTitle
          number="03"
          title="Property location"
          description="Provide the Rwanda administrative address so our team can locate the property."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClass}>
            Province / City <span className="text-amber-600">*</span>
            <select
              className={inputClass}
              name="province"
              value={fields.province}
              onChange={changeField}
              required
            >
              <option value="">Select province</option>
              <option value="Kigali City">Kigali City</option>
              <option value="Eastern Province">Eastern Province</option>
              <option value="Western Province">Western Province</option>
              <option value="Northern Province">Northern Province</option>
              <option value="Southern Province">Southern Province</option>
            </select>
          </label>

          <InputField
            label="District"
            name="district"
            fields={fields}
            onChange={changeField}
            required
            placeholder="Example: Gasabo"
          />

          <InputField
            label="Sector"
            name="sector"
            fields={fields}
            onChange={changeField}
            required
            placeholder="Example: Kacyiru"
          />

          <InputField
            label="Cell (optional)"
            name="cell"
            fields={fields}
            onChange={changeField}
          />

          <InputField
            label="Village (optional)"
            name="village"
            fields={fields}
            onChange={changeField}
          />

          <InputField
            label="Street / Address (optional)"
            name="address"
            fields={fields}
            onChange={changeField}
          />

          <InputField
            label="Latitude (optional)"
            name="latitude"
            fields={fields}
            onChange={changeField}
            type="number"
            min="-90"
            max="90"
            step="any"
          />

          <InputField
            label="Longitude (optional)"
            name="longitude"
            fields={fields}
            onChange={changeField}
            type="number"
            min="-180"
            max="180"
            step="any"
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-emerald-950/5 sm:p-8">
        <SectionTitle
          number="04"
          title="Property size and features"
          description="These details are optional but help us assess your property."
        />

        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Land size (m²)"
            name="land_size_sqm"
            fields={fields}
            onChange={changeField}
            type="number"
            min="0.01"
            step="0.01"
          />

          <InputField
            label="Building size (m²)"
            name="building_size_sqm"
            fields={fields}
            onChange={changeField}
            type="number"
            min="0.01"
            step="0.01"
          />

          {([
            ["bedrooms", "Bedrooms"],
            ["bathrooms", "Bathrooms"],
            ["parking_spaces", "Parking spaces"],
            ["floors", "Floors"],
          ] as const).map(([name, label]) => (
            <InputField
              key={name}
              label={label}
              name={name}
              fields={fields}
              onChange={changeField}
              type="number"
              min="0"
              max="1000"
              step="1"
            />
          ))}

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={furnished}
              onChange={(event) => setFurnished(event.target.checked)}
              className="h-5 w-5 accent-emerald-800"
            />
            Property is furnished
          </label>
        </div>
      </section>

      <PropertySubmissionMediaUploader
        items={mediaItems}
        onChange={setMediaItems}
        submissionId={uploadSession?.id ?? null}
        uploadToken={uploadSession?.token ?? null}
      />

      <section className="rounded-3xl border border-emerald-100 bg-[#F3F8F5] p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[#073B2A]">
          Confirm and submit
        </h2>

        <p className="mt-2 mb-6 text-sm leading-7 text-slate-600">
          Gracious Investment will verify the submitted information
          before making any decision. Submitting this form does not
          immediately publish your property.
        </p>

        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-800"
            />
            <span>
              I confirm that the information provided is accurate
              and I accept the submission terms.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={authorityAccepted}
              onChange={(event) => setAuthorityAccepted(event.target.checked)}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-800"
            />
            <span>
              I confirm that I own this property or have the
              required authority to submit it for the requested service.
            </span>
          </label>
        </div>

        {submitError && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || categoryStatus !== "ready"}
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-[#06442D] px-6 py-4 text-base font-bold text-white transition hover:bg-[#086B45] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitting ? "Submitting your property..." : "Submit Property for Review"}
        </button>
      </section>
    </form>
  );
}
