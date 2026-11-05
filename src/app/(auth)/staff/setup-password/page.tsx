import type { Metadata } from "next";
import { Suspense } from "react";
import SetupPasswordForm from "@/components/account/SetupPasswordForm";

export const metadata: Metadata = {
  title: "Set Up Staff Password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SetupPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9ff] px-5 py-12">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading invitation...</p>}>
        <SetupPasswordForm />
      </Suspense>
    </main>
  );
}
