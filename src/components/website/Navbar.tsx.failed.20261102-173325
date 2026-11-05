"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  children?: {
    label: string;
    href: string;
  }[];
};

const navigation: NavItem[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Properties",
    href: "/properties",
    children: [
      {
        label: "All Properties",
        href: "/properties",
      },
      {
        label: "For Sale",
        href: "/properties",
      },
      {
        label: "For Rent",
        href: "/rentals",
      },
    ],
  },
  {
    label: "Services",
    href: "/#services",
  },
  {
    label: "About Us",
    href: "/about",
  },
  {
    label: "Contact Us",
    href: "/contact",
  },
];

const listingHref = "/contact?subject=list-property";

function ChevronDown() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(item: NavItem): boolean {
    if (item.href === "/") {
      return pathname === "/";
    }

    if (item.label === "Properties") {
      return (
        pathname === "/properties" ||
        pathname.startsWith("/properties/") ||
        pathname === "/rentals" ||
        pathname.startsWith("/rentals/")
      );
    }

    if (item.href.includes("#")) {
      return false;
    }

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  }

  return (
    <header className="fixed inset-x-3 top-4 z-50 md:inset-x-[5.5%]">
      <nav
        aria-label="Main navigation"
        className="rounded-lg bg-[#025a58] px-5 py-4 shadow-lg md:px-7 lg:px-9"
      >
        <div className="flex items-center justify-between gap-5">
          <Link
            href="/"
            aria-label="Gracious Investment homepage"
            className="flex shrink-0 flex-col leading-tight text-white"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-base font-semibold tracking-wide sm:text-lg">
              GRACIOUS INVESTMENT
            </span>
            <span className="mt-1 text-[11px] tracking-wide text-teal-100">
              Your Property, Our Commitment.
            </span>
          </Link>

          {/* Desktop navigation */}
          <ul className="hidden items-center gap-5 lg:flex xl:gap-8">
            {navigation.map((item) => (
              <li key={item.label} className="group relative">
                <Link
                  href={item.href}
                  aria-current={
                    isActive(item) ? "page" : undefined
                  }
                  className={`flex items-center gap-1.5 whitespace-nowrap
                    py-2 text-sm font-medium transition-colors
                    focus-visible:rounded-sm focus-visible:outline
                    focus-visible:outline-2 focus-visible:outline-white
                    ${
                      isActive(item)
                        ? "text-white"
                        : "text-teal-100 hover:text-white"
                    }`}
                >
                  {item.label}
                  {item.children && <ChevronDown />}
                </Link>

                {item.children && (
                  <div
                    className="invisible absolute left-0 top-full
                      w-48 pt-2 opacity-0 transition-opacity
                      group-hover:visible group-hover:opacity-100
                      group-focus-within:visible
                      group-focus-within:opacity-100"
                  >
                    <ul className="rounded-lg bg-white py-2 shadow-xl ring-1 ring-black/5">
                      {item.children.map((child) => (
                        <li key={`${child.label}-${child.href}`}>
                          <Link
                            href={child.href}
                            className="block px-4 py-2.5 text-sm
                              text-slate-700 transition-colors
                              hover:bg-teal-50 hover:text-[#025a58]
                              focus-visible:bg-teal-50
                              focus-visible:outline-none"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Link
            href={listingHref}
            className="hidden shrink-0 rounded-md bg-white px-4
              py-2.5 text-sm font-semibold text-[#025a58]
              transition-colors hover:bg-teal-50
              focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-white
              lg:inline-flex"
          >
            List Your Property
          </Link>

          {/* Mobile and tablet navigation control */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="gracious-mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex items-center justify-center
              rounded-md p-2 text-white
              hover:bg-white/10 focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-white
              lg:hidden"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>

        {/* Mobile and tablet navigation */}
        {mobileOpen && (
          <div
            id="gracious-mobile-navigation"
            className="mt-4 border-t border-white/20 pt-3 lg:hidden"
          >
            <ul className="space-y-1">
              {navigation.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={
                      isActive(item) ? "page" : undefined
                    }
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-md px-3 py-3
                      text-sm font-medium transition-colors
                      hover:bg-white/10
                      ${
                        isActive(item)
                          ? "bg-white/10 text-white"
                          : "text-teal-100"
                      }`}
                  >
                    {item.label}
                  </Link>

                  {item.children && (
                    <ul className="mb-2 ml-3 border-l border-white/20 pl-3">
                      {item.children.map((child) => (
                        <li key={`${child.label}-${child.href}`}>
                          <Link
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className="block rounded-md px-3 py-2.5
                              text-sm text-teal-100
                              hover:bg-white/10 hover:text-white"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <Link
              href={listingHref}
              onClick={() => setMobileOpen(false)}
              className="mt-4 block rounded-md bg-white px-4
                py-3 text-center text-sm font-semibold
                text-[#025a58] hover:bg-teal-50"
            >
              List Your Property
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
