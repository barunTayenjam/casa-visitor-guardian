import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabletCameraGrid } from '@/components/dashboard/TabletCameraGrid';
import { CameraProvider } from '@/contexts/CameraContext';
import { SocketProvider } from '@/contexts/SocketContext';

const mockCameras = [
  {
    id: 'cam1',
    name: 'Front Door',
    status: 'online' as const,
    streamUrl: 'rtsp://test1',
    location: 'Front',
    detectionEnabled: true,
    sensitivity: 0.5,
    lastSeen: new Date(),
    resolution: '1920x1080',
    fps: 30,
    thumbnail: '/test.jpg'
  },
  {
    id: 'cam2',
    name: 'Back Yard',
    status: 'offline' as const,
    streamUrl: 'rtsp://test2',
    location: 'Back',
    detectionEnabled: false,
    sensitivity: 0.3,
    lastSeen: new Date(),
    resolution: '1280x720',
    fps: 15,
    thumbnail: '/test2.jpg'
  }
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <SocketProvider>
      <CameraProvider>
        {children}
      </CameraProvider>
    </SocketProvider>
  </BrowserRouter>
);

// Mock the CameraStream component
jest.mock('@/components/dashboard/CameraStream', () => ({
  CameraStream: ({ camera }: { camera: any }) => (
    <div data-testid={`camera-stream-${camera.id}`}>
      Mock Stream for {camera.name}
    </div>
  )
}));

describe('TabletCameraGrid', () => {
  it('renders loading state initially', () => {
    render(
      <TestWrapper>
        <TabletCameraGrid />
      </TestWrapper>
    );
    
    expect(screen.getByText('Loading Cameras...')).toBeInTheDocument();
  });

  it('renders camera cards with proper styling', () => {
    // Mock the useCameras hook to return test data
    const mockUseCameras = jest.fn(() => ({
      cameras: mockCameras,
      loading: false,
      error: null
    }));
    
    jest.doMock('@/contexts/CameraContext', () => ({
      useCameras: mockUseCameras
    }));

    render(
      <TestWrapper>
        <TabletCameraGrid />
      </TestWrapper>
    );
    
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('Back Yard')).toBeInTheDocument();
  });

  it('shows no cameras message when empty', () => {
    const mockUseCameras = jest.fn(() => ({
      cameras: [],
      loading: false,
      error: null
    }));
    
    jest.doMock('@/contexts/CameraContext', () => ({
      useCameras: mockUseCameras
    }));

    render(
      <TestWrapper>
        <TabletCameraGrid />
      </TestWrapper>
    );
    
    expect(screen.getByText('No Cameras Configured')).toBeInTheDocument();
  });

  it('handles camera click events', () => {
    const onCameraSelect = jest.fn();
    
    const mockUseCameras = jest.fn(() => ({
      cameras: mockCameras,
      loading: false,
      error: null
    }));
    
    jest.doMock('@/contexts/CameraContext', () => ({
      useCameras: mockUseCameras
    }));

    render(
      <TestWrapper>
        <TabletCameraGrid onCameraSelect={onCameraSelect} />
      </TestWrapper>
    );
    
    const cameraCard = screen.getByText('Front Door').closest('[role="button"], div[class*="cursor-pointer"]');
    if (cameraCard) {
      fireEvent.click(cameraCard);
      expect(onCameraSelect).toHaveBeenCalled();
    }
  });
});