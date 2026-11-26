"use client";

import { useEffect, useState } from "react";

type Verification = {
  id: number;
  check_type: string;
  outcome: string;
  method: string;
  notes: string;
  performed_by_name: string;
  created_at: string;
};

type Evidence = {
  id: number;
  reference: string;
  document_type: string;
  title: string;
  withdrawn_at: string | null;
};

type OwnerConfirmation = {
  id: number;
  outcome: string;
};

type Outcome = "verified" | "failed" | "revoked";
type Method = "phone_call" | "in_person";

type Props = {
  submissionId: number;
  applicantRole: string;
};

const BASE = "/api/dashboard/manage/property-submissions";

function messageFrom(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "Unexpected server response.";
  }

  const result = value as Record<string, unknown>;

  if (
    typeof result.errors === "object" &&
    result.errors !== null
  ) {
    const errors = Object.values(
      result.errors as Record<string, unknown>
    );

    for (const error of errors) {
      if (
        Array.isArray(error) &&
        typeof error[0] === "string"
      ) {
        return error[0];
      }
    }
  }

  return typeof result.message === "string"
    ? result.message
    : "Request could not be completed.";
}

async function getRecords<T>(
  url: string,
  signal: AbortSignal
): Promise<T[]> {
  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  const result: unknown = await response.json();

  if (!response.ok) {
    throw new Error(messageFrom(result));
  }

  if (
    typeof result !== "object" ||
    result === null ||
    !("data" in result) ||
    !Array.isArray(result.data)
  ) {
    throw new Error("Invalid verification history response.");
  }

  return result.data as T[];
}

function statusLabel(outcome: string | undefined) {
  if (!outcome) return "Not completed";
  if (outcome === "verified") return "Verified";
  if (outcome === "confirmed") return "Confirmed";
  if (outcome === "failed") return "Failed";
  if (outcome === "revoked") return "Revoked";
  return outcome.replaceAll("_", " ");
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm">
      <span className="font-medium text-slate-700">
        {label}
      </span>
      <span className="font-semibold text-[#263956]">
        {value}
      </span>
    </div>
  );
}

