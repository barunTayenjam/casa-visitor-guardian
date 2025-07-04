
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SecurityLayout } from "./components/layout/SecurityLayout";
import { CameraProvider } from "./contexts/CameraContext";
import { EventsProvider } from "./contexts/EventsContext";
import { SocketProvider } from "./contexts/SocketContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import CameraConfig from "./pages/CameraConfig";
import MotionEvents from "./pages/MotionEvents";
import History from "./pages/History";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SocketProvider>
          <CameraProvider>
            <EventsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<SecurityLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="camera-config" element={<CameraConfig />} />
                    <Route path="events" element={<MotionEvents />} />
                    <Route path="history" element={<History />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </EventsProvider>
          </CameraProvider>
        </SocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
