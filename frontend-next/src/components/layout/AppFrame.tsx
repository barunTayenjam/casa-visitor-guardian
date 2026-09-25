'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Shell } from '@/components/layout/Shell';

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
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
