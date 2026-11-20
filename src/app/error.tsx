"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">Please try again. If it keeps happening, contact support{error.digest ? ` with reference ${error.digest}` : ""}.</p>
        <button onClick={reset} className="mt-8 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
          Try again
        </button>
      </div>
    </main>
  );
}
