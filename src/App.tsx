import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CameraProvider } from "./contexts/CameraContext";
import StreamDashboard from "./pages/StreamDashboard";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CameraProvider>
        <StreamDashboard />
      </CameraProvider>
    </QueryClientProvider>
  );
};

export default App;