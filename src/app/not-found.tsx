import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <p className="text-7xl font-semibold text-accent">404</p>
        <h1 className="mt-4 text-2xl font-semibold">This page went to another dimension</h1>
        <p className="mt-2 text-muted">The link may be broken or the product is no longer available.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Back to home
          </Link>
          <Link href="/shop?sort=trending" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold">
            Shop trending
          </Link>
        </div>
      </div>
    </main>
  );
}
