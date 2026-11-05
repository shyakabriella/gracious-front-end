import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/types/property";
import { formatPrice } from "@/lib/properties";

function BedIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" fill="currentColor" aria-hidden>
      <path d="M0 0h2v11h22V8a3 3 0 0 0-3-3H10v6H2V0H0zm4 6a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM0 12h26v6h-2v-2H2v2H0v-6z" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="currentColor" aria-hidden>
      <path d="M3 1h7v2H5v6h16v2h-1v3a5 5 0 0 1-3 4.6V21h-2v-2H8v2H6v-2.4A5 5 0 0 1 3 14v-3H2V9h1V1zm2 10v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3H5z" />
    </svg>
  );
}

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="overflow-hidden border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={property.image}
          alt={`${property.location} property`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="px-9 pb-10 pt-10">
        <p className="inline-block border-b-2 border-[#025a58] pb-1 text-2xl font-semibold text-[#025a58]">
          {formatPrice(property.price)}
        </p>

        <p className="mt-4 text-[15px] tracking-wide text-gray-500">
          {property.address}
        </p>

        <h3 className="mt-3 text-2xl font-semibold text-gray-900">
          {property.location}
        </h3>

        <div className="mt-6 flex items-center gap-6 text-gray-500">
          <span className="flex items-center gap-2 text-[15px]">
            <BedIcon />
            {property.beds} beds
          </span>
          <span className="flex items-center gap-2 text-[15px]">
            <BathIcon />
            {property.baths} baths
          </span>
        </div>

        <Link
          href={`/properties/${property.slug}`}
          className="mt-8 inline-block rounded-full bg-[#025a58] px-5 py-3.5 text-lg font-medium text-white transition-colors hover:bg-[#047370]"
        >
          See details
        </Link>
      </div>
    </article>
  );
}
