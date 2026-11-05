import type { ReactNode } from "react";

type IconName =
  | "dashboard"
  | "building"
  | "users"
  | "leads"
  | "calendar"
  | "sales"
  | "rentals"
  | "payments"
  | "refunds"
  | "settings"
  | "menu"
  | "close"
  | "refresh"
  | "external";

const icons: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5" />
    </>
  ),
  leads: (
    <>
      <path d="M4 5h16M4 12h10M4 19h7" />
      <circle cx="18" cy="17" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),
  sales: (
    <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />
  ),
  rentals: (
    <>
      <circle cx="8" cy="9" r="5" />
      <path d="m12 12 9 9m-5-5 2-2" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9h18m-5 5h2" />
    </>
  ),
  refunds: (
    <>
      <path d="M4 11a8 8 0 1 1 2 7M4 16v-5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2" />
    </>
  ),
  external: <path d="M8 5h11v11M19 5 9 15M19 14v5H5V5h5" />,
};

export default function DashboardIcon({
  name,
  size = 19,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icons[name]}
    </svg>
  );
}
