"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getErrorMessage } from "@/lib/staff/types";

export default function SetupPasswordForm() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");

    if (password.length < 12) {
      setError("Your password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/staff/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation: confirmation,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Unable to set your password."),
        );
      }

      setPassword("");
      setConfirmation("");
      setComplete(true);

      window.history.replaceState(null, "", "/staff/setup-password");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to complete setup.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-[470px] rounded-2xl border border-[#e0e5f0] bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#626df1] font-bold text-white">
          G
        </div>
        <div>
          <p className="font-bold text-[#263956]">GRACIOUS INVESTMENT</p>
          <p className="text-[11px] tracking-[0.14em] text-[#91a0b9]">
            STAFF ACCOUNT SETUP
          </p>
        </div>
      </div>

      {complete ? (
        <div role="status">
          <h1 className="text-2xl font-bold text-[#263956]">
            Your account is ready
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#7284a2]">
            Your password has been created. You can now sign in to the
            Gracious Investment dashboard.
          </p>
          <Link href="/login"
            className="mt-7 inline-flex rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white">
            Go to Login
          </Link>
        </div>
      ) : !email || !token ? (
        <div>
          <h1 className="text-xl font-bold text-[#263956]">
            Invitation link missing
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#7284a2]">
            Open the setup link sent to your email. If the link has expired,
            ask your administrator to resend the invitation.
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-[#263956]">
            Create Your Password
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#7284a2]">
            Welcome to Gracious Investment. Set a secure password
            to activate your staff account.
          </p>

          <p className="mt-5 rounded-lg bg-[#f5f6ff] px-4 py-3 text-sm text-[#5262a0]">
            {email}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="setup-password" className="mb-2 block text-sm font-semibold text-[#405575]">
                New Password
              </label>
              <input id="setup-password" type="password" required minLength={12}
                autoComplete="new-password" value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm focus:border-[#626df1] focus:outline-none"
                placeholder="At least 12 characters" />
            </div>

            <div>
              <label htmlFor="setup-confirm" className="mb-2 block text-sm font-semibold text-[#405575]">
                Confirm Password
              </label>
              <input id="setup-confirm" type="password" required
                autoComplete="new-password" value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm focus:border-[#626df1] focus:outline-none"
                placeholder="Repeat your password" />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-[#626df1] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#505bda] disabled:opacity-50">
              {saving ? "Activating Account..." : "Save Password & Activate"}
            </button>

            <p className="text-center text-xs text-[#91a0b9]">
              This invitation link can be used only once.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
