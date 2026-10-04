'use client';

export default function LoadingRoute() {
  return (
    <div
      className="min-h-[50vh] space-y-4 p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-8 w-48 animate-pulse rounded-[4px] bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[4px] border border-white/[0.06] bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-[4px] border border-white/[0.06] bg-white/[0.04]" />
    </div>
  );
}
