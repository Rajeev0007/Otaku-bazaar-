import type { Metadata } from "next";
import { TrackForm } from "@/components/checkout/track-form";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md rounded-[1.5rem] border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Track your order</h1>
        <p className="mt-1.5 text-sm text-muted">Enter your order number and the email you used at checkout.</p>
        <div className="mt-6">
          <TrackForm initialNumber={order ?? ""} />
        </div>
      </div>
    </div>
  );
}
