"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);

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
      setBusy(false);
      window.alert("Could not log out. Please try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
