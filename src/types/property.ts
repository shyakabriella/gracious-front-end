export type Property = {
  id: string;
  slug: string;
  price: number;
  currency?: string;
  address: string;
  location: string;
  beds: number | null;
  baths: number | null;
  image: string | null;
};
