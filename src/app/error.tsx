"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Catches render/runtime errors in the dashboard
 * and offers a recovery path instead of a blank screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a real deployment this is where an error reporter (Sentry, etc.) hooks in.
    console.error(error);
  }, [error]);

  return (
    <main className="bg-surface-0 grid min-h-[100dvh] place-items-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <h1 className="text-fg text-xl font-semibold">Something went wrong</h1>
        <p className="text-fg-secondary text-sm">
          The dashboard hit an unexpected error. You can try again — your filters are preserved in
          the URL.
        </p>
        <button
          type="button"
          onClick={reset}
          className="border-border bg-surface-2 text-fg hover:border-accent rounded border px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
