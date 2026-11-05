"use client";

import { useState } from "react";
import type { AuthUser } from "@/lib/auth/server";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

type DashboardShellProps = {
  user: AuthUser;
  children: React.ReactNode;
};

export default function DashboardShell({
  user,
  children,
}: DashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      {/* Desktop navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-66 border-r border-slate-200 lg:block">
        <Sidebar user={user} />
      </aside>

      {/* Mobile navigation */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMenuOpen(false)}
          />

          <aside
            id="gracious-dashboard-mobile-nav"
            aria-label="Mobile dashboard navigation"
            className="relative h-full w-[min(85vw,290px)] animate-[gracious-sidebar-enter_200ms_ease-out_both] shadow-2xl motion-reduce:animate-none"
          >
            <Sidebar user={user} onNavigate={() => setMenuOpen(false)} />
          </aside>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white p-2 text-slate-700 shadow-lg"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-66">
        <Header user={user} onMenuClick={() => setMenuOpen(true)} />

        <main id="dashboard-main" className="w-full flex-1 px-5 py-8 sm:px-7 lg:px-8 lg:py-9">
          <div className="mx-auto max-w-[1500px]">
            {children}
          </div>
        </main>

        <Footer />
      </div>

      <style jsx>{`
        @keyframes gracious-sidebar-enter {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
