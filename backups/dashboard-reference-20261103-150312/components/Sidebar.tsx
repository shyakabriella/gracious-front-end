"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth/server";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
  permission?: string;
};

const sections: { title: string; items: MenuItem[] }[] = [
  {
    title: "WORKSPACE",
    items: [
      { label: "Overview", href: "/dashboard", icon: "dashboard", permission: "dashboard.view" },
      { label: "Properties", href: "/dashboard/properties", icon: "building", permission: "properties.view" },
      { label: "Customers", href: "/dashboard/customers", icon: "users", permission: "customers.view" },
      { label: "Leads", href: "/dashboard/leads", icon: "leads", permission: "leads.view" },
      { label: "Viewings", href: "/dashboard/viewings", icon: "calendar", permission: "viewings.view" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { label: "Sales", href: "/dashboard/sales", icon: "sales", permission: "sales.view" },
      { label: "Rentals", href: "/dashboard/rentals", icon: "key", permission: "rentals.view" },
      { label: "Payments", href: "/dashboard/payments", icon: "wallet" },
      { label: "Refunds", href: "/dashboard/refunds", icon: "refund" },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { label: "Staff & Roles", href: "/dashboard/staff", icon: "staff", permission: "users.view" },
      { label: "Settings", href: "/dashboard/settings", icon: "settings" },
    ],
  },
];

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h2m4 0h2M8 11h2m4 0h2M9 21v-5h6v5" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5" /></>,
    leads: <><path d="M4 5h16M4 12h10M4 19h7" /><circle cx="18" cy="17" r="3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    sales: <><path d="m3 17 6-6 4 4 8-9M15 6h6v6" /></>,
    key: <><circle cx="8" cy="9" r="5" /><path d="m12 12 9 9m-5-5 2-2" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
    refund: <><path d="M4 11a8 8 0 1 1 2 7M4 16v-5h5" /><path d="M12 7v5l3 2" /></>,
    staff: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" /></>,
  };

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}

type SidebarProps = {
  user: AuthUser;
  onNavigate?: () => void;
};

export default function Sidebar({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const permissions = new Set(user.permissions);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex min-h-23 items-center gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#025a58] text-lg font-bold text-white shadow-sm">
          G
        </div>

        <div className="min-w-0">
          <Link href="/dashboard" onClick={onNavigate} className="block text-sm font-bold tracking-wide text-[#123b39]">
            GRACIOUS
          </Link>
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.13em] text-slate-400">
            INVESTMENT LTD
          </p>
        </div>
      </div>

      <nav aria-label="Dashboard sections" className="flex-1 overflow-y-auto px-4 py-6">
        {sections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.permission || permissions.has(item.permission)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-7">
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-400">
                {section.title}
              </p>

              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#025a58] ${
                          active
                            ? "bg-[#e7f4ef] text-[#025a58]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-[#025a58]"
                        }`}
                      >
                        <MenuIcon name={item.icon} />
                        <span>{item.label}</span>
                        {active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-[#025a58]" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          View Public Website
          <span aria-hidden="true" className="ml-2">↗</span>
        </Link>
      </div>
    </div>
  );
}
