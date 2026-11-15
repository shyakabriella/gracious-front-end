"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { apiError, readJson } from "@/lib/crm/customers";

type DocumentRecord = {
  id: number;
  title: string;
  document_type: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type DocumentType =
  | "ownership"
  | "authorization"
  | "inspection"
  | "agreement"
  | "other";

const types: { value: DocumentType; label: string }[] = [
  { value: "ownership", label: "Ownership Document" },
  { value: "authorization", label: "Authorization" },
  { value: "inspection", label: "Inspection Report" },
  { value: "agreement", label: "Agreement" },
  { value: "other", label: "Other Document" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";

function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PropertyDocumentsModal({
  propertyId,
  propertyTitle,
  canEdit,
  onClose,
}: {
  propertyId: number;
  propertyTitle: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const base = `/api/dashboard/property-documents/${propertyId}`;

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentType>("ownership");
  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(base, {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property documents."),
          );
        }

        const data = result as {
          documents?: DocumentRecord[];
        };

        if (!Array.isArray(data.documents)) {
          throw new Error("Invalid property documents response.");
        }

        if (!controller.signal.aborted) {
          setDocuments(data.documents);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property documents.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => controller.abort();
  }, [base, reload]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || busy || deletingId !== null) return;

    setError("");
    setNotice("");

    if (!title.trim()) {
      setError("Document title is required.");
      return;
    }

    if (!file) {
      setError("Please select a document.");
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setError("Document must be between 1 byte and 10 MB.");
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

    const body = new FormData();
    body.append("title", title.trim());
    body.append("document_type", documentType);
    body.append("file", file);

    setBusy(true);

    try {
      const response = await fetch(base, {
        method: "POST",
        body,
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to upload document."),
        );
      }

      const data = result as {
        document?: { id?: number };
      };

      if (!data.document?.id) {
        throw new Error("Invalid document upload response.");
      }

      setTitle("");
      setFile(null);
      setDocumentType("ownership");

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      setNotice("Document uploaded successfully.");
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(document: DocumentRecord) {
    if (!canEdit || busy || deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${document.title}"?\n\n` +
      "This will permanently delete the stored document file."
    );

    if (!confirmed) return;

    setDeletingId(document.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${base}/${document.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to delete document."),
        );
      }

      setNotice(`"${document.title}" deleted successfully.`);
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-documents-title"
        className="mx-auto my-5 max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="property-documents-title"
              className="text-xl font-bold text-[#263956]"
            >
              Manage Property Documents
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {propertyTitle}
            </p>
          </div>

          <button
            type="button"
            disabled={busy || deletingId !== null}
            onClick={onClose}
            aria-label="Close document management"
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <p className="mb-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Documents are stored privately and are accessible only
          through authenticated, authorized requests.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {notice}
          </p>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-[#263956]">
              Existing Documents
            </h3>

            <button
              type="button"
              disabled={loading || busy || deletingId !== null}
              onClick={refresh}
              className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <p className="py-5 text-sm text-slate-500">
              Loading documents...
            </p>
          )}

          {!loading && documents.length === 0 && !error && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">
              No documents uploaded for this property.
            </p>
          )}

          {!loading && documents.map((document) => (
            <div
              key={document.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-[#263956]">
                    {document.title}
                  </p>

                  <p className="mt-1 break-all text-xs text-slate-500">
                    {document.original_name}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {document.document_type.replaceAll("_", " ")}
                    {" · "}
                    {fileSize(Number(document.file_size))}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${base}/${document.id}/download`}
                    className="rounded-lg bg-[#263956] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Download
                  </a>

                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy || deletingId !== null}
                      onClick={() => void deleteDocument(document)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                    >
                      {deletingId === document.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {canEdit && (
          <section className="mt-6 border-t pt-5">
            <h3 className="mb-4 font-bold text-[#263956]">
              Upload New Document
            </h3>

            <form
              onSubmit={(event) => void upload(event)}
              className="space-y-4"
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  Document Title
                </span>
                <input
                  className={field}
                  value={title}
                  maxLength={255}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Land Title Deed"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  Document Type
                </span>
                <select
                  className={field}
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(event.target.value as DocumentType)
                  }
                >
                  {types.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  Select File
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  className={field}
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>

              <p className="text-xs text-slate-500">
                PDF, JPG, JPEG or PNG. Maximum file size: 10 MB.
              </p>

              <button
                type="submit"
                disabled={busy || deletingId !== null}
                className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Uploading..." : "Upload Document"}
              </button>
            </form>
          </section>
        )}

        <div className="mt-6 flex justify-end border-t pt-5">
          <button
            type="button"
            disabled={busy || deletingId !== null}
            onClick={onClose}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
