import Image from "next/image";
import Link from "next/link";

const propertyLinks = [
  {
    label: "All Properties",
    href: "/properties",
  },
  {
    label: "Properties for Rent",
    href: "/rentals",
  },
  {
    label: "List Your Property",
    href: "/contact?subject=list-property",
  },
];

const companyLinks = [
  {
    label: "About Us",
    href: "/about",
  },
  {
    label: "Our Services",
    href: "/#services",
  },
  {
    label: "Contact Us",
    href: "/contact",
  },
];

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden
        border-t border-[#E0A020]/30
        bg-[#003020] text-white"
    >
      {/* Subtle background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute
          -right-32 -top-32 h-[380px] w-[380px]
          rounded-full border border-[#E0A020]/10"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute
          -right-16 -top-16 h-[260px] w-[260px]
          rounded-full border border-[#E0A020]/10"
      />

      <div
        className="relative mx-auto w-full
          max-w-7xl px-5 pb-8 pt-14
          sm:px-8 lg:px-12 lg:pt-20"
      >
        <div
          className="grid grid-cols-1 gap-12
            sm:grid-cols-2
            lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]
            lg:gap-10"
        >
          {/* Company identity */}
          <div>
            <Link
              href="/"
              aria-label="Gracious Investment homepage"
              className="inline-flex items-center gap-3"
            >
              <Image
                src="/logo.png"
                alt="Gracious Investment Ltd"
                width={80}
                height={80}
                className="h-16 w-16 shrink-0
                  rounded-full object-contain"
              />

              <span className="flex flex-col gap-1">
                <span
                  className="text-base font-semibold
                    tracking-wide text-white"
                >
                  GRACIOUS INVESTMENT
                </span>

                <span
                  className="text-xs font-medium
                    tracking-[0.17em] text-[#FFD050]"
                >
                  LTD
                </span>
              </span>
            </Link>

            <p
              className="mt-6 max-w-sm text-sm
                leading-7 text-[#F8EDD2]/85"
            >
              Helping clients find houses, apartments,
              land, and investment properties in Rwanda
              with reliable, professional guidance.
            </p>

            <p
              className="mt-5 text-sm font-medium
                italic text-[#FFD050]"
            >
              Your Property, Our Commitment.
            </p>
          </div>

          {/* Property navigation */}
          <nav aria-label="Footer property links">
            <h2
              className="mb-6 text-sm font-semibold
                uppercase tracking-[0.14em]
                text-[#FFD050]"
            >
              Properties
            </h2>

            <ul className="space-y-4">
              {propertyLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#F8EDD2]/85
                      transition-colors hover:text-[#FFD050]
                      focus-visible:outline-2
                      focus-visible:outline-offset-4
                      focus-visible:outline-[#FFD050]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company navigation */}
          <nav aria-label="Footer company links">
            <h2
              className="mb-6 text-sm font-semibold
                uppercase tracking-[0.14em]
                text-[#FFD050]"
            >
              Company
            </h2>

            <ul className="space-y-4">
              {companyLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#F8EDD2]/85
                      transition-colors hover:text-[#FFD050]
                      focus-visible:outline-2
                      focus-visible:outline-offset-4
                      focus-visible:outline-[#FFD050]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h2
              className="mb-6 text-sm font-semibold
                uppercase tracking-[0.14em]
                text-[#FFD050]"
            >
              Get in Touch
            </h2>

            <p
              className="mb-4 text-sm
                leading-7 text-[#F8EDD2]/85"
            >
              Looking to buy, rent, sell, or manage
              a property?
            </p>

            <p
              className="mb-6 text-sm
                text-[#F8EDD2]/85"
            >
              Kigali, Rwanda
            </p>

            <Link
              href="/contact"
              className="inline-flex items-center
                justify-center gap-2 rounded-lg
                bg-[#E0A020] px-5 py-3
                text-sm font-semibold text-[#003020]
                transition-colors
                hover:bg-[#FFD050]
                focus-visible:outline-2
                focus-visible:outline-offset-4
                focus-visible:outline-[#FFD050]"
            >
              Contact Us
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Footer bottom */}
        <div
          className="mt-14 flex flex-col gap-3
            border-t border-white/15 pt-7
            text-center text-xs
            text-[#F8EDD2]/65
            sm:flex-row sm:items-center
            sm:justify-between sm:text-left"
        >
          <p>
            © 2026 Gracious
            Investment Ltd. All rights reserved.
          </p>

          <p>
            Your Property, Our Commitment.
          </p>
        </div>
      </div>
    </footer>
  );
}
