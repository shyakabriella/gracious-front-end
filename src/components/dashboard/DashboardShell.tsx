"use client";

import { useState } from "react";
import type { AuthUser } from "@/lib/auth/server";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import DashboardIcon from "./DashboardIcon";

type Props = {
  user: AuthUser;
  children: React.ReactNode;
};

export default function DashboardShell({
  user,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#1d2c46]">
      {/* Fixed desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[254px] border-r border-[#e0e5f0] lg:block">
        <Sidebar user={user} />
      </aside>

      {/* Mobile sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#17233e]/50"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="relative h-full w-[min(85vw,254px)] shadow-xl">
            <Sidebar
              user={user}
              onNavigate={() => setMenuOpen(false)}
            />
          </aside>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="absolute right-4 top-4 rounded-lg bg-white p-2 text-[#263956] shadow"
          >
            <DashboardIcon name="close" size={20} />
          </button>
        </div>
      )}

      {/* Dashboard content */}
      <div className="flex min-h-screen flex-col lg:pl-[254px]">
        <Header
          user={user}
          onMenuClick={() => setMenuOpen(true)}
        />

        <main
          id="dashboard-main"
          className="min-w-0 flex-1 px-5 pb-9 sm:px-8"
        >
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
