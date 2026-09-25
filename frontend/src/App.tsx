import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { Shell } from './components/layout/Shell';
import { useAuthStore } from './stores/auth';
import { useSocketStore } from './stores/socket';

const lazyWithRecovery = (
  load: () => Promise<{ default: React.ComponentType }>,
): React.LazyExoticComponent<React.ComponentType> =>
  lazy(() =>
    load()
      .then((mod) => {
        sessionStorage.removeItem('sv:chunk-reloaded');
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem('sv:chunk-reloaded')) {
          sessionStorage.setItem('sv:chunk-reloaded', '1');
          window.location.reload();
        }
        throw err;
      }),
  );

const Login = lazyWithRecovery(() => import('./pages/Login'));
const StreamDashboard = lazyWithRecovery(() => import('./pages/StreamDashboard'));
const EventsPage = lazyWithRecovery(() => import('./pages/EventsPage'));
const SecurityPage = lazyWithRecovery(() => import('./pages/SecurityPage'));
const AnalyticsPage = lazyWithRecovery(() => import('./pages/AnalyticsPage'));
const SettingsHub = lazyWithRecovery(() => import('./pages/SettingsHub'));
const AskPage = lazyWithRecovery(() => import('./pages/AskPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const ErrorFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => (
  <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#050505]">
    <div className="max-w-md w-full">
      <div className="p-[1px] rounded-[8px] bg-white/[0.06]">
        <div className="rounded-[7px] bg-[#0A0A0B] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#F87171]/15 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-7 h-7 text-[#F87171]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2 text-[#ECECEC]">Something went wrong</h1>
          <p className="text-sm text-[#A1A1A8] mb-6">
            {error?.message || 'Unknown error occurred'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetError}
              className="rounded-[4px] bg-[#5E6AD2] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#6E7AE0] transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-[4px] bg-white/[0.06] border border-white/[0.10] text-[#ECECEC] px-5 py-2.5 text-sm font-medium hover:bg-white/[0.08] transition-colors"
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
  <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
    <div className="text-center">
      <div className="w-10 h-10 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <div className="text-[#ECECEC] text-sm font-medium">Loading</div>
      <div className="text-[#6B6B73] text-xs mt-1">Initializing SentryVision</div>
    </div>
  </div>
);

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => <Shell>{children}</Shell>;

const EventsRoute = () => (
  <ProtectedRoute>
    <AppShell>
      <ErrorBoundary fallback={ErrorFallback}>
        <EventsPage />
      </ErrorBoundary>
    </AppShell>
  </ProtectedRoute>
);

const LegacyRedirect = ({ to, view }: { to: string; view?: string }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (view) params.set('view', view);
  const query = params.toString();
  return <Navigate to={query ? `${to}?${query}` : to} replace />;
};

const App = () => {
  const initialize = useAuthStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connectSocket = useSocketStore((s) => s.connect);
  const disconnectSocket = useSocketStore((s) => s.disconnect);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      void connectSocket();
    } else {
      disconnectSocket();
    }
  }, [connectSocket, disconnectSocket, isAuthenticated]);

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#5E6AD2] focus:text-white focus:rounded-[4px] focus:text-sm focus:font-medium focus:outline-none"
            >
              Skip to main content
            </a>
            <Toaster />
            <main id="main-content" className="relative z-[1]">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <Login />
                      </ErrorBoundary>
                    }
                  />
                  <Route path="/app" element={<LegacyRedirect to="/" />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <StreamDashboard />
                          </ErrorBoundary>
                        </AppShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/app/streams" element={<LegacyRedirect to="/" />} />
                  <Route path="/events" element={<EventsRoute />} />
                  <Route path="/events/" element={<EventsRoute />} />
                  <Route
                    path="/security"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <SecurityPage />
                          </ErrorBoundary>
                        </AppShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <AnalyticsPage />
                          </ErrorBoundary>
                        </AppShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <SettingsHub />
                          </ErrorBoundary>
                        </AppShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ask"
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <AskPage />
                          </ErrorBoundary>
                        </AppShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/app/events" element={<LegacyRedirect to="/events" />} />
                  <Route path="/app/settings" element={<LegacyRedirect to="/settings" />} />
                  <Route path="/app/timelapse" element={<LegacyRedirect to="/analytics" view="timelapse" />} />
                  <Route path="/app/people" element={<LegacyRedirect to="/security" view="people" />} />
                  <Route path="/app/insights" element={<LegacyRedirect to="/analytics" />} />
                  <Route path="/app/ask" element={<LegacyRedirect to="/ask" />} />
                  <Route path="/app/logs" element={<LegacyRedirect to="/settings" view="logs" />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;