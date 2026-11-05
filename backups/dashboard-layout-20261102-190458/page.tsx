import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <main>
      <p className="text-sm font-semibold uppercase tracking-widest text-[#025a58]">
        Gracious Investment
      </p>

      <h1 className="mt-3 text-3xl font-semibold text-slate-900">
        Management Dashboard
      </h1>

      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        Your account is connected to the Gracious Investment
        Laravel authentication system. We will connect
        live dashboard statistics and management modules next.
      </p>
    </main>
  );
}
