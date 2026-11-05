export type Customer = {
  id: number;
  reference: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_type: string;
  preferred_location: string | null;
  budget_min: number | string | null;
  budget_max: number | string | null;
  currency: string;
  notes: string | null;
  status: string;
  created_at?: string;
};

export type CustomerPage = {
  data: Customer[];
  current_page: number;
  last_page: number;
  total: number;
};

export const customerTypes = [
  "buyer",
  "seller",
  "tenant",
  "landlord",
  "investor",
];

export function apiError(
  data: unknown,
  fallback = "The request could not be completed.",
): string {
  if (!data || typeof data !== "object") return fallback;

  const value = data as {
    message?: unknown;
    errors?: Record<string, string[]>;
  };

  if (value.errors) {
    for (const messages of Object.values(value.errors)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") {
        return messages[0];
      }
    }
  }

  return typeof value.message === "string"
    ? value.message
    : fallback;
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

export function parseCustomerPage(value: unknown): CustomerPage {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid customer data received.");
  }

  const page = value as Partial<CustomerPage>;

  if (!Array.isArray(page.data)) {
    throw new Error("Customer list was not returned correctly.");
  }

  return {
    data: page.data,
    current_page: Number(page.current_page ?? 1),
    last_page: Number(page.last_page ?? 1),
    total: Number(page.total ?? 0),
  };
}
