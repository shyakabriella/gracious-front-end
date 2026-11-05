"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/properties?q=${encodeURIComponent(q)}` : "/properties");
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/images/branding/hero.jpg"
        alt="Modern home interior with wooden staircase"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 w-full px-4 text-center">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl md:text-5xl">
          Easiest way to find your dream home
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Your ZIP code or City. e.g. New York"
            aria-label="Search by ZIP code or city"
            className="h-16 w-full flex-1 rounded-full bg-white px-8 text-base text-gray-800 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-[#025a58]"
          />
          <button
            type="submit"
            className="h-[68px] w-full rounded-full bg-[#025a58] px-10 text-lg font-medium text-white transition-colors hover:bg-[#047370] sm:w-auto"
          >
            Search
          </button>
        </form>
      </div>
    </section>
  );
}
