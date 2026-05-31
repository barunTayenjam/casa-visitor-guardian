import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated, isLoading, error, clearError, user } = useAuth();

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerData, setRegisterData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/app';
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    return () => { if (error) clearError(); };
  }, [error, clearError]);

  const validateLoginForm = () => {
    const errors: Record<string, string> = {};
    if (!loginData.username.trim()) errors.username = 'Username is required';
    if (!loginData.password) errors.password = 'Password is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegisterForm = () => {
    const errors: Record<string, string> = {};
    if (!registerData.username.trim()) errors.username = 'Username is required';
    else if (registerData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(registerData.username)) errors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    if (!registerData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email)) errors.email = 'Invalid email address';
    if (!registerData.password) errors.password = 'Password is required';
    else if (registerData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (!registerData.confirmPassword) errors.confirmPassword = 'Please confirm your password';
    else if (registerData.password !== registerData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    try { await login(loginData.username, loginData.password); }
    catch { /* handled by auth context */ }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;
    try {
      await register({
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        role: registerData.role,
      });
    } catch { /* handled by auth context */ }
  };

  const handleLoginChange = (field: string, value: string) => {
    setLoginData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) setValidationErrors(prev => ({ ...prev, [field]: '' }));
    if (error) clearError();
  };

  const handleRegisterChange = (field: string, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) setValidationErrors(prev => ({ ...prev, [field]: '' }));
    if (error) clearError();
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Eyebrow */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-5">
            Security Platform
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            SentryVision
          </h1>
          <p className="text-sm text-muted-foreground">
            Secure your home with advanced monitoring
          </p>
        </div>

        {/* Double-Bezel Card */}
        <div className="p-[1px] rounded-[4px] bg-white/[0.06] animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="rounded-[calc(1.75rem-1px)] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <div className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className={`grid w-full ${user?.role === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
                  <TabsTrigger value="login" className="text-xs">Sign In</TabsTrigger>
                  {user?.role === 'admin' && (
                    <TabsTrigger value="register" className="text-xs">Sign Up</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => handleLoginChange('username', e.target.value)}
                        className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11"
                        placeholder="Enter your username"
                        disabled={isLoading}
                      />
                      {validationErrors.username && <p className="text-xs text-destructive">{validationErrors.username}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showLoginPassword ? 'text' : 'password'}
                          value={loginData.password}
                          onChange={(e) => handleLoginChange('password', e.target.value)}
                          className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11 pr-11"
                          placeholder="Enter your password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          disabled={isLoading}
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
                    </div>

                    {error && (
                      <Alert className="bg-destructive/10 border-destructive/20 text-destructive rounded-[0.75rem]">
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full h-11 group" disabled={isLoading}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Sign In
                          <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-[1px] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  {user?.role !== 'admin' ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">Only administrators can create new users.</p>
                    </div>
                  ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-username" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Username</Label>
                      <Input
                        id="reg-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => handleRegisterChange('username', e.target.value)}
                        className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11"
                        placeholder="Choose a username"
                        disabled={isLoading}
                      />
                      {validationErrors.username && <p className="text-xs text-destructive">{validationErrors.username}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => handleRegisterChange('email', e.target.value)}
                        className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11"
                        placeholder="Enter your email"
                        disabled={isLoading}
                      />
                      {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Role</Label>
                      <Select
                        value={registerData.role}
                        onValueChange={(value: 'admin' | 'user' | 'viewer') => handleRegisterChange('role', value)}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="bg-white/[0.06] border-white/[0.14] text-foreground rounded-[0.75rem] h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
                          <SelectItem value="viewer" className="rounded-[0.75rem]">Viewer - View only access</SelectItem>
                          <SelectItem value="user" className="rounded-[0.75rem]">User - Standard access</SelectItem>
                          <SelectItem value="admin" className="rounded-[0.75rem]">Admin - Full access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          value={registerData.password}
                          onChange={(e) => handleRegisterChange('password', e.target.value)}
                          className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11 pr-11"
                          placeholder="Create a password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          disabled={isLoading}
                          aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-xs text-foreground/70 uppercase tracking-[0.08em] font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={registerData.confirmPassword}
                          onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                          className="bg-white/[0.06] border-white/[0.14] text-foreground placeholder:text-muted-foreground focus:bg-white/[0.06] focus:border-white/[0.15] rounded-[0.75rem] h-11 pr-11"
                          placeholder="Confirm your password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={isLoading}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {validationErrors.confirmPassword && <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>}
                    </div>

                    {error && (
                      <Alert className="bg-destructive/10 border-destructive/20 text-destructive rounded-[0.75rem]">
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full h-11 group" disabled={isLoading}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          Creating account...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Create Account
                          <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-[1px] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </Button>
                  </form>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="px-6 pb-5 text-center">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
