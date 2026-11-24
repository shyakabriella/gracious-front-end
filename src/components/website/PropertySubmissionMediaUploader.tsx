"use client";

import Image from "next/image";
import {
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

type Kind = "photo" | "video" | "document";
type UploadStatus =
  | "ready"
  | "uploading"
  | "uploaded"
  | "failed"
  | "uncertain";

export type SubmissionMediaItem = {
  id: string;
  kind: Kind;
  file: File;
  documentType?: string;
  preview?: string;
  primary: boolean;
  status: UploadStatus;
  message?: string;
};

type Props = {
  items: SubmissionMediaItem[];
  onChange: Dispatch<SetStateAction<SubmissionMediaItem[]>>;
  submissionId: number | null;
  uploadToken: string | null;
};

const rules = {
  photo: {
    count: 10,
    maxBytes: 10 * 1024 * 1024,
    extensions: ["jpg", "jpeg", "png", "webp"],
  },
  video: {
    count: 2,
    maxBytes: 100 * 1024 * 1024,
    extensions: ["mp4", "webm"],
  },
  document: {
    count: 5,
    maxBytes: 10 * 1024 * 1024,
    extensions: ["pdf", "jpg", "jpeg", "png"],
  },
};

const groups: {
  kind: Kind;
  title: string;
  accept: string;
}[] = [
  {
    kind: "photo",
    title: "Property photos",
    accept: ".jpg,.jpeg,.png,.webp",
  },
  {
    kind: "video",
    title: "Property videos",
    accept: ".mp4,.webm",
  },
  {
    kind: "document",
    title: "Ownership documents",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
];

export default function PropertySubmissionMediaUploader({
  items,
  onChange,
  submissionId,
  uploadToken,
}: Props) {
  const [documentType, setDocumentType] =
    useState("ownership_title");

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function selectFiles(
    kind: Kind,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (busy || files.length === 0) return;

    const existing = items.filter(
      (item) => item.kind === kind,
    );

    const available = rules[kind].count - existing.length;

    if (available <= 0) {
      setNotice(`Maximum ${rules[kind].count} files allowed.`);
      return;
    }

    const added: SubmissionMediaItem[] = [];
    let rejected = 0;

    for (const file of files.slice(0, available)) {
      const extension =
        file.name.split(".").pop()?.toLowerCase() ?? "";

      if (
        !rules[kind].extensions.includes(extension) ||
        file.size <= 0 ||
        file.size > rules[kind].maxBytes
      ) {
        rejected++;
        continue;
      }

      // Create image previews in the user event handler.
      // Do not call setState inside useEffect.
      const preview =
        kind === "photo"
          ? URL.createObjectURL(file)
          : undefined;

      added.push({
        id: crypto.randomUUID(),
        kind,
        file,
        preview,
        documentType:
          kind === "document"
            ? documentType
            : undefined,
        primary:
          kind === "photo" &&
          existing.length === 0 &&
          !added.some((item) => item.kind === "photo"),
        status: "ready",
      });
    }

    onChange((current) => [...current, ...added]);

    setNotice(
      rejected > 0 || files.length > available
        ? "Some files were skipped due to file type, size, or count limits."
        : "",
    );
  }

  function removeFile(id: string) {
    if (busy) return;

    const target = items.find((item) => item.id === id);

    if (!target || target.status === "uploaded") return;

    if (target.preview) {
      URL.revokeObjectURL(target.preview);
    }

    onChange((current) => {
      const remaining = current.filter(
        (item) => item.id !== id,
      );

      if (target.primary) {
        const first = remaining.find(
          (item) => item.kind === "photo",
        );

        if (first) {
          return remaining.map((item) => ({
            ...item,
            primary: item.id === first.id,
          }));
        }
      }

      return remaining;
    });
  }

  function setPrimary(id: string) {
    onChange((current) =>
      current.map((item) =>
        item.kind === "photo"
          ? { ...item, primary: item.id === id }
          : item,
      ),
    );
  }

  function updateStatus(
    id: string,
    status: UploadStatus,
    message?: string,
  ) {
    onChange((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status, message }
          : item,
      ),
    );
  }

  async function uploadFiles() {
    if (busy || !submissionId || !uploadToken) return;

    const pending = items.filter(
      (item) =>
        item.status === "ready" ||
        item.status === "failed",
    );

    if (pending.length === 0) return;

    const priority = {
      photo: 0,
      video: 1,
      document: 2,
    };

    pending.sort((a, b) => {
      if (a.kind !== b.kind) {
        return priority[a.kind] - priority[b.kind];
      }

      if (a.kind === "photo" && a.primary) return -1;
      if (b.kind === "photo" && b.primary) return 1;

      return 0;
    });

    setBusy(true);
    setNotice("");

    try {
      for (const item of pending) {
        updateStatus(item.id, "uploading");

        const data = new FormData();

        data.append("kind", item.kind);
        data.append("file", item.file, item.file.name);

        if (
          item.kind === "document" &&
          item.documentType
        ) {
          data.append(
            "document_type",
            item.documentType,
          );
        }

        let response: Response;

        try {
          response = await fetch(
            `/api/public/property-submissions/${submissionId}/media`,
            {
              method: "POST",
              headers: {
                "X-Submission-Upload-Token": uploadToken,
              },
              body: data,
            },
          );
        } catch {
          updateStatus(
            item.id,
            "uncertain",
            "Network interrupted. Contact staff before retrying.",
          );

          setNotice(
            "The upload result is uncertain. Save your submission reference.",
          );

          return;
        }

        const raw: unknown = await response
          .json()
          .catch(() => null);

        if (
          response.status === 201 &&
          typeof raw === "object" &&
          raw !== null &&
          "media" in raw
        ) {
          updateStatus(item.id, "uploaded");
          continue;
        }

        const result =
          typeof raw === "object" && raw !== null
            ? (raw as Record<string, unknown>)
            : null;

        const message =
          typeof result?.message === "string"
            ? result.message
            : "The file was not accepted.";

        if (response.status >= 500 || !result) {
          updateStatus(item.id, "uncertain", message);

          setNotice(
            "Upload result uncertain. Contact Gracious before retrying.",
          );

          return;
        }

        updateStatus(item.id, "failed", message);

        if (
          response.status === 403 ||
          response.status === 429
        ) {
          setNotice(message);
          return;
        }
      }

      setNotice(
        "Upload process finished. Check the status of each file.",
      );
    } finally {
      setBusy(false);
    }
  }

  const uploaded = items.filter(
    (item) => item.status === "uploaded",
  ).length;

  const hasUploadedPhoto = items.some(
    (item) =>
      item.kind === "photo" &&
      item.status === "uploaded",
  );

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-6 text-left shadow-lg shadow-emerald-950/5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
        Property media
      </p>

      <h2 className="mt-2 text-xl font-bold text-[#073B2A]">
        Photos, videos and ownership documents
      </h2>

      <p className="mt-2 text-sm leading-7 text-slate-600">
        Select files now. After submitting your property details,
        upload the selected files for private review.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {groups.map((group) => {
          const count = items.filter(
            (item) => item.kind === group.kind,
          ).length;

          return (
            <div
              key={group.kind}
              className="rounded-2xl border border-slate-200 bg-[#F7FAF8] p-5"
            >
              <h3 className="font-bold text-[#073B2A]">
                {group.title}
              </h3>

              <p className="mt-2 text-xs text-slate-500">
                {count}/{rules[group.kind].count} files · Max{" "}
                {rules[group.kind].maxBytes / 1048576} MB each
              </p>

              {group.kind === "document" && (
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Document category
                  <select
                    value={documentType}
                    onChange={(event) =>
                      setDocumentType(event.target.value)
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                  >
                    <option value="ownership_title">
                      Ownership certificate
                    </option>
                    <option value="owner_authorization">
                      Owner authorization letter
                    </option>
                    <option value="other">
                      Other property evidence
                    </option>
                  </select>
                </label>
              )}

              <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900">
                Select {group.kind} files
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  accept={group.accept}
                  disabled={
                    busy ||
                    count >= rules[group.kind].count
                  }
                  onChange={(event) =>
                    selectFiles(group.kind, event)
                  }
                />
              </label>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="mt-7 space-y-3">
          <h3 className="font-bold text-[#073B2A]">
            Selected files
          </h3>

          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-3"
            >
              {item.preview && (
                <Image
                  src={item.preview}
                  alt="Selected property photo preview"
                  width={80}
                  height={64}
                  unoptimized
                  className="h-16 w-20 rounded-lg object-cover"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-semibold text-slate-800">
                  {item.file.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.kind} ·{" "}
                  {(item.file.size / 1048576).toFixed(2)} MB
                </p>

                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  {item.status === "uploaded"
                    ? "Uploaded — pending staff review"
                    : item.status === "uploading"
                      ? "Uploading..."
                      : item.status === "uncertain"
                        ? "Outcome uncertain — contact staff"
                        : item.status === "failed"
                          ? "Upload rejected"
                          : "Ready"}
                </p>

                {item.message && (
                  <p className="mt-1 text-xs text-red-700">
                    {item.message}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {item.kind === "photo" &&
                  !hasUploadedPhoto && (
                    <button
                      type="button"
                      onClick={() => setPrimary(item.id)}
                      disabled={busy}
                      className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900"
                    >
                      {item.primary
                        ? "Main photo"
                        : "Make main"}
                    </button>
                  )}

                {item.status !== "uploaded" && (
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    disabled={busy}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={
            busy ||
            !submissionId ||
            !uploadToken ||
            !items.some(
              (item) =>
                item.status === "ready" ||
                item.status === "failed",
            )
          }
          onClick={() => void uploadFiles()}
          className="rounded-xl bg-[#06442D] px-6 py-3 text-sm font-bold text-white hover:bg-[#086B45] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Uploading files..."
            : "Upload Selected Files"}
        </button>

        <span className="text-sm text-slate-600">
          {uploaded}/{items.length} uploaded
        </span>
      </div>

      {!submissionId && (
        <p className="mt-3 text-xs text-slate-500">
          Complete the property information form first.
          You can upload your files after receiving
          the submission reference.
        </p>
      )}

      {submissionId && !uploadToken && (
        <p className="mt-3 text-xs text-red-700">
          Upload permission is unavailable. Contact Gracious
          Investment with your reference.
        </p>
      )}

      <p className="mt-5 text-xs leading-6 text-slate-500">
        Ownership documents remain confidential.
        Uploaded documents do not automatically verify
        ownership or agent authorization.
      </p>
    </section>
  );
}
