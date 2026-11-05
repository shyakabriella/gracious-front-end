import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/server";
import DashboardShell from "@/components/dashboard/DashboardShell";

async function ProtectedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user || user.status !== "active") {
    redirect("/login");
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
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
        <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-sm text-slate-600">
          Loading your workspace...
        </div>
      }
    >
      <ProtectedDashboard>{children}</ProtectedDashboard>
    </Suspense>
  );
}
