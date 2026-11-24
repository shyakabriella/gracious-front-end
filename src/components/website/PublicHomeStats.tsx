import { apiUrl } from "@/lib/auth/server";

type PublicStatistics = {
  total: number;
  for_sale: number;
  for_rent: number;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

async function loadStatistics(): Promise<PublicStatistics | null> {
  try {
    const response = await fetch(apiUrl("/public/home"), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    if (!isRecord(payload)) {
      return null;
    }

    const statistics = payload.statistics;

    if (!isRecord(statistics)) {
      return null;
    }

    if (
      !validCount(statistics.total) ||
      !validCount(statistics.for_sale) ||
      !validCount(statistics.for_rent)
    ) {
      return null;
    }

    return {
      total: statistics.total,
      for_sale: statistics.for_sale,
      for_rent: statistics.for_rent,
    };
  } catch {
    return null;
  }
}

export default async function PublicHomeStats() {
  const statistics = await loadStatistics();

  // Never display invented statistics.
  // If Laravel is unavailable, omit this section.
  if (!statistics) {
    return null;
  }

  const items = [
    {
      label: "Available Properties",
      value: statistics.total,
    },
    {
      label: "Properties for Sale",
      value: statistics.for_sale,
    },
    {
      label: "Properties for Rent",
      value: statistics.for_rent,
    },
  ];

  return (
    <section
      aria-label="Gracious Investment property statistics"
      className="bg-[#f8faf9] px-5 py-12 sm:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#02716d]">
            Our Property Portfolio
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-[#123b39] sm:text-3xl">
            Find Your Next Property
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            Explore properties currently available through Gracious Investment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-7 text-center shadow-sm"
            >
              <p className="text-4xl font-bold tabular-nums text-[#025a58]">
                {item.value.toLocaleString("en-RW")}
              </p>

              <p className="mt-3 text-sm font-semibold text-[#123b39]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
