'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Shell } from '@/components/layout/Shell';

function AuthLoading() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-background"
      role="status"
      aria-busy="true"
      aria-label="Loading your workspace"
    >
      <div className="w-full max-w-sm space-y-3 px-6">
        <div className="h-10 w-40 animate-pulse rounded-[4px] bg-white/[0.06]" aria-hidden="true" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.04]" aria-hidden="true" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.04]" aria-hidden="true" />
      </div>
    </div>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const initialized = useAuthStore((state) => state.initialized);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (pathname === '/login' || !initialized || isLoading || isAuthenticated) return;
    const redirect = encodeURIComponent(`${pathname}${window.location.search}`);
    router.replace(`/login?redirect=${redirect}`);
  }, [isAuthenticated, isLoading, initialized, pathname, router]);

  if (pathname === '/login') return <>{children}</>;
  if (!initialized || isLoading || !isAuthenticated) return <AuthLoading />;

  const pageTransition = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 }, exit: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.18, ease: 'easeOut' as const },
      };

  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pathname} {...pageTransition} className="h-full min-h-0">
          {children}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
