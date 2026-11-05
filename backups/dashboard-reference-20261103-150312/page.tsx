import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  getAuthToken,
  laravelRequest,
} from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  robots: {
    index: false,
    follow: false,
  },
};

type Metric = {
  label: string;
  value: number;
};

function readableLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function collectMetrics(
  value: unknown,
  prefix = "",
  depth = 0,
): Metric[] {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    depth > 4
  ) {
    return [];
  }

  const result: Metric[] = [];

  for (const [key, item] of Object.entries(value)) {
    const label = prefix
      ? `${prefix} · ${readableLabel(key)}`
      : readableLabel(key);

    if (typeof item === "number" && Number.isFinite(item)) {
      result.push({ label, value: item });
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      result.push(...collectMetrics(item, label, depth + 1));
    }
  }

  return result;
}

async function DashboardStatistics() {
  const token = await getAuthToken();

  if (!token) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        Your session is unavailable. Please sign in again.
      </p>
    );
  }

  let metrics: Metric[] = [];
  let message = "";

  try {
    const response = await laravelRequest(
      "/dashboard/summary",
      token,
    );

    if (response.ok) {
      const data: { statistics?: unknown } =
        await response.json();

      metrics = collectMetrics(data.statistics);
    } else if (response.status === 403) {
      message = "Your account does not have permission to view dashboard statistics.";
    } else {
      message = "Dashboard statistics are currently unavailable.";
    }
  } catch {
    message = "Unable to connect to the Laravel dashboard API.";
  }

  if (message) {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {message}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-semibold text-slate-800">
          Dashboard information
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          No numeric summary statistics were returned for your account.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="statistics-heading" className="mt-9">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 id="statistics-heading" className="text-lg font-semibold text-slate-800">
            Business Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Figures provided by the Gracious Investment Laravel API.
          </p>
        </div>
        <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-medium text-[#025a58]">
          Live API
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_5px_22px_rgba(17,35,47,0.03)] transition-shadow hover:shadow-md"
          >
            <p className="min-h-10 text-sm font-medium leading-5 text-slate-500">
              {metric.label}
            </p>

            <p className="mt-4 text-3xl font-bold tracking-tight text-[#123b39] tabular-nums">
              {metric.value.toLocaleString("en-RW")}
            </p>

            <div aria-hidden="true" className="mt-5 h-1 w-10 rounded-full bg-[#025a58]" />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#02716d]">
            BUSINESS MANAGEMENT
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#142f2e] sm:text-4xl">
            Dashboard Overview
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Manage your real estate operations and review information
            available to your account.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#025a58] shadow-sm transition-colors hover:bg-slate-50"
        >
          Visit Website <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="h-42 animate-pulse rounded-2xl bg-slate-200/60 motion-reduce:animate-none"
              />
            ))}
          </div>
        }
      >
        <DashboardStatistics />
      </Suspense>

      <section aria-labelledby="workspace-heading" className="mt-10">
        <h2 id="workspace-heading" className="text-lg font-semibold text-slate-800">
          Your Workspace
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Open a management section using the navigation menu.
          Available actions depend on your account permissions.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-[#123b39]">
            Gracious Investment Management System
          </h3>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            This workspace connects to the existing Laravel backend
            for property administration, customer relationships,
            sales, rental operations and staff management.
            Each module will use the backend&apos;s verified business
            rules and permission checks.
          </p>
        </div>
      </section>
    </>
  );
}
