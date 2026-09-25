import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/api/authService';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscores, and hyphens only'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['admin', 'user', 'viewer']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, completeLogin } = useAuth();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // MFA states
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaPendingToken, setMfaPendingToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [loginValidationErrors, setLoginValidationErrors] = useState<
    Partial<Record<keyof LoginFormData, string>>
  >({});

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    getValues,
    formState: { errors: loginErrors, isSubmitting: isLoggingIn },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    setValue: setSignupValue,
    watch: watchSignup,
    formState: { errors: signupErrors, isSubmitting: isSigningUp },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'user' },
  });

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/';
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, searchParams]);

  const onLogin = async (data: LoginFormData) => {
    setFormError(null);
    try {
      const response = await authService.login(data.username, data.password);
      if (response.mfaRequired && response.pendingToken) {
        setMfaPendingToken(response.pendingToken);
        setMfaStep(true);
        return;
      }
      if (response.success && response.user && response.token) {
        completeLogin(response.user, response.token);
      } else {
        const message = response.error || 'Invalid credentials';
        setFormError(message);
        toast({ variant: 'destructive', title: 'Login failed', description: message });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = loginSchema.safeParse(getValues());
    if (!result.success) {
      const nextErrors: Partial<Record<keyof LoginFormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === 'username' || field === 'password') nextErrors[field] = issue.message;
      }
      setLoginValidationErrors(nextErrors);
      return;
    }
    setLoginValidationErrors({});
    await handleLoginSubmit(onLogin)(event);
  };

  const onRegister = async (data: RegisterFormData) => {
    setFormError(null);
    try {
      const response = await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role,
      });
      if (response.success && response.user && response.token) {
        completeLogin(response.user, response.token);
      } else {
        setFormError(response.error || 'Registration failed');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 6) return;
    setMfaSubmitting(true);
    setFormError(null);
    try {
      const response = await authService.mfaChallenge(mfaPendingToken, mfaCode);
      if (response.success && response.user && response.token) {
        completeLogin(response.user, response.token);
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description: response.error || 'Invalid authentication code',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'MFA verification failed',
      });
    } finally {
      setMfaSubmitting(false);
    }
  };

  const usernameError = loginValidationErrors.username ?? loginErrors.username?.message;
  const passwordError = loginValidationErrors.password ?? loginErrors.password?.message;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#050505]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5E6AD2]/10 border border-[#5E6AD2]/20 text-[11px] uppercase tracking-[0.1em] font-medium text-[#5E6AD2] mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            SentryVision
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#ECECEC] mb-1">
            Welcome back
          </h1>
          <p className="text-[13px] text-[#A1A1A8]">Self-hosted AI security monitoring</p>
        </div>

        {/* Auth Card */}
        <div className="rounded-[8px] bg-[#0A0A0B] border border-white/[0.06] p-6 shadow-lg shadow-black/40">
          {formError && (
            <Alert className="mb-4 bg-red-500/10 border-red-500/20 text-[#F87171] rounded-[4px] py-2">
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}

          <AnimatePresence mode="wait">
            {mfaStep ? (
              <motion.form
                key="mfa"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={onMfaSubmit}
                className="space-y-4"
              >
                <div className="text-center mb-2">
                  <p className="text-[13px] text-[#A1A1A8]">
                    Enter the verification code from your authenticator app
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa" className="text-xs text-[#A1A1A8] font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="mfa"
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-10 text-center tracking-[0.3em] font-mono text-lg rounded-[4px] focus:border-[#5E6AD2]"
                    placeholder="000000"
                    disabled={mfaSubmitting}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={mfaCode.length < 6 || mfaSubmitting}
                  className="w-full h-9 bg-[#5E6AD2] hover:bg-[#6E7AE0] text-white rounded-[4px] text-xs font-medium"
                >
                  {mfaSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    'Verify & Sign In'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaStep(false);
                    setMfaPendingToken('');
                    setMfaCode('');
                  }}
                  className="w-full text-center text-xs text-[#6B6B73] hover:text-[#A1A1A8] transition-colors pt-1"
                >
                  Back to login
                </button>
              </motion.form>
            ) : user?.role === 'admin' ? (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-5 bg-[#121215] p-0.5 rounded-[4px]">
                  <TabsTrigger value="login" className="text-xs rounded-[3px] data-[state=active]:bg-[#1A1A1D] data-[state=active]:text-[#ECECEC]">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" className="text-xs rounded-[3px] data-[state=active]:bg-[#1A1A1D] data-[state=active]:text-[#ECECEC]">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={submitLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs text-[#A1A1A8]">
                        Username
                      </Label>
                      <Input
                        id="username"
                        {...registerLogin('username')}
                        className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-9 rounded-[4px] focus:border-[#5E6AD2]"
                        placeholder="admin"
                        disabled={isLoggingIn}
                      />
                      {usernameError && (
                        <p className="text-[11px] text-[#F87171]">{usernameError}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs text-[#A1A1A8]">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          {...registerLogin('password')}
                          className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-9 rounded-[4px] pr-9 focus:border-[#5E6AD2]"
                          disabled={isLoggingIn}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6B73] hover:text-[#A1A1A8]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[11px] text-[#F87171]">{passwordError}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full h-9 bg-[#5E6AD2] hover:bg-[#6E7AE0] text-white rounded-[4px] text-xs font-medium"
                    >
                      {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleSignupSubmit(onRegister)} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-[#A1A1A8]">Username</Label>
                      <Input
                        {...registerSignup('username')}
                        className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-8 rounded-[4px]"
                      />
                      {signupErrors.username && (
                        <p className="text-[11px] text-[#F87171]">{signupErrors.username.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-[#A1A1A8]">Email</Label>
                      <Input
                        type="email"
                        {...registerSignup('email')}
                        className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-8 rounded-[4px]"
                      />
                      {signupErrors.email && (
                        <p className="text-[11px] text-[#F87171]">{signupErrors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-[#A1A1A8]">Role</Label>
                      <Select
                        value={watchSignup('role')}
                        onValueChange={(val: 'admin' | 'user' | 'viewer') =>
                          setSignupValue('role', val)
                        }
                      >
                        <SelectTrigger className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-8 rounded-[4px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121215] border-white/[0.10]">
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-[#A1A1A8]">Password</Label>
                      <div className="relative">
                        <Input
                          type={showRegPassword ? 'text' : 'password'}
                          {...registerSignup('password')}
                          className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-8 rounded-[4px] pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6B73] hover:text-[#A1A1A8]"
                        >
                          {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {signupErrors.password && (
                        <p className="text-[11px] text-[#F87171]">{signupErrors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-[#A1A1A8]">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          {...registerSignup('confirmPassword')}
                          className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-8 rounded-[4px] pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6B73] hover:text-[#A1A1A8]"
                        >
                          {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {signupErrors.confirmPassword && (
                        <p className="text-[11px] text-[#F87171]">
                          {signupErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isSigningUp}
                      className="w-full h-8 bg-[#5E6AD2] hover:bg-[#6E7AE0] text-white rounded-[4px] text-xs font-medium mt-2"
                    >
                      {isSigningUp ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={submitLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs text-[#A1A1A8]">
                    Username
                  </Label>
                  <Input
                    id="username"
                    {...registerLogin('username')}
                    className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-9 rounded-[4px] focus:border-[#5E6AD2]"
                    placeholder="Enter your username"
                    disabled={isLoggingIn}
                  />
                  {usernameError && (
                    <p className="text-[11px] text-[#F87171]">{usernameError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs text-[#A1A1A8]">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...registerLogin('password')}
                      className="bg-[#121215] border-white/[0.06] text-[#ECECEC] h-9 rounded-[4px] pr-9 focus:border-[#5E6AD2]"
                      placeholder="Enter your password"
                      disabled={isLoggingIn}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6B73] hover:text-[#A1A1A8]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-[11px] text-[#F87171]">{passwordError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-9 bg-[#5E6AD2] hover:bg-[#6E7AE0] text-white rounded-[4px] text-xs font-medium"
                >
                  {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Sign In'}
                </Button>
              </form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-[#4A4A52] text-center mt-6">
          SentryVision v1.7.0 • Local Data Sovereignty
        </p>
      </motion.div>
    </div>
  );
}
