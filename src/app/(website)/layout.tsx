import { Suspense } from "react";
import Link from "next/link";
import Navbar from "@/components/website/Navbar";

function NavigationFallback() {
  return (
    <header className="fixed inset-x-3 top-4 z-50 md:inset-x-[5.5%]">
      <nav
        aria-label="Main navigation"
        className="rounded-xl bg-[#025a58] px-6 py-5 text-white shadow-lg"
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-wide"
        >
          GRACIOUS INVESTMENT
        </Link>
      </nav>
    </header>
  );
}

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<NavigationFallback />}>
        <Navbar />
      </Suspense>
      <main>{children}</main>
    </>
  );
}
