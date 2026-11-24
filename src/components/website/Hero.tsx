"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const search = query.trim();

    router.push(
      search
        ? `/properties?q=${encodeURIComponent(search)}`
        : "/properties"
    );
  }

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[740px]
        items-center overflow-hidden bg-[#003020]
        px-5 pb-24 pt-40 text-white
        sm:min-h-[780px] sm:px-8
        lg:min-h-screen lg:pb-32 lg:pt-44"
    >
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0
          bg-[radial-gradient(ellipse_at_75%_30%,#655A32_0%,transparent_45%),linear-gradient(125deg,#003020_10%,#004D37_58%,#003020_100%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40
          top-1/4 h-[480px] w-[480px] rounded-full
          border border-white/10
          sm:h-[650px] sm:w-[650px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20
          top-1/3 h-[300px] w-[300px] rounded-full
          border border-white/10
          sm:h-[450px] sm:w-[450px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0
          opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(90deg,white 1px,transparent 1px)," +
            "linear-gradient(white 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div
        className="relative z-10 mx-auto w-full max-w-6xl
          text-center"
      >
        <p
          className="gracious-hero-enter gracious-hero-delay-1
            mx-auto mb-6 inline-flex items-center
            gap-2 rounded-full border border-white/20
            bg-white/10 px-5 py-2 text-xs
            font-medium tracking-[0.16em]
            text-[#F8EDD2] backdrop-blur-sm
            sm:text-sm"
        >
          REAL ESTATE IN RWANDA
        </p>

        <h1
          id="hero-heading"
          className="gracious-hero-enter gracious-hero-delay-2
            mx-auto max-w-5xl text-4xl font-semibold
            leading-[1.13] tracking-tight
            sm:text-5xl md:text-6xl
            lg:text-[4.5rem]"
        >
          Find a place to call{" "}
          <span className="text-[#FFD050]">your own.</span>
        </h1>

        <p
          className="gracious-hero-enter gracious-hero-delay-3
            mx-auto mt-7 max-w-2xl text-base
            leading-8 text-[#F8EDD2]/90
            sm:text-lg"
        >
          Discover houses, apartments, land and investment
          properties in Rwanda. Gracious Investment helps
          you explore property opportunities with
          professional guidance.
        </p>

        {/* Property search */}
        <form
          role="search"
          aria-label="Search properties in Rwanda"
          onSubmit={handleSearch}
          className="gracious-hero-enter gracious-hero-delay-4
            mx-auto mt-10 flex w-full max-w-3xl
            flex-col gap-2 rounded-2xl bg-white
            p-2 text-left shadow-[0_25px_65px_rgba(0,0,0,0.22)]
            sm:flex-row sm:items-center sm:rounded-full
            sm:p-2.5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-[#003020]"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>

            <label htmlFor="hero-property-search" className="sr-only">
              Search by location or property keyword
            </label>

            <input
              id="hero-property-search"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Kigali, Kicukiro, houses, land..."
              autoComplete="off"
              maxLength={120}
              className="h-14 min-w-0 w-full
                bg-transparent text-base text-slate-800
                outline-none placeholder:text-slate-500
                focus-visible:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-14 shrink-0 items-center
              justify-center rounded-xl bg-[#E0A020]
              px-9 font-semibold text-[#003020]
              transition-[background-color,transform,box-shadow]
              duration-200 hover:bg-[#FFD050]
              hover:shadow-md active:scale-[0.98]
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#E0A020]
              sm:rounded-full
              motion-reduce:transform-none
              motion-reduce:transition-none"
          >
            Search Properties
          </button>
        </form>

        {/* Quick navigation */}
        <div
          className="gracious-hero-enter gracious-hero-delay-5
            mt-7 flex flex-wrap items-center
            justify-center gap-x-5 gap-y-3
            text-sm text-[#F8EDD2]/90"
        >
          <span className="text-[#D6BE80]/70">
            Explore:
          </span>

          <Link
            href="/properties"
            className="underline-offset-4 transition-colors
              hover:text-white hover:underline
              focus-visible:underline"
          >
            All Properties
          </Link>

          <Link
            href="/rentals"
            className="underline-offset-4 transition-colors
              hover:text-white hover:underline
              focus-visible:underline"
          >
            Properties for Rent
          </Link>

          <Link
            href="/#services"
            className="underline-offset-4 transition-colors
              hover:text-white hover:underline
              focus-visible:underline"
          >
            Our Services
          </Link>
        </div>

        <p
          className="gracious-hero-enter gracious-hero-delay-5
            mt-16 text-xs font-medium uppercase
            tracking-[0.2em] text-[#D6BE80]/70"
        >
          Your Property, Our Commitment.
        </p>
      </div>
    </section>
  );
}
