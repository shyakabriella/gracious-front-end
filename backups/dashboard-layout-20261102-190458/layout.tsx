import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/server";
import LogoutButton from "@/components/dashboard/LogoutButton";

async function ProtectedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user || user.status !== "active") {
    redirect("/login");
  }

  // Laravel still enforces permissions on every protected API.
  return (
    <div className="min-h-screen bg-[#f4f8f7] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <Link href="/dashboard" className="font-bold text-[#025a58]">
              GRACIOUS INVESTMENT
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              Management Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:block">
              {user.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <nav aria-label="Dashboard navigation" className="mb-8 flex flex-wrap gap-4 text-sm">
          <Link href="/dashboard" className="font-medium text-[#025a58]">
            Overview
          </Link>
          {user.permissions.includes("users.view") && (
            <Link href="/dashboard/staff" className="font-medium text-[#025a58]">
              Staff
            </Link>
          )}
          <Link href="/" className="text-slate-600 hover:underline">
            Public website
          </Link>
        </nav>

        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f8f7] p-8 text-slate-600">
          Loading your dashboard...
        </div>
      }
    >
      <ProtectedDashboard>{children}</ProtectedDashboard>
    </Suspense>
  );
}
