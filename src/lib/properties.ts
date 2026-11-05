import type { Property } from "@/types/property";

// Temporary data. Replace with an API call (src/lib/api) later.
export const popularProperties: Property[] = [
  {
    id: "1",
    slug: "modern-pool-villa",
    price: 1291000,
    address: "5232 California Fake, Ave. 21BC",
    location: "California, USA",
    beds: 2,
    baths: 2,
    image: "/images/properties/property-1.jpg",
  },
  {
    id: "2",
    slug: "glass-front-residence",
    price: 1291000,
    address: "5232 California Fake, Ave. 21BC",
    location: "California, USA",
    beds: 2,
    baths: 2,
    image: "/images/properties/property-2.jpg",
  },
  {
    id: "3",
    slug: "open-terrace-house",
    price: 1291000,
    address: "5232 California Fake, Ave. 21BC",
    location: "California, USA",
    beds: 2,
    baths: 2,
    image: "/images/properties/property-3.jpg",
  },
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
