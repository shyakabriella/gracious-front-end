"use client";

import { useState, type FormEvent } from "react";

type Props = {
  slug: string;
  listingType?: string | null;
};

type ApiData = {
  message?: string;
  inquiry_reference?: string;
  errors?: Record<string, string[]>;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 " +
  "bg-white px-4 py-3 text-sm text-slate-900 " +
  "placeholder:text-slate-400 " +
  "focus:border-[#025a58] focus:outline-none " +
  "focus:ring-2 focus:ring-teal-100 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getApiError(
  value: unknown,
  fallback: string,
): string {
  if (!isRecord(value)) {
    return fallback;
  }

  const errors = value.errors;

  if (isRecord(errors)) {
    for (const messages of Object.values(errors)) {
      if (
        Array.isArray(messages) &&
        typeof messages[0] === "string"
      ) {
        return messages[0];
      }
    }
  }

  if (
    typeof value.message === "string" &&
    value.message.trim()
  ) {
    return value.message;
  }

  return fallback;
}

export default function PropertyInquiryForm({
  slug,
  listingType,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [needsVerification, setNeedsVerification] =
    useState(false);

  const propertyKind =
    listingType === "rent"
      ? "rental property"
      : "property";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      submitting ||
      reference ||
      needsVerification
    ) {
      return;
    }

    setError("");

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    if (!cleanName || cleanName.length > 255) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanPhone && !cleanEmail) {
      setError(
        "Please provide a phone number or email address.",
      );
      return;
    }

    if (cleanPhone.length > 30) {
      setError("The phone number is too long.");
      return;
    }

    if (cleanEmail.length > 255) {
      setError("The email address is too long.");
      return;
    }

    if (
      !cleanMessage ||
      cleanMessage.length > 5000
    ) {
      setError(
        "Please enter a message of up to 5,000 characters.",
      );
      return;
    }

    // Send only fields accepted by Laravel.
    // Never send customer IDs, lead status,
    // internal CRM notes, or agent assignments.
    const payload = {
      name: cleanName,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      ...(cleanEmail ? { email: cleanEmail } : {}),
      message: cleanMessage,
    };

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/public/properties/${encodeURIComponent(slug)}/inquiries`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data: unknown = await response
        .json()
        .catch(() => null);

      if (response.status === 201) {
        if (
          !isRecord(data) ||
          typeof data.inquiry_reference !== "string" ||
          !data.inquiry_reference.trim()
        ) {
          setNeedsVerification(true);
          setError(
            "Your inquiry may have been received, but we could not confirm its reference. Please contact our team before submitting again.",
          );
          return;
        }

        setReference(data.inquiry_reference);
        return;
      }

      if (response.status === 422) {
        setError(
          getApiError(
            data,
            "Please check the information and try again.",
          ),
        );
        return;
      }

      if (response.status === 404) {
        setError(
          "This property is no longer available for inquiries.",
        );
        return;
      }

      if (response.status === 429) {
        const retryHeader =
          response.headers.get("retry-after");

        const seconds =
          retryHeader && /^\d+$/.test(retryHeader)
            ? Number(retryHeader)
            : null;

        setError(
          seconds !== null &&
          seconds > 0 &&
          seconds <= 3600
            ? `Too many inquiries. Please wait ${seconds} seconds before trying again.`
            : "Too many inquiries. Please try again later.",
        );
        return;
      }

      if (response.status >= 500) {
        setNeedsVerification(true);
        setError(
          "We could not confirm whether your inquiry was received. Please contact our team before submitting again.",
        );
        return;
      }

      setError(
        getApiError(
          data,
          `Unable to submit your inquiry (HTTP ${response.status}).`,
        ),
      );
    } catch {
      setNeedsVerification(true);
      setError(
        "The connection was interrupted. Your inquiry may have been received. Please contact our team before trying again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="text-xl text-emerald-700"
          >
            ✓
          </span>

          <h3 className="text-lg font-bold text-emerald-900">
            Inquiry Sent Successfully
          </h3>
        </div>

        <p className="mt-3 text-sm leading-6 text-emerald-900">
          Thank you for your interest. Our team has
          received your inquiry and can follow up using
          the contact information you provided.
        </p>

        <div className="mt-4 rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Your Inquiry Reference
          </p>

          <p className="mt-2 break-all text-lg font-bold text-[#025a58]">
            {reference}
          </p>
        </div>

        <p className="mt-3 text-xs text-emerald-800">
          Keep this reference for future communication.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h3 className="text-lg font-bold text-[#123b39]">
        Send a Property Inquiry
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tell us what you would like to know about this
        {" "}
        {propertyKind}. Our team will contact you.
      </p>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={submitting}
        className="mt-5 space-y-4"
      >
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
          >
            {error}
          </p>
        )}

        <label className="block text-sm font-semibold text-slate-800">
          Full Name *
          <input
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            maxLength={255}
            required
            disabled={submitting || needsVerification}
            placeholder="Your full name"
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Phone Number
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value)
            }
            maxLength={30}
            disabled={submitting || needsVerification}
            placeholder="+250 7XX XXX XXX"
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Email Address
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            maxLength={255}
            disabled={submitting || needsVerification}
            placeholder="you@example.com"
            className={inputClass}
          />
        </label>

        <p className="text-xs text-slate-500">
          Provide at least one contact method:
          phone number or email address.
        </p>

        <label className="block text-sm font-semibold text-slate-800">
          Your Message *
          <textarea
            name="message"
            rows={5}
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            minLength={1}
            maxLength={5000}
            required
            disabled={submitting || needsVerification}
            placeholder="I am interested in this property. I would like to know..."
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={
            submitting ||
            needsVerification ||
            !name.trim() ||
            !message.trim() ||
            (!phone.trim() && !email.trim())
          }
          className="w-full rounded-xl bg-[#025a58] px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#047370] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "Sending Your Inquiry..."
            : "Send Inquiry"}
        </button>

        <p className="text-xs leading-5 text-slate-500">
          Your contact details will be used to respond
          to your property inquiry.
        </p>
      </form>
    </div>
  );
}
