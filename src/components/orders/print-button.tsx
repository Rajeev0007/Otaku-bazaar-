"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
      Print / Save PDF
    </button>
  );
}
