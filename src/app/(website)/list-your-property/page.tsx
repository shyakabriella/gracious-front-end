import type { Metadata } from "next";
import PropertySubmissionForm from "@/components/website/PropertySubmissionForm";

export const metadata: Metadata = {
  title: "List Your Property in Rwanda",
  description:
    "Submit your house, apartment, land or investment property to " +
    "Gracious Investment Ltd for sale, rental or professional management in Rwanda.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function ListYourPropertyPage() {

  const headline: string = "Sell, Rent or Manage Your Property in Rwanda";
  const words: string[] = headline.split(" ");
  let charIndexGlobal = 0;

  
  return (
    <div className="min-h-screen bg-[#F6F8F5]">
      <section className="relative flex min-h-[450px] items-center justify-center overflow-hidden px-5 py-16 text-white sm:py-20 lg:py-32">
  <video
    autoPlay
    muted
    loop
    playsInline
    className="absolute inset-0 h-full w-full object-cover"
  >
    <source src="/video/1.mp4" type="video/mp4" />
  </video>

  {/* Centered content stack */}
  <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
    <span className="inline-flex rounded-full border border-amber-300/35 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
      Partner with Gracious Investment
    </span>

    <h1 className="mt-6 text-3xl font-semibold leading-snug sm:text-4xl lg:text-5xl">
      {words.map((word: string, wIdx: number) => (
        <span key={wIdx} className="mr-2.5 inline-block whitespace-nowrap last:mr-0">
          {word.split("").map((char: string, cIdx: number) => {
            const delay = charIndexGlobal++ * 0.06;
            return (
              <span
                key={cIdx}
                className="animate-letter"
                style={{ animationDelay: `${delay}s` }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </h1>

    <svg viewBox="0 0 320 18" fill="none" className="mt-2 w-48 sm:w-64">
      <path
        d="M3 13C85 4 215 3 317 11"
        stroke="#34d399"
        strokeWidth="3"
        strokeLinecap="round"
        className="animate-underline"
        style={{ animationDelay: `${charIndexGlobal * 0.06 + 0.1}s` }}
      />
    </svg>
  </div>
</section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_290px] lg:py-16">
        <div>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
              Property submission
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[#073B2A] sm:text-3xl">
              Tell us about your property
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Fields marked with * are required. You can submit
              without creating a website account.
            </p>
          </div>

          <PropertySubmissionForm />
        </div>

        <aside className="self-start lg:sticky lg:top-28">
          <div className="rounded-3xl bg-white p-7 shadow-lg shadow-emerald-950/5">
            <h2 className="text-xl font-bold text-[#073B2A]">
              What happens next?
            </h2>

            <ol className="mt-6 space-y-6 text-sm">
              <li>
                <strong className="block text-[#073B2A]">
                  1. Submit your property
                </strong>
                <p className="mt-1 leading-6 text-slate-500">
                  Provide ownership, contact, location and property details.
                </p>
              </li>
              <li>
                <strong className="block text-[#073B2A]">
                  2. Gracious reviews
                </strong>
                <p className="mt-1 leading-6 text-slate-500">
                  Our team checks the information and may request
                  supporting documents.
                </p>
              </li>
              <li>
                <strong className="block text-[#073B2A]">
                  3. Owner verification
                </strong>
                <p className="mt-1 leading-6 text-slate-500">
                  We verify ownership and independently confirm
                  authorization when an agent applies.
                </p>
              </li>
              <li>
                <strong className="block text-[#073B2A]">
                  4. Approval decision
                </strong>
                <p className="mt-1 leading-6 text-slate-500">
                  The team decides whether to approve the submission.
                  Public listing requires separate checks.
                </p>
              </li>
            </ol>
          </div>

          <div className="mt-5 rounded-3xl bg-[#E5EFDA] p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#477044]">
              Our commitment
            </p>
            <p className="mt-3 text-xl font-semibold leading-8 text-[#073B2A]">
              Your Property, Our Commitment.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
