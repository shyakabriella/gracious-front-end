"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AuthUser } from "@/lib/auth/server";
import DashboardIcon from "./DashboardIcon";

type Props = {
  user: AuthUser;
  onMenuClick: () => void;
};

export default function Header({
  user,
  onMenuClick,
}: Props) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  function refreshDashboard() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <header className="px-5 pb-6 pt-5 sm:px-8 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="mt-1 rounded-lg border border-[#e0e5f1] bg-white p-2 text-[#607295] lg:hidden"
          >
            <DashboardIcon name="menu" size={20} />
          </button>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6875f5]">
              REAL ESTATE OVERVIEW
            </p>

            <h1 className="mt-2 text-[25px] font-bold leading-tight tracking-tight text-[#1d2c46]">
              Dashboard
            </h1>

            <p className="mt-1 text-[12px] leading-6 text-[#788baa] sm:text-[13px]">
              Welcome back, {user.name}. Here is your property management overview.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshDashboard}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3fb] bg-white px-4 py-3 text-xs font-semibold text-[#626df1] transition-colors hover:bg-[#f0f1ff] disabled:opacity-50"
        >
          <DashboardIcon
            name="refresh"
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>
    </header>
  );
}
