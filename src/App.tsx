
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SecurityLayout } from "./components/layout/SecurityLayout";
import { MinimalLayout } from "./components/layout/MinimalLayout";
// import { CameraProvider } from "./contexts/CameraContext";
// import { EventsProvider } from "./contexts/EventsContext";
// import { SocketProvider } from "./contexts/SocketContext";
// import { DebugProvider } from "./contexts/DebugContext";
import ErrorBoundary from "./components/ErrorBoundary";
import MinimalDashboard from "./pages/MinimalDashboard";
import MinimalEvents from "./pages/MinimalEvents";
import SimpleSettings from "./pages/SimpleSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<MinimalLayout />}>
                    <Route index element={<MinimalDashboard />} />
                    <Route path="events" element={<MinimalEvents />} />
                    <Route path="analytics" element={<SimpleSettings />} />
                    <Route path="settings" element={<SimpleSettings />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
