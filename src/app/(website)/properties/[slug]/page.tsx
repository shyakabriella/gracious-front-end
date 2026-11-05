import { Suspense } from "react";

type PropertyPageProps = {
  params: Promise<{ slug: string }>;
};

async function PropertyDetailsContent({
  params,
}: PropertyPageProps) {
  const { slug } = await params;

  return (
    <section className="mx-auto max-w-7xl px-5 py-32">
      <h1 className="text-3xl font-semibold text-slate-900">
        Property Details
      </h1>
      <p className="mt-3 text-slate-600">{slug}</p>
    </section>
  );
}

export default function PropertyDetailsPage({
  params,
}: PropertyPageProps) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-7xl px-5 py-32">
          <p className="text-slate-600">Loading property details...</p>
        </section>
      }
    >
      <PropertyDetailsContent params={params} />
    </Suspense>
  );
}
