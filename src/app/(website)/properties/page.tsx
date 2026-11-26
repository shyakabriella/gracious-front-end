import { Suspense } from "react";
import Link from "next/link";
import PropertyCard from "@/components/website/PropertyCard";
import { apiUrl } from "@/lib/auth/server";
import type { Property } from "@/types/property";

type SearchValue = string | string[] | undefined;

type PageProps = {
  searchParams: Promise<{
    search?: SearchValue;
    listing_type?: SearchValue;
    sort?: SearchValue;
    page?: SearchValue;
  }>;
};

type ApiProperty = {
  title: string;
  slug: string;
  asking_price: number | string;
  currency?: string | null;
  address?: string | null;
  sector?: string | null;
  district?: string | null;
  province?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  cover_image?: { url?: string | null } | null;
};

type DirectoryResult = {
  properties: Property[];
  currentPage: number;
  lastPage: number;
  total: number;
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function validImage(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validProperty(value: unknown): value is ApiProperty {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.slug === "string" &&
    value.slug.length > 0 &&
    (typeof value.asking_price === "number" ||
      typeof value.asking_price === "string")
  );
}

function toCard(property: ApiProperty): Property {
  const address = [
    property.address,
    property.sector,
    property.district,
    property.province,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(", ");

  return {
    id: property.slug,
    slug: property.slug,
    price: Number(property.asking_price),
    currency:
      property.currency === "USD" ? "USD" : "RWF",
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
    image: validImage(property.cover_image?.url)
      ? property.cover_image.url
      : null,
  };
}

function directoryUrl(
  search: string,
  listingType: string,
  sort: string,
  page: number
): string {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (listingType) params.set("listing_type", listingType);
  if (sort !== "latest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}

async function loadProperties(
  search: string,
  listingType: string,
  sort: string,
  page: number
): Promise<DirectoryResult> {
  try {
    const params = new URLSearchParams({
      per_page: "12",
      sort,
      page: String(page),
    });

    if (search) params.set("search", search);
    if (listingType) params.set("listing_type", listingType);

    const response = await fetch(
      apiUrl(`/public/properties?${params.toString()}`),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Unable to retrieve properties.");
    }

    const payload: unknown = await response.json();

    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error("Invalid property directory response.");
    }

    const currentPage = Number(payload.current_page);
    const lastPage = Number(payload.last_page);
    const total = Number(payload.total);

    if (
      !Number.isSafeInteger(currentPage) ||
      !Number.isSafeInteger(lastPage) ||
      !Number.isSafeInteger(total) ||
      currentPage < 1 ||
      lastPage < 1 ||
      total < 0
    ) {
      throw new Error("Invalid property pagination response.");
    }

    const properties = payload.data
      .filter(validProperty)
      .map(toCard)
      .filter(
        (property) =>
          Number.isFinite(property.price) && property.price > 0
      );

    return {
      properties,
      currentPage,
      lastPage,
      total,
      error: null,
    };
  } catch {
    return {
      properties: [],
      currentPage: 1,
      lastPage: 1,
      total: 0,
      error: "Properties are temporarily unavailable. Please try again.",
    };
  }
}

async function PropertyDirectory({ searchParams }: PageProps) {
  const query = await searchParams;

  const search = first(query.search).trim().slice(0, 100);

  const requestedType = first(query.listing_type);
  const listingType = ["sale", "rent"].includes(requestedType)
    ? requestedType
    : "";

  const requestedSort = first(query.sort);
  const sort = [
    "latest", "oldest", "price_asc", "price_desc",
  ].includes(requestedSort)
    ? requestedSort
    : "latest";

  const requestedPage = Number(first(query.page) || "1");
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage >= 1
      ? requestedPage
      : 1;

  const result = await loadProperties(
    search,
    listingType,
    sort,
    page
  );

  return (
    <main className="min-h-screen bg-[#f8faf9]">
      <section className="mx-auto max-w-[1500px] px-5 pb-24 pt-28 sm:px-8 lg:px-[5.5%] lg:pt-36">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#025a58]">
          Gracious Investment Ltd
        </p>

        <h1 className="mt-4 text-4xl font-semibold text-[#123b39] sm:text-5xl">
          Explore Properties in Rwanda
        </h1>

        <p className="mt-5 max-w-2xl leading-8 text-slate-600">
          Discover available houses, apartments, land and
          investment opportunities across Rwanda.
        </p>

        <form
          action="/properties"
          method="GET"
          className="mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <div>
            <label
              htmlFor="property-search"
              className="mb-2 block text-sm font-semibold text-[#123b39]"
            >
              Search properties
            </label>
            <input
              id="property-search"
              name="search"
              type="search"
              defaultValue={search}
              maxLength={100}
              placeholder="Title, district or location"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-offset-2"
            />
          </div>

          <div>
            <label
              htmlFor="listing-type"
              className="mb-2 block text-sm font-semibold text-[#123b39]"
            >
              Listing type
            </label>
            <select
              id="listing-type"
              name="listing_type"
              defaultValue={listingType}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">All properties</option>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="property-sort"
              className="mb-2 block text-sm font-semibold text-[#123b39]"
            >
              Sort by
            </label>
            <select
              id="property-sort"
              name="sort"
              defaultValue={sort}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="latest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-[#025a58] px-7 py-3 text-sm font-semibold text-white hover:bg-[#047370]"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {result.error
              ? "Property listing unavailable"
              : `${result.total.toLocaleString("en-RW")} properties found`}
          </p>

          <Link
            href="/properties"
            className="text-sm font-semibold text-[#025a58] hover:underline"
          >
            Clear filters
          </Link>
        </div>

        {result.error ? (
          <div
            role="status"
            className="mt-8 rounded-2xl border border-amber-200 bg-white px-6 py-12 text-center text-slate-700"
          >
            {result.error}
          </div>
        ) : result.properties.length > 0 ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {result.properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                />
              ))}
            </div>

            <nav
              aria-label="Property results pagination"
              className="mt-12 flex flex-wrap items-center justify-center gap-5"
            >
              {result.currentPage > 1 && (
                <Link
                  href={directoryUrl(
                    search,
                    listingType,
                    sort,
                    result.currentPage - 1
                  )}
                  className="rounded-full border border-[#025a58] px-6 py-3 text-sm font-semibold text-[#025a58]"
                >
                  Previous
                </Link>
              )}

              <span className="text-sm text-slate-600">
                Page {result.currentPage} of {result.lastPage}
              </span>

              {result.currentPage < result.lastPage && (
                <Link
                  href={directoryUrl(
                    search,
                    listingType,
                    sort,
                    result.currentPage + 1
                  )}
                  className="rounded-full bg-[#025a58] px-6 py-3 text-sm font-semibold text-white"
                >
                  Next
                </Link>
              )}
            </nav>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold text-[#123b39]">
              No properties found
            </h2>

            <p className="mt-4 text-slate-600">
              There are no published properties matching your search.
              Please try different filters or contact our team.
            </p>

            <Link
              href="/contact"
              className="mt-7 inline-block rounded-full bg-[#025a58] px-7 py-3 font-semibold text-white"
            >
              Contact Us
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function PropertiesPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <section className="px-5 py-36 text-center text-slate-600">
          Loading properties...
        </section>
      }
    >
      <PropertyDirectory {...props} />
    </Suspense>
  );
}
