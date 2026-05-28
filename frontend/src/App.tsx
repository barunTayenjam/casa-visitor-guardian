import React, { Suspense, lazy, useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { CameraProvider } from "./contexts/CameraContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppLayout } from "./components/layout/AppLayout";

const Login = lazy(() => import("./pages/Login"));
const StreamDashboard = lazy(() => import("./pages/StreamDashboard"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const DayHighlightsPage = lazy(() => import("./pages/DayHighlights"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AuthRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  return isAuthenticated ? <Navigate to="/app/streams" replace /> : <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

const ErrorFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => (
  <div className="min-h-[100dvh] flex items-center justify-center p-4">
    <div className="max-w-md w-full">
      <div className="p-[1px] rounded-[4px] bg-white/[0.06]">
        <div className="rounded-[3px] bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">{error?.message || 'Unknown error occurred'}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetError}
              className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/85 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-white/[0.08] border border-white/[0.16] text-foreground/80 px-5 py-2.5 text-sm font-medium hover:bg-white/[0.08] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LoadingFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <div className="text-foreground text-sm font-medium">Loading</div>
      <div className="text-muted-foreground text-xs mt-1">Initializing SentryVision</div>
    </div>
  </div>
);

interface ScrollRevealContextType {
  observe: (el: HTMLElement | null) => void;
  unobserve: (el: HTMLElement) => void;
}

const ScrollRevealContext = createContext<ScrollRevealContextType>({
  observe: () => {},
  unobserve: () => {},
});

export const useScrollReveal = () => useContext(ScrollRevealContext);

const ScrollRevealProvider = ({ children }: { children: React.ReactNode }) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElements = useRef(new Map<HTMLElement, string>());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = observedElements.current.get(el) || '0ms';
            el.style.animationDelay = delay;
            el.classList.add('animate-slide-up-reveal');
            observerRef.current?.unobserve(el);
            observedElements.current.delete(el);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    return () => observerRef.current?.disconnect();
  }, []);

  const observe = useCallback((el: HTMLElement | null) => {
    if (!el || !observerRef.current) return;
    el.style.opacity = '0';
    observerRef.current.observe(el);
  }, []);

  const unobserve = useCallback((el: HTMLElement) => {
    observerRef.current?.unobserve(el);
    observedElements.current.delete(el);
  }, []);

  return (
    <ScrollRevealContext.Provider value={{ observe, unobserve }}>
      {children}
    </ScrollRevealContext.Provider>
  );
};

const App = () => {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SocketProvider>
              <CameraProvider>
                <AuthProvider>
                  <ScrollRevealProvider>
                    <a
                      href="#main-content"
                      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-full focus:text-sm focus:font-medium focus:outline-none"
                    >
                      Skip to main content
                    </a>
                    <div className="noise-overlay" />
                    <div className="fixed inset-0 pointer-events-none z-0 radial-glow" />
                    <div className="fixed inset-0 pointer-events-none z-0 radial-glow-alt" />
                    <Toaster />
                    <main id="main-content" className="relative z-[1]">
                      <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                          <Route path="/login" element={
                            <ErrorBoundary fallback={ErrorFallback}>
                              <Login />
                            </ErrorBoundary>
                          } />
                          <Route index element={<AuthRedirect />} />
                          <Route path="/app" element={<Navigate to="/app/streams" replace />} />
                          <Route path="/app/streams" element={
                            <ProtectedRoute>
                              <AppLayout>
                                <ErrorBoundary fallback={ErrorFallback}>
                                  <StreamDashboard />
                                </ErrorBoundary>
                              </AppLayout>
                            </ProtectedRoute>
                          } />
                          <Route path="/app/events" element={
                            <ProtectedRoute>
                              <AppLayout>
                                <ErrorBoundary fallback={ErrorFallback}>
                                  <EventsPage />
                                </ErrorBoundary>
                              </AppLayout>
                            </ProtectedRoute>
                          } />
                          <Route path="/app/settings" element={
                            <ProtectedRoute>
                              <AppLayout>
                                <ErrorBoundary fallback={ErrorFallback}>
                                  <SettingsPage />
                                </ErrorBoundary>
                              </AppLayout>
                            </ProtectedRoute>
                          } />
                          <Route path="/app/analytics" element={
                            <ProtectedRoute>
                              <AppLayout>
                                <ErrorBoundary fallback={ErrorFallback}>
                                  <AnalyticsPage />
                                </ErrorBoundary>
                              </AppLayout>
                            </ProtectedRoute>
                          } />
                          <Route path="/app/highlights" element={
                            <Navigate to={`/app/highlights/${new Date().toISOString().split('T')[0]}`} replace />
                          } />
                          <Route path="/app/highlights/:date" element={
                            <ProtectedRoute>
                              <AppLayout>
                                <ErrorBoundary fallback={ErrorFallback}>
                                  <DayHighlightsPage />
                                </ErrorBoundary>
                              </AppLayout>
                            </ProtectedRoute>
                          } />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </main>
                  </ScrollRevealProvider>
                </AuthProvider>
              </CameraProvider>
            </SocketProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
