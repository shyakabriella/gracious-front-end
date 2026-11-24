import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiUrl } from "@/lib/auth/server";
import PropertyInquiryForm from "@/components/website/PropertyInquiryForm";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ImageRecord = {
  id?: number;
  url?: string | null;
  is_cover?: boolean;
};

type PropertyRecord = {
  title: string;
  slug: string;
  reference?: string | null;
  description?: string | null;
  listing_type?: string | null;
  asking_price?: string | number | null;
  currency?: string | null;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  land_size_sqm?: string | number | null;
  building_size_sqm?: string | number | null;
  parking_spaces?: number | null;
  is_furnished?: boolean | null;
  cover_image?: ImageRecord | null;
  images?: ImageRecord[];
  category?: {
    name?: string | null;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function displayPrice(property: PropertyRecord): string {
  const price = Number(property.asking_price);

  if (
    property.asking_price === null ||
    property.asking_price === undefined ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return "Price on request";
  }

  if (property.currency === "RWF" || property.currency === "USD") {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: property.currency,
      maximumFractionDigits: 0,
    }).format(price);
  }

  return price.toLocaleString("en-RW");
}

async function PropertyDetailsContent({ params }: PageProps) {
  const { slug } = await params;

  let property: PropertyRecord;

  try {
    const response = await fetch(
      apiUrl(`/public/properties/${encodeURIComponent(slug)}`),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );

    if (response.status === 404) {
      throw new Error("PROPERTY_NOT_FOUND");
    }

    if (!response.ok) {
      throw new Error("Property API unavailable");
    }

    const payload: unknown = await response.json();

    if (!isRecord(payload) || !isRecord(payload.property)) {
      throw new Error("Invalid property API response");
    }

    const result = payload.property;

    if (
      typeof result.title !== "string" ||
      typeof result.slug !== "string"
    ) {
      throw new Error("Invalid property details");
    }

    property = result as PropertyRecord;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROPERTY_NOT_FOUND"
    ) {
      notFound();
    }

    return (
      <section className="mx-auto max-w-7xl px-5 py-32">
        <h1 className="text-3xl font-semibold text-[#123b39]">
          Property temporarily unavailable
        </h1>
        <p className="mt-4 text-slate-600">
          We could not load this property right now.
          Please try again later.
        </p>
        <Link
          href="/properties"
          className="mt-6 inline-block text-[#025a58] underline"
        >
          Browse properties
        </Link>
      </section>
    );
  }

  const location = [
    property.address,
    property.sector,
    property.district,
    property.province,
  ]
    .filter((value): value is string =>
      typeof value === "string" && value.trim().length > 0
    )
    .join(", ");

  const imageRecords = [
    property.cover_image,
    ...(Array.isArray(property.images) ? property.images : []),
  ];

  const images = Array.from(
    new Set(
      imageRecords
        .map((image) => image?.url)
        .filter(validImageUrl)
    )
  );

  const specifications = [
    ["Bedrooms", property.bedrooms],
    ["Bathrooms", property.bathrooms],
    ["Parking Spaces", property.parking_spaces],
    ["Land Size", property.land_size_sqm],
    ["Building Size", property.building_size_sqm],
  ].filter((entry) =>
    entry[1] !== null &&
    entry[1] !== undefined &&
    entry[1] !== ""
  );

  return (
    <main className="bg-[#f8faf9]">
      <section className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8 lg:pt-36">
        <Link
          href="/properties"
          className="text-sm font-semibold text-[#025a58] hover:underline"
        >
          ← Back to properties
        </Link>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#02716d]">
            {property.category?.name ??
              (property.listing_type === "rent" ? "For Rent" : "Property")}
          </p>

          <h1 className="mt-3 text-3xl font-semibold text-[#123b39] sm:text-5xl">
            {property.title}
          </h1>

          {location && (
            <p className="mt-4 text-base text-slate-600">
              {location}
            </p>
          )}

          <p className="mt-6 text-3xl font-bold text-[#025a58]">
            {displayPrice(property)}
          </p>

          {property.reference && (
            <p className="mt-2 text-sm text-slate-500">
              Reference: {property.reference}
            </p>
          )}
        </div>

        {images.length > 0 ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {images.map((url, index) => (
              <div
                key={url}
                className={`relative overflow-hidden rounded-2xl bg-slate-100 ${
                  index === 0 ? "md:col-span-2" : ""
                }`}
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={url}
                    alt={`${property.title} photo ${index + 1}`}
                    fill
                    sizes="(min-width: 1024px) 75vw, 100vw"
                    className="object-cover"
                    unoptimized
                    priority={index === 0}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 flex aspect-[16/7] items-center justify-center rounded-2xl bg-slate-200 px-5 text-center text-slate-500">
            Property photos coming soon
          </div>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl bg-white p-6 shadow-sm sm:p-9">
            <h2 className="text-2xl font-semibold text-[#123b39]">
              About this property
            </h2>

            <p className="mt-5 whitespace-pre-line leading-8 text-slate-600">
              {property.description ||
                "Contact Gracious Investment for more details about this property."}
            </p>

            {specifications.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-semibold text-[#123b39]">
                  Property specifications
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {specifications.map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-1 font-semibold text-[#123b39]">
                        {String(value)}
                        {label === "Land Size" ||
                        label === "Building Size"
                          ? " m²"
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <aside className="h-fit rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-[#123b39]">
              Interested in this property?
            </h2>

            <p className="mt-4 leading-7 text-slate-600">
              Contact our team for more information or to arrange a viewing.
            </p>

            <PropertyInquiryForm
              slug={property.slug}
              listingType={property.listing_type}
            />

            <Link
              href="/contact"
              className="mt-7 inline-flex rounded-full bg-[#025a58] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[#047370]"
            >
              Contact Gracious Investment
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function PropertyDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-7xl px-5 py-32">
          <p className="text-slate-600">Loading property details...</p>
        </section>
      }
    >
      <PropertyDetailsContent params={params} />
    </Suspense>
  );
}
