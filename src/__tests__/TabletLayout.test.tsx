import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabletLayout } from '@/components/layout/TabletLayout';
import { SocketProvider } from '@/contexts/SocketContext';
import { CameraProvider } from '@/contexts/CameraContext';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <SocketProvider>
      <CameraProvider>
        {children}
      </CameraProvider>
    </SocketProvider>
  </BrowserRouter>
);

describe('TabletLayout', () => {
  it('renders header with Casa Security title', () => {
    render(
      <TestWrapper>
        <TabletLayout />
      </TestWrapper>
    );
    
    expect(screen.getByText('Casa Security')).toBeInTheDocument();
  });

  it('displays connection status', () => {
    render(
      <TestWrapper>
        <TabletLayout />
      </TestWrapper>
    );
    
    // Should show either "Live" or connection status
    expect(screen.getByText(/Live|Connecting|Disconnected/)).toBeInTheDocument();
  });

  it('shows alerts and settings buttons', () => {
    render(
      <TestWrapper>
        <TabletLayout />
      </TestWrapper>
    );
    
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});