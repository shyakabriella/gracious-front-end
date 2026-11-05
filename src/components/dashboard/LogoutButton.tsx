"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not sign out.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2e6f1] bg-[#fafbff] px-3 py-2.5 text-xs font-semibold text-[#526784] transition-colors hover:bg-[#f0f1ff] disabled:opacity-50"
      >
        <span aria-hidden="true">↪</span>
        {busy ? "Signing out..." : "Logout"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
