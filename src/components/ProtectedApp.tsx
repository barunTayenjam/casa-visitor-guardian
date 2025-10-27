import React, { Suspense } from 'react';
import { SecurityLayout } from "./layout/SecurityLayout";
import { SocketProvider } from "../contexts/SocketContext";
import { CameraProvider } from "../contexts/CameraContext";
import { EventsProvider } from "../contexts/EventsContext";
import { Outlet } from "react-router-dom";

// Loading fallback
const LoadingFallback = () => (
  <div style={{ padding: '20px', background: '#1a1a1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div>Loading secure area...</div>
  </div>
);

export const ProtectedApp = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SocketProvider>
        <CameraProvider>
          <EventsProvider>
            <SecurityLayout>
              <Outlet />
            </SecurityLayout>
          </EventsProvider>
        </CameraProvider>
      </SocketProvider>
    </Suspense>
  );
};

export default ProtectedApp;