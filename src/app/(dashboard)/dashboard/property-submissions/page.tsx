"use client";

import { useEffect, useState, type FormEvent } from "react";
import SubmissionVerificationPanel from "@/components/properties/SubmissionVerificationPanel";

type Account = {
  roles: string[];
  permissions: string[];
};

type Category = {
  id: number;
  name: string;
};

type Submission = {
  id: number;
  reference: string;
  status: string;
  source?: string;
  submitter_name: string;
  submitter_phone: string;
  submitter_email?: string | null;
  submitter_role: string;
  owner_name?: string | null;
  owner_phone?: string | null;
  property_title: string;
  property_description?: string | null;
  submission_purpose: string;
  category?: Category | null;
  asking_price?: string | number | null;
  currency?: string;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  land_size_sqm?: number | string | null;
  building_size_sqm?: number | string | null;
  created_at: string;
  converted_property_id?: number | null;
};

type PageData = {
  data: Submission[];
  total: number;
  current_page: number;
  last_page: number;
};

const BASE = "/api/dashboard/manage/property-submissions";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

async function apiRequest(
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const result: unknown = await response.json().catch(
    () => null
  );

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to complete this request.";

    const errors =
      isRecord(result) && isRecord(result.errors)
        ? Object.values(result.errors)
            .flatMap((value) =>
              Array.isArray(value)
                ? value.filter(
                    (item): item is string =>
                      typeof item === "string"
                  )
                : []
            )
        : [];

    throw new Error(errors[0] ?? message);
  }

  if (!isRecord(result)) {
    throw new Error("Unexpected server response.");
  }

  return result;
}

function readable(value?: string | null) {
  return value
    ? value.replaceAll("_", " ")
    : "Not provided";
}

function displayValue(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return String(value);
}

function statusStyle(status: string) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "rejected") {
    return "bg-red-100 text-red-800";
  }
  if (status === "under_review") {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-amber-100 text-amber-800";
}

