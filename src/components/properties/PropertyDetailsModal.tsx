"use client";

import { useEffect, useState } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type PropertyDetails = {
  id: number;
  reference: string;
  title: string;
  description?: string | null;
  listing_type: string;
  asking_price: string | number;
  currency: string;
  is_negotiable?: boolean;
  is_furnished?: boolean;
  verification_status: string;
  availability_status: string;
  is_published: boolean;
  is_featured?: boolean;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  address?: string | null;
  land_size_sqm?: string | number | null;
  building_size_sqm?: string | number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  floors?: number | null;
  category?: { name: string } | null;
  agent?: { name: string } | null;
  creator?: { name: string } | null;
  created_at?: string | null;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not specified";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value).replaceAll("_", " ");
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[#263956]">
        {display(value)}
      </p>
    </div>
  );
}

export default function PropertyDetailsModal({
  propertyId,
  onClose,
}: {
  propertyId: number;
  onClose: () => void;
}) {
  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProperty() {
      setLoading(true);
      setError("");
      setProperty(null);

      try {
        const response = await fetch(
          `/api/dashboard/manage/properties/${propertyId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property details."),
          );
        }

        const data = result as { property?: PropertyDetails };

        if (!data.property || data.property.id !== propertyId) {
          throw new Error("Invalid property details response.");
        }

        if (!controller.signal.aborted) {
          setProperty(data.property);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProperty();

    return () => controller.abort();
  }, [propertyId]);

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-details-title"
        className="mx-auto my-5 max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="property-details-title"
              className="text-xl font-bold text-[#263956]"
            >
              Property Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Information retrieved from Gracious Investment.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close property details"
            className="rounded-lg border px-3 py-2 text-sm"
          >
            ✕
          </button>
        </div>

        {loading && (
          <p role="status" className="py-8 text-sm text-slate-500">
            Loading property details...
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && property && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-[#626df1]">
                {property.reference}
              </p>

              <h3 className="mt-2 text-lg font-bold text-[#263956]">
                {property.title}
              </h3>

              <p className="mt-2 text-lg font-semibold text-[#263956]">
                {property.currency}{" "}
                {Number(property.asking_price).toLocaleString("en-RW")}
              </p>

              {property.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                  {property.description}
                </p>
              )}
            </div>

            <section>
              <h4 className="mb-3 font-bold text-[#263956]">
                Listing Information
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Category" value={property.category?.name} />
                <Detail label="Listing Type" value={property.listing_type} />
                <Detail label="Verification" value={property.verification_status} />
                <Detail label="Availability" value={property.availability_status} />
                <Detail label="Published" value={property.is_published} />
                <Detail label="Featured" value={property.is_featured} />
                <Detail label="Negotiable" value={property.is_negotiable} />
                <Detail label="Furnished" value={property.is_furnished} />
              </div>
            </section>

            <section>
              <h4 className="mb-3 font-bold text-[#263956]">
                Property Location
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Province" value={property.province} />
                <Detail label="District" value={property.district} />
                <Detail label="Sector" value={property.sector} />
                <Detail label="Cell" value={property.cell} />
                <Detail label="Village" value={property.village} />
                <Detail label="Address" value={property.address} />
              </div>
            </section>

            <section>
              <h4 className="mb-3 font-bold text-[#263956]">
                Property Specifications
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Land Size (m²)" value={property.land_size_sqm} />
                <Detail label="Building Size (m²)" value={property.building_size_sqm} />
                <Detail label="Bedrooms" value={property.bedrooms} />
                <Detail label="Bathrooms" value={property.bathrooms} />
                <Detail label="Parking Spaces" value={property.parking_spaces} />
                <Detail label="Floors" value={property.floors} />
              </div>
            </section>

            <section>
              <h4 className="mb-3 font-bold text-[#263956]">
                Property Management
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Assigned Agent" value={property.agent?.name} />
                <Detail label="Registered By" value={property.creator?.name} />
              </div>
            </section>
          </div>
        )}

        <div className="mt-6 flex justify-end border-t pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#263956] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
