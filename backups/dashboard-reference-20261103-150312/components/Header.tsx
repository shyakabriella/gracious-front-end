"use client";

import type { AuthUser } from "@/lib/auth/server";
import LogoutButton from "./LogoutButton";

type HeaderProps = {
  user: AuthUser;
  onMenuClick: () => void;
};

export default function Header({ user, onMenuClick }: HeaderProps) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="flex min-h-19 items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open dashboard navigation"
            aria-controls="gracious-dashboard-mobile-nav"
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6h16M3 11h16M3 16h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">Gracious Investment Ltd</p>
            <p className="truncate text-sm font-semibold text-slate-800 sm:text-base">
              Management Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden text-right sm:block">
            <p className="max-w-44 truncate text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="text-xs capitalize text-slate-500">
              {user.roles[0]?.replaceAll("_", " ") || "Staff"}
            </p>
          </div>

          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e3f3ef] text-xs font-bold text-[#025a58]"
          >
            {initials || "GI"}
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
