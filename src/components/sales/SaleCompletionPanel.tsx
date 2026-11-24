"use client";

import { useEffect, useState } from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Sale = {
  id: number;
  reference: string;
  status: string;
  agent?: { id: number; name: string } | null;
};

type DocumentType = "signed_agreement" | "ownership_transfer";

type Document = {
  id: number;
  document_type: DocumentType;
  original_name: string;
  file_size: number;
  uploader?: { name: string } | null;
};

type History = {
  id: number;
  from_status: string | null;
  to_status: string;
  notes?: string | null;
  created_at: string;
  changed_by?: { name: string } | null;
  changedBy?: { name: string } | null;
};

type Props = {
  sale: Sale;
  account: Account;
  onChanged: (message: string) => void;
};

const API = "/api/dashboard/manage";
const PRIVATE = "/api/dashboard/sale-completion-documents";

function getError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;

  const data = value as {
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (data.errors && typeof data.errors === "object") {
    for (const errors of Object.values(data.errors)) {
      if (Array.isArray(errors)) {
        const first = errors.find(
          (item): item is string => typeof item === "string",
        );
        if (first) return first;
      }
    }
  }

  return typeof data.message === "string"
    ? data.message
    : fallback;
}

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getError(data, `Request rejected (HTTP ${response.status}).`),
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Unexpected response from Laravel.");
  }

  return data as T;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export default function SaleCompletionPanel({
  sale,
  account,
  onChanged,
}: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<History[]>([]);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [documentType, setDocumentType] =
    useState<DocumentType>("signed_agreement");

  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const [reviewed, setReviewed] = useState(false);
  const [transferRegistered, setTransferRegistered] = useState(false);
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completionUncertain, setCompletionUncertain] =
    useState(false);

  const isAdmin = account.roles.some((role) =>
    ["super_admin", "admin"].includes(role),
  );

  const isAssignedAgent =
    account.roles.includes("agent") &&
    sale.agent?.id === account.id;

  const canView = isAdmin || isAssignedAgent;

  const canUpload =
    isAdmin &&
    ["agreement", "pending_completion"].includes(sale.status);

  const canComplete =
    isAdmin && sale.status === "pending_completion";

  const hasAgreement = documents.some(
    (document) => document.document_type === "signed_agreement",
  );

  const hasTransfer = documents.some(
    (document) => document.document_type === "ownership_transfer",
  );

  useEffect(() => {
    if (!canView) return;

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoaded(false);
      setError("");

      try {
        const [documentsResponse, historyResponse] = await Promise.all([
          fetch(
            `${API}/sales/${sale.id}/completion-documents`,
            { cache: "no-store", signal: controller.signal },
          ),
          fetch(
            `${API}/sales/${sale.id}/history`,
            { cache: "no-store", signal: controller.signal },
          ),
        ]);

        const documentData = await readResponse<{
          documents: Document[];
        }>(documentsResponse);

        const historyData = await readResponse<{
          history: History[];
        }>(historyResponse);

        if (
          !Array.isArray(documentData.documents) ||
          !Array.isArray(historyData.history)
        ) {
          throw new Error("Unexpected completion records response.");
        }

        if (!controller.signal.aborted) {
          setDocuments(documentData.documents);
          setHistory(historyData.history);
          setLoaded(true);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setDocuments([]);
          setHistory([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load completion records.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [sale.id, sale.status, canView, refreshKey]);

  async function uploadDocument() {
    if (!canUpload || busy || !file) return;

    setError("");
    setMessage("");

    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError("Choose a non-empty document of 10 MB or less.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (
      !extension ||
      !["pdf", "jpg", "jpeg", "png"].includes(extension)
    ) {
      setError("Only PDF, JPG, JPEG and PNG files are supported.");
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.append("document_type", documentType);
      form.append("file", file, file.name);

      const response = await fetch(
        `${PRIVATE}/${sale.id}`,
        { method: "POST", body: form },
      );

      const result = await readResponse<{
        document?: { id?: number };
      }>(response);

      if (!result.document?.id) {
        throw new Error(
          "Upload response was unexpected. Refresh documents before retrying.",
        );
      }

      setFile(null);
      setFileKey((value) => value + 1);
      setMessage("Legal document uploaded successfully.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Upload failed. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeSale() {
    if (
      !canComplete ||
      busy ||
      loading ||
      !loaded ||
      !hasAgreement ||
      !hasTransfer ||
      !reviewed ||
      !transferRegistered ||
      completionUncertain
    ) {
      return;
    }

    setError("");
    setMessage("");

    if (notes.length > 2000) {
      setError("Completion notes must not exceed 2,000 characters.");
      return;
    }

    if (
      !window.confirm(
        `COMPLETE PROPERTY SALE?\n\n` +
        `Sale: ${sale.reference}\n\n` +
        "Confirm that full payment has been independently verified, " +
        "both legal documents have been reviewed, and ownership " +
        "transfer has been registered.\n\n" +
        "Laravel will mark the property SOLD and remove its public listing.",
      )
    ) {
      return;
    }

    setBusy(true);

    let response: Response;

    try {
      response = await fetch(`${API}/sales/${sale.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_documents_reviewed: true,
          confirm_transfer_registered: true,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
    } catch {
      setCompletionUncertain(true);
      setError(
        "Completion may have reached Laravel. Close and reopen " +
        "this sale to check its status before trying again.",
      );
      setBusy(false);
      return;
    }

    try {
      const result = await readResponse<{
        sale?: { id?: number; status?: string };
      }>(response);

      if (
        result.sale?.id !== sale.id ||
        result.sale.status !== "completed"
      ) {
        setCompletionUncertain(true);
        throw new Error(
          "Completion response was unexpected. " +
          "Refresh the sale status before attempting another action.",
        );
      }

      onChanged("Sale completed. Property marked SOLD by Laravel.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete the property sale.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!canView) return null;

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#263956]">
            Legal Documents & Completion
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Documents are private and subject to Laravel authorization.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || loading}
          onClick={() => setRefreshKey((value) => value + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">
          Loading completion documents and history...
        </p>
      ) : loaded ? (
        <div className="space-y-3">
          {[
            { type: "signed_agreement", label: "Signed sale agreement" },
            { type: "ownership_transfer", label: "Ownership transfer" },
          ].map((required) => {
            const available = documents.some(
              (document) => document.document_type === required.type,
            );

            return (
              <div
                key={required.type}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
              >
                <span className="text-sm font-medium">
                  {required.label}
                </span>
                <span className={
                  available
                    ? "text-xs font-semibold text-emerald-700"
                    : "text-xs font-semibold text-amber-700"
                }>
                  {available ? "Uploaded" : "Missing"}
                </span>
              </div>
            );
          })}

          {documents.map((document) => (
            <article
              key={document.id}
              className="rounded-lg border border-slate-200 p-3"
            >
              <p className="text-xs font-semibold capitalize text-slate-500">
                {readable(document.document_type)}
              </p>

              <p className="mt-1 break-all text-sm font-semibold">
                {document.original_name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {(document.file_size / 1024).toFixed(1)} KB
                {document.uploader?.name
                  ? ` · ${document.uploader.name}`
                  : ""}
              </p>

              <a
                href={`${PRIVATE}/${sale.id}/${document.id}/download`}
                className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
              >
                Download private document
              </a>
            </article>
          ))}
        </div>
      ) : null}

      {canUpload && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <h4 className="font-bold text-[#263956]">
            Upload Legal Document
          </h4>

          <label className="block text-sm font-semibold">
            Document type
            <select
              value={documentType}
              disabled={busy}
              onChange={(event) =>
                setDocumentType(event.target.value as DocumentType)
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
            >
              <option value="signed_agreement">
                Signed agreement
              </option>
              <option value="ownership_transfer">
                Ownership transfer
              </option>
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Select document (maximum 10 MB)
            <input
              key={fileKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={busy}
              onChange={(event) =>
                setFile(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full text-sm"
            />
          </label>

          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void uploadDocument()}
            className="rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      )}

      {canComplete && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <h4 className="font-bold text-[#263956]">
            Final Sale Completion
          </h4>

          <p className="text-sm text-slate-600">
            Both legal documents and full verified payment are required.
            Laravel checks the actual stored files, payment audit history,
            exact payment balance, and property availability.
          </p>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy}
              onChange={(event) =>
                setReviewed(event.target.checked)
              }
            />
            I confirm that I have reviewed the required legal documents.
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={transferRegistered}
              disabled={busy}
              onChange={(event) =>
                setTransferRegistered(event.target.checked)
              }
            />
            I confirm that ownership transfer has been legally registered.
          </label>

          <label className="block text-sm font-semibold">
            Completion notes (optional)
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={
              busy ||
              loading ||
              !loaded ||
              !hasAgreement ||
              !hasTransfer ||
              !reviewed ||
              !transferRegistered ||
              completionUncertain
            }
            onClick={() => void completeSale()}
            className="rounded-lg bg-[#263956] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Processing..." : "Confirm Final Sale Completion"}
          </button>
        </div>
      )}

      <div className="border-t border-slate-200 pt-4">
        <h4 className="font-bold text-[#263956]">
          Sale Status History
        </h4>

        {loaded && history.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            No status history available.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg bg-slate-50 p-3"
            >
              <p className="text-sm font-semibold capitalize">
                {readable(entry.to_status)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {entry.created_at?.slice(0, 10)}
                {" · "}
                {entry.changed_by?.name ??
                  entry.changedBy?.name ??
                  "System"}
              </p>

              {entry.notes && (
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                  {entry.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
