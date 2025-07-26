
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
// import { DebugProvider } from "./contexts/DebugContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import MotionEvents from "./pages/MotionEvents";
import SimpleSettings from "./pages/SimpleSettings";
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
                  <Route path="/" element={<TabletSecurityLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="events" element={<MotionEvents />} />
                    <Route path="analytics" element={<SimpleSettings />} />
                    <Route path="settings" element={<SimpleSettings />} />
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
