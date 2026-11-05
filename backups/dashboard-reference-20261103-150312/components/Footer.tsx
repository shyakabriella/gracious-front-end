export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-5 lg:px-8">
      <div className="flex flex-col justify-between gap-2 text-xs text-slate-500 sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()} Gracious Investment Ltd.
          All rights reserved.
        </p>
        <p>Your Property, Our Commitment.</p>
      </div>
    </footer>
  );
}
