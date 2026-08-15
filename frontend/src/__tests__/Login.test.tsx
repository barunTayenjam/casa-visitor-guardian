import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import AuthContext, { AuthContextType } from '../contexts/AuthContext';
import { authService } from '@/services/api/authService';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/services/api/authService');

const mockLogin = jest.fn();
const mockCompleteLogin = jest.fn();
const mockClearError = jest.fn();
const mockRegister = jest.fn();

const renderLogin = () =>
  render(
    <AuthContext.Provider value={{
      register: mockRegister,
      login: mockLogin,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      user: null,
      completeLogin: mockCompleteLogin,
      clearError: mockClearError,
      logout: jest.fn(),
      refreshToken: jest.fn(),
      changePassword: jest.fn(),
      token: null,
    } as AuthContextType}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form', () => {
    renderLogin();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should show validation errors', () => {
    renderLogin();
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(usernameInput, { target: { value: '' } });
    fireEvent.change(passwordInput, { target: { value: '' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      success: true,
      user: { username: 'testuser' },
      token: 'token123',
    });

    renderLogin();
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(authService.login).toHaveBeenCalledWith('testuser', 'password');
    expect(mockCompleteLogin).toHaveBeenCalledWith(
      { username: 'testuser' },
      'token123'
    );
  });

  it('should handle login error', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    renderLogin();
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Login failed',
      description: 'Invalid credentials',
    }));
  });

  it('should handle MFA flow', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      success: true,
      user: { username: 'testuser' },
      token: 'token123',
      mfaRequired: true,
      pendingToken: 'pending123',
    });

    renderLogin();
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(await screen.findByText(/Enter the verification code/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });
});
