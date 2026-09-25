'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-white/[0.1] bg-card p-6 text-center">
        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-destructive" />
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page could not be loaded. Your data is unchanged.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-xs font-medium text-white hover:bg-[#6e7ae0]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
