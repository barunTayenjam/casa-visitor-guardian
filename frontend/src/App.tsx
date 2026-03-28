import React, { Suspense, lazy } from 'react';
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
const StreamDashboard = lazy(() => import("./pages/StreamDashboard.new"));
const EventsPage = lazy(() => import("./pages/EventsPage.new"));
const SettingsPage = lazy(() => import("./pages/Settings.new"));
const AnalyticsPage = lazy(() => import("./pages/Analytics.new"));
const VisitorTimeline = lazy(() => import("./pages/VisitorTimeline.new"));
const ReviewPage = lazy(() => import("./pages/Review.new"));
const BatchDetectionPage = lazy(() => import("./pages/BatchDetectionPage"));
const BatchResultsPage = lazy(() => import("./pages/BatchResultsPage"));
const DayHighlightsPage = lazy(() => import("./pages/DayHighlights.new"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AuthRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return isAuthenticated ? <Navigate to="/app/streams" replace /> : <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

const ErrorFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full text-center">
      <div className="text-destructive mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-4">{error?.message || 'Unknown error occurred'}</p>
      <div className="space-x-2">
        <button 
          onClick={resetError} 
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
);

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-foreground text-lg">Loading...</div>
      <div className="text-muted-foreground text-sm mt-2">Initializing SentryVision</div>
    </div>
  </div>
);

const App = () => {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SocketProvider>
              <CameraProvider>
                <AuthProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium focus:outline-none"
                  >
                    Skip to main content
                  </a>
                  <Toaster />
              <main id="main-content">
              <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                  <Route path="/login" element={
                    <ErrorBoundary fallback={ErrorFallback}>
                      <Login />
                    </ErrorBoundary>
                  } />

                  <Route
                    index
                    element={
                      <AuthRedirect />
                    }
                  />

                  {/* App routes with shared navigation layout */}
                  <Route path="/app" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <StreamDashboard />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />

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

                  <Route path="/app/visitors" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <VisitorTimeline />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />

                  <Route path="/app/review" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <ReviewPage />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />

                  <Route path="/app/batch-detection" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <BatchDetectionPage />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />

                  <Route path="/app/batch-results/:jobId?" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary fallback={ErrorFallback}>
                            <BatchResultsPage />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
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