export default function PropertySubmissionsPage() {
  const [auth, setAuth] = useState<
    "loading" | "ready" | "denied"
  >("loading");

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [records, setRecords] = useState<PageData | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(
    null
  );
  const [detail, setDetail] = useState<Submission | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkAccess() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result: unknown = await response.json();

        if (
          !response.ok ||
          !isRecord(result) ||
          !isRecord(result.user)
        ) {
          throw new Error("Authentication required.");
        }

        const user = result.user as Account;

        const allowed =
          Array.isArray(user.roles) &&
          Array.isArray(user.permissions) &&
          user.roles.some((role) =>
            role === "admin" || role === "super_admin"
          ) &&
          user.permissions.includes("properties.verify");

        if (!controller.signal.aborted) {
          setAuth(allowed ? "ready" : "denied");
        }
      } catch {
        if (!controller.signal.aborted) {
          setAuth("denied");
        }
      }
    }

    void checkAccess();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (auth !== "ready") return;

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: "15",
        });

        if (status) params.set("status", status);

        if (appliedSearch) {
          params.set("search", appliedSearch);
        }

        const result = await apiRequest(
          `${BASE}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (
          !Array.isArray(result.data) ||
          typeof result.total !== "number" ||
          typeof result.last_page !== "number"
        ) {
          throw new Error(
            "Unexpected submission list response."
          );
        }

        if (!controller.signal.aborted) {
          setRecords(result as PageData);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setRecords(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load submissions."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [auth, page, status, appliedSearch, refresh]);

  useEffect(() => {
    if (auth !== "ready" || selectedId === null) {
      return;
    }

    const controller = new AbortController();

    async function loadDetails() {
      setDetail(null);
      setDetailLoading(true);
      setReason("");

      try {
        const result = await apiRequest(
          `${BASE}/${selectedId}`,
          { signal: controller.signal }
        );

        if (!isRecord(result.submission)) {
          throw new Error(
            "Submission details are unavailable."
          );
        }

        if (!controller.signal.aborted) {
          setDetail(result.submission as Submission);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load submission."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [auth, selectedId, detailRefresh]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
    setRefresh((value) => value + 1);
  }

  async function quickApprove() {
    if (!detail || busy) return;

    if (!window.confirm(
      `Approve "${detail.property_title}" for internal management? ` +
      "This does not verify legal ownership or publish the listing."
    )) return;

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      const result = await apiRequest(
        `${BASE}/${detail.id}/quick-approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm_review: true }),
        }
      );

      setFeedback(
        typeof result.message === "string"
          ? result.message
          : "Submission approved."
      );
      setRefresh((value) => value + 1);
      setDetailRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to approve submission."
      );
    } finally {
      setBusy(false);
    }
  }

  async function convertPublish() {
    if (
      !detail ||
      busy ||
      detail.status !== "approved" ||
      detail.converted_property_id
    ) return;

    if (!window.confirm(
      `Publish "${detail.property_title}" on Home and Properties? ` +
      "This makes the listing public; it does not certify legal ownership."
    )) return;

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      const result = await apiRequest(
        `${BASE}/${detail.id}/convert-publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirm_publication: true,
          }),
        }
      );

      setFeedback(
        typeof result.message === "string"
          ? result.message
          : "Published."
      );

      setRefresh((value) => value + 1);
      setDetailRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cannot publish property."
      );
    } finally {
      setBusy(false);
    }
  }

  async function reviewAction(
    action: "start-review" | "reject"
  ) {
    if (!detail || busy) return;

    const cleaned = reason.trim();

    if (action === "reject" && cleaned.length < 10) {
      setError(
        "Please enter a rejection reason of at least 10 characters."
      );
      return;
    }

    if (
      action === "start-review" &&
      cleaned.length > 0 &&
      cleaned.length < 5
    ) {
      setError(
        "Review notes must be at least 5 characters, or left empty."
      );
      return;
    }

    if (
      action === "reject" &&
      !window.confirm(
        `Reject "${detail.property_title}"? This action will be recorded in the review history.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      const result = await apiRequest(
        `${BASE}/${detail.id}/${action}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            cleaned ? { reason: cleaned } : {}
          ),
        }
      );

      setFeedback(
        typeof result.message === "string"
          ? result.message
          : "Submission status updated."
      );

      setRefresh((value) => value + 1);
      setDetailRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Review action failed."
      );
    } finally {
      setBusy(false);
    }
  }

  if (auth === "loading") {
    return (
      <main className="p-8 text-slate-600">
        Checking administrator permissions...
      </main>
    );
  }

  if (auth === "denied") {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold text-[#263956]">
          Property Submissions
        </h1>
        <p className="mt-3 text-red-700">
          Access requires an administrator account with
          the properties.verify permission.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-5 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#626df1]">
          Gracious Investment · Administrator Review
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#263956]">
          Property Submissions
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Review property applications received through
          the public website. Submissions are not published
          until separate verification and publication steps
          have been completed.
        </p>
      </header>

      {feedback && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {feedback}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={applySearch}
        className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"
      >
        <input
          aria-label="Search property submissions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, reference or applicant"
          maxLength={100}
          className="min-w-[180px] flex-1 rounded-lg border px-4 py-2.5 text-sm"
        />

        <select
          aria-label="Filter submission status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="rounded-lg border px-4 py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          type="submit"
          className="rounded-lg bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() =>
            setRefresh((value) => value + 1)
          }
          className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
        >
          Refresh
        </button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="font-bold text-[#263956]">
              Received Applications
            </h2>
            <span className="text-sm text-slate-500">
              {records?.total ?? 0} submissions
            </span>
          </div>

          <div className="divide-y">
            {loading && (
              <p className="p-5 text-sm text-slate-500">
                Loading applications...
              </p>
            )}

            {!loading && records?.data.length === 0 && (
              <p className="p-5 text-sm text-slate-500">
                No applications match your search.
              </p>
            )}

            {!loading && records?.data.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setError("");
                  setSelectedId(item.id);
                  setDetailRefresh((value) => value + 1);
                }}
                className={`block w-full p-5 text-left transition hover:bg-slate-50 ${
                  selectedId === item.id
                    ? "bg-indigo-50"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#263956]">
                      {item.property_title}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {item.reference}
                    </p>
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(item.status)}`}>
                    {readable(item.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-700">
                  {item.category?.name ?? "Uncategorized"}
                  {" · "}
                  {readable(item.submission_purpose)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Submitted by {item.submitter_name}
                  {" · "}
                  {item.created_at}
                </p>
              </button>
            ))}
          </div>

          {records && records.last_page > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-xs text-slate-600">
                Page {records.current_page} of {records.last_page}
              </span>

              <button
                type="button"
                disabled={
                  page >= records.last_page || loading
                }
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold text-[#263956]">
            Submission Details
          </h2>

          {selectedId === null && (
            <p className="mt-4 text-sm text-slate-500">
              Select an application to review its details.
            </p>
          )}

          {detailLoading && (
            <p className="mt-4 text-sm text-slate-500">
              Loading submission details...
            </p>
          )}

          {!detailLoading && detail && (
            <div className="mt-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[#263956]">
                  {detail.property_title}
                </h3>

                <p className="mt-1 break-all text-xs text-slate-500">
                  {detail.reference}
                </p>

                <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(detail.status)}`}>
                  {readable(detail.status)}
                </span>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Category", detail.category?.name],
                  ["Purpose", readable(detail.submission_purpose)],
                  ["Applicant", detail.submitter_name],
                  ["Applicant role", readable(detail.submitter_role)],
                  ["Telephone", detail.submitter_phone],
                  ["Email", detail.submitter_email],
                  ["Owner", detail.owner_name],
                  ["Owner phone", detail.owner_phone],
                  ["Province", detail.province],
                  ["District", detail.district],
                  ["Sector", detail.sector],
                  ["Cell", detail.cell],
                  ["Village", detail.village],
                  ["Address", detail.address],
                  ["Bedrooms", detail.bedrooms],
                  ["Bathrooms", detail.bathrooms],
                  ["Land size (sqm)", detail.land_size_sqm],
                  ["Building size (sqm)", detail.building_size_sqm],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 break-words font-medium text-slate-800">
                      {displayValue(value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-800">
                  Property description
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {displayValue(detail.property_description)}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">
                  Verification required
                </p>
                <p className="mt-2">
                  Staff must verify applicant contact,
                  ownership documents and any required
                  owner authorization before final approval.
                  Starting a review does not approve or
                  publish this property.
                </p>
              </div>

              {detail.status === "under_review" && (
                <SubmissionVerificationPanel
                  key={detail.id}
                  submissionId={detail.id}
                  applicantRole={detail.submitter_role}
                />
              )}

              {(detail.status === "pending_review" ||
                detail.status === "under_review") && (
                <div className="rounded-xl border border-emerald-200 p-4">
                  <p className="mb-3 text-sm text-slate-700">
                    Review the application and any available
                    documents, then accept it for internal
                    property management. This does not publish
                    or legally verify ownership.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void quickApprove()}
                    className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Processing..." : "Approve Submission"}
                  </button>
                </div>
              )}

              {(detail.status === "pending_review" ||
                detail.status === "under_review") && (
                <div className="space-y-3 border-t pt-5">
                  <label
                    htmlFor="review-reason"
                    className="block text-sm font-semibold text-[#263956]"
                  >
                    Review notes or rejection reason
                  </label>

                  <textarea
                    id="review-reason"
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Enter a reason. Required when rejecting."
                    className="w-full rounded-lg border p-3 text-sm"
                  />

                  {detail.status === "pending_review" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void reviewAction("start-review")
                      }
                      className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "Processing..." : "Start Review"}
                    </button>
                  )}

                  {detail.status === "under_review" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void reviewAction("reject")
                      }
                      className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "Processing..." : "Reject Submission"}
                    </button>
                  )}
                </div>
              )}

              {detail.status === "approved" &&
                !detail.converted_property_id && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void convertPublish()}
                  className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Publishing..."
                    : "Convert & Publish on Website"}
                </button>
              )}

              {detail.converted_property_id != null && (
                <a
                  href="/dashboard/properties"
                  className="inline-block rounded-lg bg-[#263956] px-5 py-3 text-sm font-bold text-white"
                >
                  View in Property Management
                  {" "}
                  (ID {detail.converted_property_id})
                </a>
              )}

              {detail.status === "approved" && (
                <p className="text-sm text-emerald-800">
                  This submission was approved.
                  Official property creation and
                  publication are separate steps.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
