
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SecurityLayout } from "./components/layout/SecurityLayout";
import { TabletSecurityLayout } from "./components/layout/TabletSecurityLayout";
import { CameraProvider } from "./contexts/CameraContext";
import { EventsProvider } from "./contexts/EventsContext";
import { SocketProvider } from "./contexts/SocketContext";
import { DebugProvider } from "./contexts/DebugContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import CameraConfig from "./pages/CameraConfig";
import MotionEvents from "./pages/MotionEvents";
import TabletAnalytics from "./pages/TabletAnalytics";
import { TabletSystemMonitor } from "./components/dashboard/TabletSystemMonitor";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DebugProvider>
          <SocketProvider>
            <CameraProvider>
              <EventsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<TabletSecurityLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="camera-config" element={<CameraConfig />} />
                    <Route path="events" element={<MotionEvents />} />
                    <Route path="analytics" element={<TabletAnalytics />} />
                    <Route path="settings" element={<TabletSystemMonitor />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              </EventsProvider>
            </CameraProvider>
          </SocketProvider>
        </DebugProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