export default function SubmissionVerificationPanel({
  submissionId,
  applicantRole,
}: Props) {
  const [checks, setChecks] = useState<Verification[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [confirmations, setConfirmations] =
    useState<OwnerConfirmation[]>([]);

  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<Method>("phone_call");
  const [outcome, setOutcome] = useState<Outcome>("verified");
  const [notes, setNotes] = useState("");
  const [attested, setAttested] = useState(false);

  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState<
    "ownership_title" | "owner_authorization"
  >("ownership_title");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [fileReset, setFileReset] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const prefix = `${BASE}/${submissionId}`;

        const [verificationHistory, documents, owners] =
          await Promise.all([
            getRecords<Verification>(
              `${prefix}/verifications`,
              controller.signal
            ),
            getRecords<Evidence>(
              `${prefix}/evidence`,
              controller.signal
            ),
            getRecords<OwnerConfirmation>(
              `${prefix}/owner-confirmations`,
              controller.signal
            ),
          ]);

        if (!controller.signal.aborted) {
          setChecks(verificationHistory);
          setEvidence(documents);
          setConfirmations(owners);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load verification history."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [submissionId, reload]);

  const latest = (type: string) =>
    checks.find((record) => record.check_type === type);

  const contact = latest("contact");
  const ownership = latest("ownership");
  const authorization = latest("authorization");

  const titleDocuments = evidence.filter(
    (item) =>
      item.document_type === "ownership_title" &&
      item.withdrawn_at === null
  );

  const authorizationDocuments = evidence.filter(
    (item) =>
      item.document_type === "owner_authorization" &&
      item.withdrawn_at === null
  );

  const agent = applicantRole === "authorized_agent";

  const latestOwnerConfirmation = confirmations[0];

  async function uploadEvidence() {
    if (uploading || !documentFile) return;

    const title = documentTitle.trim();

    if (title.length < 3) {
      setError("Enter a document title of at least 3 characters.");
      return;
    }

    const allowedExtensions = /\.(pdf|jpg|jpeg|png)$/i;

    if (
      !allowedExtensions.test(documentFile.name) ||
      documentFile.size === 0 ||
      documentFile.size > 10 * 1024 * 1024
    ) {
      setError(
        "Choose a PDF, JPG or PNG document no larger than 10 MB."
      );
      return;
    }

    if (!window.confirm(
      "Upload this document to the private property verification records?"
    )) return;

    setUploading(true);
    setError("");
    setFeedback("");

    try {
      const form = new FormData();
      form.set("title", title);
      form.set("document_type", documentType);
      form.set("file", documentFile);

      const response = await fetch(
        `/api/dashboard/property-submission-evidence/${submissionId}`,
        {
          method: "POST",
          body: form,
        }
      );

      const result: unknown = await response.json().catch(
        () => null
      );

      if (!response.ok) {
        throw new Error(messageFrom(result));
      }

      setFeedback(
        "Document uploaded to private evidence storage. " +
        "Ownership verification must still be completed."
      );

      setDocumentTitle("");
      setDocumentFile(null);
      setFileReset((value) => value + 1);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload evidence."
      );
    } finally {
      setUploading(false);
    }
  }

  async function recordContact() {
    if (busy || loading) return;

    const cleanNotes = notes.trim();

    if (cleanNotes.length < 10) {
      setError(
        "Enter at least 10 characters describing the real contact check."
      );
      return;
    }

    if (outcome === "verified" && !attested) {
      setError(
        "Confirm that you actually completed the contact verification."
      );
      return;
    }

    if (
      !window.confirm(
        `Record contact verification as "${statusLabel(outcome)}"? ` +
        "This decision will be stored in the audit history."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(
        `${BASE}/${submissionId}/verifications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            check_type: "contact",
            outcome,
            method,
            notes: cleanNotes,
          }),
        }
      );

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(messageFrom(result));
      }

      setFeedback(
        "Contact verification decision recorded successfully."
      );
      setNotes("");
      setAttested(false);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record verification."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-[#d9deee] bg-white p-4">
      <div>
        <h3 className="text-base font-bold text-[#263956]">
          Verification & Approval Preparation
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          These checks must be based on genuine evidence.
          Approval and publication are separate actions.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">
          Loading verification history...
        </p>
      ) : (
        <div>
          <StatusRow
            label="Applicant contact"
            value={statusLabel(contact?.outcome)}
          />
          <StatusRow
            label="Ownership verification"
            value={statusLabel(ownership?.outcome)}
          />
          <StatusRow
            label="Ownership title documents"
            value={String(titleDocuments.length)}
          />

          {agent && (
            <>
              <StatusRow
                label="Agent authorization"
                value={statusLabel(authorization?.outcome)}
              />
              <StatusRow
                label="Authorization documents"
                value={String(authorizationDocuments.length)}
              />
              <StatusRow
                label="Independent owner confirmation"
                value={statusLabel(
                  latestOwnerConfirmation?.outcome
                )}
              />
            </>
          )}
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-bold text-[#263956]">
          Upload Ownership Evidence
        </h4>

        <p className="text-xs text-slate-600">
          Upload a genuine land title or ownership document.
          Documents are private and require administrator
          verification before approval.
        </p>

        <label className="block text-sm font-semibold">
          Document type
          <select
            value={documentType}
            onChange={(event) =>
              setDocumentType(
                event.target.value as
                  "ownership_title" | "owner_authorization"
              )
            }
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          >
            <option value="ownership_title">
              Ownership title / land title
            </option>
            {agent && (
              <option value="owner_authorization">
                Owner authorization letter
              </option>
            )}
          </select>
        </label>

        <label className="block text-sm font-semibold">
          Document title
          <input
            value={documentTitle}
            onChange={(event) =>
              setDocumentTitle(event.target.value)
            }
            maxLength={255}
            placeholder="Example: Original land title"
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          />
        </label>

        <label className="block text-sm font-semibold">
          Select document
          <input
            key={fileReset}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) =>
              setDocumentFile(event.target.files?.[0] ?? null)
            }
            className="mt-2 w-full rounded-lg border p-3 text-sm font-normal"
          />
        </label>

        <button
          type="button"
          disabled={
            uploading ||
            loading ||
            !documentFile ||
            documentTitle.trim().length < 3
          }
          onClick={() => void uploadEvidence()}
          className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload Private Document"}
        </button>

        {evidence.filter(
          (item) => item.withdrawn_at === null
        ).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-[#263956]">
              Stored Verification Documents
            </p>
            {evidence
              .filter((item) => item.withdrawn_at === null)
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-slate-50 p-3 text-xs"
                >
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1">
                    {item.document_type.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 break-all text-slate-500">
                    {item.reference}
                  </p>
                  <a
                    href={`/api/dashboard/property-submission-evidence/${submissionId}/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-bold text-indigo-700 underline"
                  >
                    Open Document
                  </a>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-bold text-[#263956]">
          Record Contact Verification
        </h4>

        <p className="text-xs text-slate-600">
          Contact the applicant before marking their
          contact as verified. Recording a decision
          does not send an automatic phone call.
        </p>

        <label className="block text-sm font-semibold">
          Verification method
          <select
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as Method)
            }
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          >
            <option value="phone_call">
              Phone call
            </option>
            <option value="in_person">
              In-person verification
            </option>
          </select>
        </label>

        <label className="block text-sm font-semibold">
          Contact verification outcome
          <select
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value as Outcome);
              setAttested(false);
            }}
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          >
            <option value="verified">
              Verified
            </option>
            <option value="failed">
              Failed
            </option>
            {contact?.outcome === "verified" && (
              <option value="revoked">
                Revoke previous verification
              </option>
            )}
          </select>
        </label>

        <label className="block text-sm font-semibold">
          Verification notes
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            minLength={10}
            maxLength={2000}
            rows={3}
            placeholder="Describe how the applicant's contact was checked."
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          />
        </label>

        {outcome === "verified" && (
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) =>
                setAttested(event.target.checked)
              }
              className="mt-1"
            />
            <span>
              I confirm that I personally completed or
              verified this contact check using the
              selected method.
            </span>
          </label>
        )}

        <button
          type="button"
          disabled={
            busy ||
            loading ||
            notes.trim().length < 10 ||
            (outcome === "verified" && !attested)
          }
          onClick={() => void recordContact()}
          className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Saving..."
            : "Record Contact Verification"}
        </button>
      </div>

      {feedback && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {feedback}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && checks.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-semibold text-[#263956]">
            Recent Verification History
          </h4>

          {checks.slice(0, 5).map((record) => (
            <div
              key={record.id}
              className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700"
            >
              <p className="font-bold capitalize">
                {record.check_type.replaceAll("_", " ")}
                {" · "}
                {statusLabel(record.outcome)}
              </p>
              <p className="mt-1">
                {record.performed_by_name}
                {" · "}
                {record.created_at}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {record.notes}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="border-t pt-3 text-xs text-slate-600">
        Ownership-document upload and final approval
        controls will be connected in the next step.
      </p>
    </section>
  );
}
