"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/staff/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const currentInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    currentInput.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!saving) onClose();
      }

      if (event.key === "Tab" && dialog.current) {
        const elements = Array.from(
          dialog.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled)'
          )
        );

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  function closeModal() {
    if (saving) return;

    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
    setError("");
    onClose();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Your new password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }

    if (currentPassword === password) {
      setError("Choose a different password from your current one.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/dashboard/manage/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          password,
          password_confirmation: confirmation,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Could not change your password.")
        );
      }

      setCurrentPassword("");
      setPassword("");
      setConfirmation("");

      // Laravel revokes existing tokens after a password change.
      router.replace("/login?password_changed=1");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect to the server."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#15233d]/60 p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-default"
        onClick={closeModal}
      />

      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        aria-describedby="password-modal-description"
        className="relative my-auto w-full max-w-[520px] rounded-2xl border border-[#e2e6f0] bg-white shadow-[0_25px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex items-start justify-between border-b border-[#e9edf5] px-7 py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6875f5]">
              Account Security
            </p>

            <h2
              id="password-modal-title"
              className="mt-2 text-xl font-bold text-[#263956]"
            >
              Change Password
            </h2>

            <p
              id="password-modal-description"
              className="mt-2 text-sm leading-6 text-[#8293af]"
            >
              Enter your current password and choose a secure new password.
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg border border-[#e2e6f0] px-3 py-2 text-sm text-[#637794] hover:bg-[#f4f6ff] disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="px-7 py-7">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="settings-current-password"
                className="mb-2 block text-sm font-semibold text-[#405575]"
              >
                Current Password
              </label>

              <input
                ref={currentInput}
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                required
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                className="w-full rounded-xl border border-[#dce3ef] bg-white px-4 py-3 text-sm text-[#263956] outline-none focus:border-[#626df1] focus:ring-2 focus:ring-[#626df1]/10"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label
                htmlFor="settings-new-password"
                className="mb-2 block text-sm font-semibold text-[#405575]"
              >
                New Password
              </label>

              <input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                minLength={12}
                required
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#dce3ef] bg-white px-4 py-3 text-sm text-[#263956] outline-none focus:border-[#626df1] focus:ring-2 focus:ring-[#626df1]/10"
                placeholder="At least 12 characters"
              />
            </div>

            <div>
              <label
                htmlFor="settings-confirm-password"
                className="mb-2 block text-sm font-semibold text-[#405575]"
              >
                Confirm New Password
              </label>

              <input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                required
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                className="w-full rounded-xl border border-[#dce3ef] bg-white px-4 py-3 text-sm text-[#263956] outline-none focus:border-[#626df1] focus:ring-2 focus:ring-[#626df1]/10"
                placeholder="Repeat your new password"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-6 rounded-xl bg-[#f5f6ff] px-4 py-3 text-xs leading-6 text-[#647596]">
            For security, you will be signed out after changing your password.
            Sign in again using your new password.
          </div>

          <div className="mt-7 flex justify-end gap-3 border-t border-[#e9edf5] pt-6">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-xl border border-[#dce3ef] px-5 py-3 text-sm font-semibold text-[#637794] hover:bg-[#f7f8ff] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#505bda] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
