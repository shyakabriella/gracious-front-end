"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { apiError, readJson } from "@/lib/crm/customers";

type ImageRecord = {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  is_cover: boolean;
};

type Props = {
  propertyId: number;
  propertyTitle: string;
  canEdit: boolean;
  verificationStatus: string;
  onChanged: () => void;
  onClose: () => void;
};

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 30;

export default function PropertyImagesModal({
  propertyId,
  propertyTitle,
  canEdit,
  verificationStatus,
  onChanged,
  onClose,
}: Props) {
  const base = `/api/dashboard/property-images/${propertyId}`;

  const [images, setImages] = useState<ImageRecord[]>([]);
  const [currentVerificationStatus, setCurrentVerificationStatus] =
    useState(verificationStatus);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadImages() {
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
            apiError(result, "Unable to load property images."),
          );
        }

        const data = result as {
          images?: ImageRecord[];
        };

        if (!Array.isArray(data.images)) {
          throw new Error("Invalid image gallery response.");
        }

        if (!controller.signal.aborted) {
          setImages(
            [...data.images].sort(
              (a, b) =>
                a.sort_order - b.sort_order || a.id - b.id,
            ),
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property images.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadImages();

    return () => controller.abort();
  }, [base, reload]);

  function warnAboutReview(): boolean {
    if (currentVerificationStatus !== "verified") {
      return true;
    }

    return window.confirm(
      "This property is currently verified.\n\n" +
      "Adding or deleting an image will return it to " +
      "pending verification and unpublish it.\n\n" +
      "Do you want to continue?",
    );
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || busy || loading) return;

    setError("");
    setNotice("");

    if (!file) {
      setError("Select an image first.");
      return;
    }

    if (images.length >= MAX_IMAGES) {
      setError("Maximum 30 images per property.");
      return;
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      setError("Image must be between 1 byte and 5 MB.");
      return;
    }

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      !extension ||
      !["jpg", "jpeg", "png", "gif", "webp"].includes(extension)
    ) {
      setError("Select a JPG, PNG, GIF or WebP image.");
      return;
    }

    if (!warnAboutReview()) return;

    const form = new FormData();
    form.append("image", file);

    setBusy(true);

    try {
      const response = await fetch(base, {
        method: "POST",
        body: form,
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to upload image."),
        );
      }

      setFile(null);

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      if (currentVerificationStatus === "verified") {
        setCurrentVerificationStatus("pending");
      }

      setNotice(
        "Image uploaded. Check the property's verification status.",
      );

      refresh();
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeCover(image: ImageRecord) {
    if (!canEdit || busy || image.is_cover) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${base}/${image.id}/cover`,
        { method: "PATCH" },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to change cover image."),
        );
      }

      setNotice("Cover image updated successfully.");
      refresh();
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to change cover image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function moveImage(index: number, direction: -1 | 1) {
    if (!canEdit || busy || loading) return;

    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= images.length) return;

    const reordered = [...images];

    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${base}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_ids: reordered.map((image) => image.id),
        }),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to reorder images."),
        );
      }

      setNotice("Image order updated successfully.");
      refresh();
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to reorder images.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(image: ImageRecord) {
    if (!canEdit || busy || loading) return;

    if (
      !window.confirm(
        `Delete "${image.original_name}" permanently?`,
      )
    ) {
      return;
    }

    if (!warnAboutReview()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${base}/${image.id}`,
        { method: "DELETE" },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Unable to delete image."),
        );
      }

      if (currentVerificationStatus === "verified") {
        setCurrentVerificationStatus("pending");
      }

      setNotice(
        "Image deleted. Check the property's verification status.",
      );

      refresh();
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to delete image.",
      );
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "rounded-lg border border-slate-300 px-3 py-2 " +
    "text-xs font-semibold disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-images-title"
        className="mx-auto my-5 max-w-5xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="property-images-title"
              className="text-xl font-bold text-[#263956]"
            >
              Manage Property Images
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {propertyTitle}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {images.length} / {MAX_IMAGES} images
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close image gallery"
            className={buttonClass}
          >
            ✕
          </button>
        </header>

        {currentVerificationStatus === "verified" && canEdit && (
          <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Uploading or deleting an image will unpublish this
            verified property and require another review.
          </p>
        )}

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

        {canEdit && (
          <form
            onSubmit={(event) => void upload(event)}
            className="mb-6 rounded-xl border border-slate-200 p-4"
          >
            <h3 className="mb-3 font-semibold text-[#263956]">
              Upload Image
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                required
                disabled={busy || images.length >= MAX_IMAGES}
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                className="min-w-0 max-w-full text-sm"
              />

              <button
                type="submit"
                disabled={
                  busy ||
                  loading ||
                  !file ||
                  images.length >= MAX_IMAGES
                }
                className="rounded-xl bg-[#626df1] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Processing..." : "Upload Image"}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Maximum 5 MB per image. Up to 30 images per property.
              Laravel validates the actual image content.
            </p>
          </form>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[#263956]">
            Property Gallery
          </h3>

          <button
            type="button"
            onClick={refresh}
            disabled={busy || loading}
            className={buttonClass}
          >
            Refresh
          </button>
        </div>

        {loading && (
          <p className="py-8 text-sm text-slate-500">
            Loading images...
          </p>
        )}

        {!loading && images.length === 0 && !error && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
            No images have been uploaded for this property.
          </p>
        )}

        {!loading && images.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                {/* Private same-origin image URL; no Laravel token exposed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${base}/${image.id}`}
                  alt={image.original_name}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-slate-100 object-cover"
                />

                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      Position {index + 1}
                    </span>

                    {image.is_cover && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Cover
                      </span>
                    )}
                  </div>

                  <p className="truncate text-sm font-semibold text-[#263956]">
                    {image.original_name}
                  </p>

                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {!image.is_cover && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void changeCover(image)}
                          className={buttonClass}
                        >
                          Set Cover
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => void moveImage(index, -1)}
                        className={buttonClass}
                      >
                        Move Up
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy || index === images.length - 1
                        }
                        onClick={() => void moveImage(index, 1)}
                        className={buttonClass}
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteImage(image)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-6 flex justify-end border-t pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={buttonClass}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
