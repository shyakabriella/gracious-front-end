import Link from "next/link";
import PropertyCard from "@/components/website/PropertyCard";
import { apiUrl } from "@/lib/auth/server";
import type { Property } from "@/types/property";

type FeaturedApiProperty = {
  reference?: string;
  title: string;
  slug: string;
  asking_price: string | number;
  currency?: string;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  cover_image?: {
    url?: string | null;
  } | null;
};

type FeaturedResult = {
  properties: Property[];
  available: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isFeaturedProperty(value: unknown): value is FeaturedApiProperty {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.slug === "string" &&
    value.slug.length > 0 &&
    (typeof value.asking_price === "string" ||
      typeof value.asking_price === "number")
  );
}

async function getFeaturedProperties(): Promise<FeaturedResult> {
  try {
    const response = await fetch(apiUrl("/public/home"), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Public property API unavailable");
    }

    const payload: unknown = await response.json();

    if (
      !isRecord(payload) ||
      !Array.isArray(payload.featured_properties)
    ) {
      throw new Error("Invalid public property response");
    }

    const properties: Property[] = payload.featured_properties
      .filter(isFeaturedProperty)
      .map((property) => {
        const price = Number(property.asking_price);

        const address = [
          property.address,
          property.sector,
          property.district,
          property.province,
        ]
          .filter(
            (part): part is string =>
              typeof part === "string" && part.trim().length > 0
          )
          .join(", ");

        return {
          id: property.slug,
          slug: property.slug,
          price,
          currency: property.currency || "RWF",
          address: address || "Rwanda",
          location: property.title,
          beds:
            typeof property.bedrooms === "number"
              ? property.bedrooms
              : null,
          baths:
            typeof property.bathrooms === "number"
              ? property.bathrooms
              : null,
          image:
            typeof property.cover_image?.url === "string" &&
            /^https?:\/\//.test(property.cover_image.url)
              ? property.cover_image.url
              : null,
        };
      })
      .filter(
        (property) =>
          Number.isFinite(property.price) && property.price > 0
      );

    return { properties, available: true };
  } catch {
    return { properties: [], available: false };
  }
}



export default async function PopularProperties() {
  const { properties, available } = await getFeaturedProperties();

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
        {properties.length > 0 ? (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-8">
            {properties.map((property, index) => (
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
              {available
                ? "Featured properties are coming soon"
                : "Featured properties are temporarily unavailable"}
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-slate-600">
              Please check back for available featured properties,
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
