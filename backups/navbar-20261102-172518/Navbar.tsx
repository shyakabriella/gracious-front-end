"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { label: "Home", href: "/" },
  {
    label: "Properties",
    href: "/properties",
    children: [
      { label: "For Sale", href: "/properties" },
      { label: "For Rent", href: "/rentals" },
    ],
  },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/about" },
  { label: "Contact Us", href: "/contact" },
];

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("#")[0]) && href !== "/#services";

  return (
    <header className="fixed inset-x-3 top-4 z-50 md:inset-x-[5.5%]">
      <nav className="flex items-center justify-between rounded-lg bg-[#025a58] px-6 py-5 shadow-lg md:px-9">
        <Link href="/" className="text-2xl font-medium tracking-wide text-white">
          Property
        </Link>

        {/* Desktop */}
        <ul className="hidden items-center gap-10 md:flex">
          {links.map((link) => (
            <li key={link.label} className="group relative">
              <Link
                href={link.href}
                className={`flex items-center gap-2 text-[15px] tracking-wide transition-colors ${
                  isActive(link.href) ? "text-white" : "text-teal-200/80 hover:text-white"
                }`}
              >
                {link.label}
                {link.children && <Chevron />}
              </Link>

              {link.children && (
                <ul className="invisible absolute left-0 top-full mt-4 w-40 rounded-md bg-white py-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                  {link.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-white md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <ul className="mt-2 rounded-lg bg-[#025a58] p-4 shadow-lg md:hidden">
          {links.flatMap((l) => (l.children ? l.children : [l])).map((link) => (
            <li key={link.label + link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 text-teal-100 hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
