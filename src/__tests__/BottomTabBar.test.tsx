import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('BottomTabBar', () => {
  it('renders all navigation tabs', () => {
    render(
      <TestWrapper>
        <BottomTabBar />
      </TestWrapper>
    );
    
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('shows badge on Events tab', () => {
    render(
      <TestWrapper>
        <BottomTabBar />
      </TestWrapper>
    );
    
    // Events tab should have a badge with number
    const eventsTab = screen.getByText('Events').closest('a');
    expect(eventsTab).toBeInTheDocument();
    expect(eventsTab?.querySelector('[class*="badge"]')).toBeInTheDocument();
  });

  it('applies active styles to current route', () => {
    render(
      <TestWrapper>
        <BottomTabBar />
      </TestWrapper>
    );
    
    // Live tab should be active on root route
    const liveTab = screen.getByText('Live').closest('a');
    expect(liveTab).toHaveClass(/bg-primary/);
  });
});