import Link from "next/link";
import PropertyCard from "@/components/website/PropertyCard";
import { popularProperties } from "@/lib/properties";

export default function PopularProperties() {
  return (
    <section
      id="featured-properties"
      aria-labelledby="featured-properties-heading"
      className="relative overflow-hidden bg-[#f8faf9] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-8 lg:px-[5.5%]">
        {/* Section heading */}
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#025a58] sm:text-sm">
              Discover your next property
            </p>

            <h2
              id="featured-properties-heading"
              className="text-3xl font-semibold leading-tight tracking-tight text-[#123b39] sm:text-4xl lg:text-5xl"
            >
              Explore Properties{" "}
              <span className="text-[#02716d]">in Rwanda</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Browse houses, apartments, land and investment
              properties. Discover available opportunities and
              find a property that matches your needs.
            </p>
          </div>

          <Link
            href="/properties"
            className="group inline-flex w-fit shrink-0 items-center
              justify-center gap-3 rounded-full bg-[#025a58]
              px-7 py-4 text-sm font-semibold text-white
              shadow-sm transition-[background-color,transform,box-shadow]
              duration-300 ease-out
              hover:-translate-y-0.5 hover:bg-[#047370]
              hover:shadow-lg
              focus-visible:outline-2
              focus-visible:outline-offset-4
              focus-visible:outline-[#025a58]
              motion-reduce:transform-none
              motion-reduce:transition-none"
          >
            View All Properties

            <svg
              aria-hidden="true"
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300
                group-hover:translate-x-1
                motion-reduce:transform-none
                motion-reduce:transition-none"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* Property listings */}
        {popularProperties.length > 0 ? (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-8">
            {popularProperties.map((property, index) => (
              <div
                key={property.id}
                className="gracious-property-reveal min-w-0"
                style={{
                  animationDelay: `${Math.min(index, 5) * 90}ms`,
                }}
              >
                <PropertyCard property={property} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-12 rounded-2xl border border-slate-200
              bg-white px-6 py-14 text-center"
          >
            <h3 className="text-xl font-semibold text-[#123b39]">
              Property listings are coming soon
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-slate-600">
              Please check back for new property listings,
              or contact Gracious Investment for assistance.
            </p>

            <Link
              href="/contact"
              className="mt-6 inline-flex rounded-full
                bg-[#025a58] px-7 py-3 font-semibold
                text-white hover:bg-[#047370]
                focus-visible:outline-2
                focus-visible:outline-offset-2"
            >
              Contact Us
            </Link>
          </div>
        )}

        {/* Additional browsing links */}
        <nav
          aria-label="Explore property categories"
          className="mt-12 flex flex-wrap items-center
            justify-center gap-x-7 gap-y-4 border-t
            border-slate-200 pt-8 text-sm"
        >
          <Link
            href="/properties"
            className="font-medium text-[#025a58]
              underline-offset-4 hover:underline"
          >
            Browse All Properties
          </Link>

          <Link
            href="/rentals"
            className="font-medium text-[#025a58]
              underline-offset-4 hover:underline"
          >
            Explore Rentals
          </Link>

          <Link
            href="/contact"
            className="font-medium text-[#025a58]
              underline-offset-4 hover:underline"
          >
            Speak With Our Team
          </Link>
        </nav>
      </div>
    </section>
  );
}
