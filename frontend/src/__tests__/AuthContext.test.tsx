import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

jest.mock('@/services/api/authService', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    register: jest.fn(),
    changePassword: jest.fn(),
    refreshToken: jest.fn(),
    setupMFA: jest.fn(),
    verifyMFA: jest.fn(),
    mfaChallenge: jest.fn(),
    disableMFA: jest.fn(),
  },
}));

import { authService } from '@/services/api/authService';

const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="user">{auth.user?.username || 'none'}</div>
      <div data-testid="error">{auth.error || 'none'}</div>
      <button onClick={() => auth.login('test', 'test')}>Login</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should login successfully', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      success: true,
      user: { username: 'testuser' },
      token: 'token123',
    });
    (authService.getProfile as jest.Mock).mockResolvedValue({
      success: true,
      user: { username: 'testuser' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    await act(async () => {
      loginButton.click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('testuser');
  });

  it('should handle login error', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    await act(async () => {
      loginButton.click();
    });

    expect(screen.getByTestId('error').textContent).toBe('Invalid credentials');
    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
  });

  it('should logout', async () => {
    (authService.logout as jest.Mock).mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const logoutButton = screen.getByText('Logout');
    await act(async () => {
      logoutButton.click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
  });
});
