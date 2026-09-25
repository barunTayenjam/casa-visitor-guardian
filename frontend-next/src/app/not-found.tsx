'use client';

import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.1] bg-card">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-mono text-xs text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Route not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This security workspace route does not exist.</p>
        <Link href="/" className="mt-6 inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-xs font-medium text-white hover:bg-[#6e7ae0]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
