import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  getAuthenticatedUser,
} from "@/lib/auth/server";
import DashboardShell from "@/components/dashboard/DashboardShell";

async function ProtectedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // This authenticated dashboard must render per request.
  // Prevent unstable-time prerendering in Next.js Cache Components.
  await connection();

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
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] text-sm text-[#91a0b9]">
          Loading dashboard...
        </div>
      }
    >
      <ProtectedDashboard>
        {children}
      </ProtectedDashboard>
    </Suspense>
  );
}
