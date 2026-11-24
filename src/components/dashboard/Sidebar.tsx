"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth/server";
import DashboardIcon from "./DashboardIcon";
import LogoutButton from "./LogoutButton";

type MenuIconName =
  | "dashboard"
  | "building"
  | "users"
  | "leads"
  | "calendar"
  | "sales"
  | "rentals"
  | "payments"
  | "refunds"
  | "settings";

type MenuItem = {
  label: string;
  href: string;
  icon: MenuIconName;
  permission?: string | string[];
};

const sections: {
  title: string;
  items: MenuItem[];
}[] = [
  {
    title: "MENU",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "dashboard",
        permission: "dashboard.view",
      },
      {
        label: "Properties",
        href: "/dashboard/properties",
        icon: "building",
        permission: "properties.view",
      },
      {
        label: "Property Owners",
        href: "/dashboard/owners",
        icon: "users",
        permission: "owners.view",
      },
      {
        label: "Customers",
        href: "/dashboard/customers",
        icon: "users",
        permission: "customers.view",
      },
      {
        label: "Leads",
        href: "/dashboard/leads",
        icon: "leads",
        permission: "leads.view",
      },
      {
        label: "Viewings",
        href: "/dashboard/viewings",
        icon: "calendar",
        permission: "viewings.view",
      },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      {
        label: "Sales",
        href: "/dashboard/sales",
        icon: "sales",
        permission: "sales.view",
      },
      {
        label: "Rentals",
        href: "/dashboard/rentals",
        icon: "rentals",
        permission: "rentals.view",
      },
      {
        label: "Payments",
        href: "/dashboard/payments",
        icon: "payments",
        permission: ["sales.view", "rentals.view"],
      },
      {
        label: "Refunds",
        href: "/dashboard/refunds",
        icon: "refunds",
        permission: "rentals.view",
      },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      {
        label: "User Management",
        href: "/dashboard/staff",
        icon: "users",
        permission: "users.view",
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: "settings",
      },
    ],
  },
];

type Props = {
  user: AuthUser;
  onNavigate?: () => void;
};

export default function Sidebar({ user, onNavigate }: Props) {
  const pathname = usePathname();
  const permissions = new Set(user.permissions);

  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-[#f8f9ff]">
      {/* Company identity */}
      <div className="flex h-[86px] shrink-0 items-center gap-3 border-b border-[#e2e6f0] px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#626df1] text-base font-bold text-white shadow-md">
          G
        </div>

        <div className="min-w-0">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="block truncate text-sm font-bold tracking-wide text-[#5866eb]"
          >
            GRACIOUS
          </Link>

          <p className="mt-1 text-[10px] font-semibold tracking-[0.1em] text-[#91a0bb]">
            INVESTMENT LTD
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Dashboard navigation"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
      >
        {sections.map((section) => {
          // Customer accounts must not display staff navigation.
          const customerOnly = user.roles.includes("customer");

          const items = section.items.filter((item) =>
            customerOnly
              ? item.href === "/dashboard"
              : !item.permission ||
                (Array.isArray(item.permission)
                  ? item.permission.some((permission) =>
                      permissions.has(permission),
                    )
                  : permissions.has(item.permission)),
          );

          if (!items.length) return null;

          return (
            <div key={section.title} className="mb-8">
              <h2 className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-[#9aa9c3]">
                {section.title}
              </h2>

              <ul className="space-y-1.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href + "/"));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#626df1] ${
                          active
                            ? "bg-[#e9eafd] text-[#626df1]"
                            : "text-[#647899] hover:bg-[#eef0fa] hover:text-[#5866eb]"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                            active
                              ? "bg-[#626df1] text-white"
                              : "text-[#91a2bf]"
                          }`}
                        >
                          <DashboardIcon
                            name={item.icon}
                            size={17}
                          />
                        </span>

                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User account card */}
      <div className="shrink-0 border-t border-[#e2e6f0] p-4">
        <div className="rounded-xl border border-[#e2e6f0] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0df] text-xs font-bold text-[#bf761a]">
              {initials || "GI"}
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#263956]">
                {user.name}
              </p>

              <p className="mt-1 truncate text-[11px] capitalize text-[#8da0bd]">
                {user.roles[0]?.replaceAll("_", " ") || "Staff"}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
