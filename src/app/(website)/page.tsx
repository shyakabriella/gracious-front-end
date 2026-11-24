import { Suspense } from "react";
import Hero from "@/components/website/Hero";
import PopularProperties from "@/components/website/PopularProperties";
import PublicHomeStats from "@/components/website/PublicHomeStats";
import Services from "@/components/website/Services";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense
        fallback={
          <section
            className="bg-[#FAF7EF] px-5 py-24 text-center text-sm text-slate-500"
            aria-label="Featured properties loading"
          >
            Loading featured properties...
          </section>
        }
      >
        <PopularProperties />
      </Suspense>
      <Suspense fallback={null}>
        <PublicHomeStats />
      </Suspense>

      <Services />
    </>
  );
}
