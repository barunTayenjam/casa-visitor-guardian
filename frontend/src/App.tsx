
import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import { ProtectedApp } from "./components/ProtectedApp";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CameraConfig = lazy(() => import("./pages/CameraConfig"));
const MotionEvents = lazy(() => import("./pages/MotionEvents"));
const Settings = lazy(() => import("./pages/Settings"));
const VisitorTimeline = lazy(() => import("./pages/VisitorTimeline"));
const VisitorReports = lazy(() => import("./pages/VisitorReports"));
const SystemLogs = lazy(() => import("./pages/SystemLogs"));
const OpenCV = lazy(() => import("./pages/OpenCV"));
const Review = lazy(() => import("./pages/Review"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AuthRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingFallback />;
  }
  
  return isAuthenticated ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

const ErrorFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full text-center">
      <div className="text-red-500 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-slate-400 mb-4">{error?.message || 'Unknown error occurred'}</p>
      <div className="space-x-2">
        <button 
          onClick={resetError} 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
);

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-white text-lg">Loading...</div>
      <div className="text-slate-400 text-sm mt-2">Initializing security dashboard</div>
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
              <AuthProvider>
                <Toaster />
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

                  <Route path="/app" element={
                    <ProtectedRoute>
                      <ProtectedApp />
                    </ProtectedRoute>
                  }>
                    <Route index element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <Dashboard />
                      </ErrorBoundary>
                    } />
                    <Route path="opencv" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <OpenCV />
                      </ErrorBoundary>
                    } />
                    <Route path="camera-config" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <ProtectedRoute requiredRole="admin">
                          <CameraConfig />
                        </ProtectedRoute>
                      </ErrorBoundary>
                    } />
                    <Route path="events" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <MotionEvents />
                      </ErrorBoundary>
                    } />
                    <Route path="visitor-timeline" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <VisitorTimeline />
                      </ErrorBoundary>
                    } />
                    <Route path="visitor-reports" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <VisitorReports />
                      </ErrorBoundary>
                    } />
                    <Route path="logs" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <ProtectedRoute requiredRole="admin">
                          <SystemLogs />
                        </ProtectedRoute>
                      </ErrorBoundary>
                    } />

                    <Route path="review" element={
                      <ErrorBoundary fallback={ErrorFallback}>
                        <Review />
                      </ErrorBoundary>
                    } />

                    <Route path="settings" element={
                       <ErrorBoundary fallback={ErrorFallback}>
                         <ProtectedRoute requiredRole="user">
                           <Settings />
                         </ProtectedRoute>
                       </ErrorBoundary>
                     } />
                   </Route>
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </AuthProvider>
            </SocketProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
