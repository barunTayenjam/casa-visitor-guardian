'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { authService } from '@/services/api/authService';
import { useAuthStore, type User } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z
  .object({
    username: z.string().trim().min(3, 'Use at least 3 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, underscores, or hyphens'),
    email: z.string().email('Enter a valid email address'),
    role: z.enum(['admin', 'user', 'viewer']),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const mfaSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type MfaValues = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useUrlSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const completeLogin = useAuthStore((state) => state.completeLogin);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: 'onBlur' });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'user' },
  });
  const mfaForm = useForm<MfaValues>({ resolver: zodResolver(mfaSchema), defaultValues: { code: '' } });

  useEffect(() => {
    if (!isAuthenticated) return;
    const requested = searchParams.get('redirect');
    const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
    router.replace(destination);
  }, [isAuthenticated, router, searchParams]);

  const onLogin = async (values: LoginValues) => {
    setFormError(null);
    try {
      const response = await authService.login(values.username, values.password);
      if (response.mfaRequired && response.pendingToken) {
        setMfaPendingToken(response.pendingToken);
        mfaForm.reset();
        return;
      }
      if (response.success && response.user && response.token) {
        completeLogin(response.user as User, response.token);
        return;
      }
      setFormError(response.error || 'Invalid credentials');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to sign in');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setFormError(null);
    try {
      const response = await authService.register({
        username: values.username,
        email: values.email,
        password: values.password,
        role: values.role,
      });
      if (response.success && response.user && response.token) {
        completeLogin(response.user as User, response.token);
        return;
      }
      setFormError(response.error || 'Unable to create account');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create account');
    }
  };

  const onMfa = async (values: MfaValues) => {
    if (!mfaPendingToken) return;
    setFormError(null);
    try {
      const response = await authService.mfaChallenge(mfaPendingToken, values.code);
      if (response.success && response.user && response.token) {
        completeLogin(response.user as User, response.token);
        setMfaPendingToken(null);
        return;
      }
      setFormError(response.error || 'That code was not accepted');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'MFA verification failed');
    }
  };

  const animation = reduceMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <motion.div {...animation} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#aeb7f2]">
            <ShieldCheck className="h-3.5 w-3.5" />
            SentryVision
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Self-hosted AI security monitoring</p>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-card p-6 shadow-lg shadow-black/30">
          {formError && (
            <Alert className="mb-4 rounded border border-destructive/20 bg-destructive/10 py-2 text-destructive">
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}

          <AnimatePresence mode="wait">
            {mfaPendingToken ? (
              <motion.form
                key="mfa"
                {...animation}
                onSubmit={mfaForm.handleSubmit(onMfa)}
                className="space-y-4"
              >
                <div className="text-center">
                  <p className="text-sm font-medium">Two-factor verification</p>
                  <p className="mt-1 text-xs text-muted-foreground">Enter the code from your authenticator app.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-code" className="text-xs text-muted-foreground">Verification code</Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="text-center font-mono text-lg tracking-[0.3em]"
                    {...mfaForm.register('code')}
                  />
                  {mfaForm.formState.errors.code && <p className="text-[11px] text-destructive">{mfaForm.formState.errors.code.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={mfaForm.formState.isSubmitting}>
                  {mfaForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify and sign in'}
                </Button>
                <button type="button" onClick={() => { setMfaPendingToken(null); setFormError(null); }} className="w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground">
                  Back to sign in
                </button>
              </motion.form>
            ) : (
              <Tabs defaultValue="login">
                <TabsList className="mb-5 grid w-full grid-cols-2 rounded-md bg-muted p-0.5">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  {user?.role === 'admin' && <TabsTrigger value="register">Create account</TabsTrigger>}
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs text-muted-foreground">Username</Label>
                      <Input id="username" autoComplete="username" placeholder="admin" {...loginForm.register('username')} />
                      {loginForm.formState.errors.username && <p className="text-[11px] text-destructive">{loginForm.formState.errors.username.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...loginForm.register('password')} />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {loginForm.formState.errors.password && <p className="text-[11px] text-destructive">{loginForm.formState.errors.password.message}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                      {loginForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                    </Button>
                  </form>
                </TabsContent>
                {user?.role === 'admin' && <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="register-username" className="text-xs text-muted-foreground">Username</Label>
                      <Input id="register-username" {...registerForm.register('username')} />
                      {registerForm.formState.errors.username && <p className="text-[11px] text-destructive">{registerForm.formState.errors.username.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="register-email" className="text-xs text-muted-foreground">Email</Label>
                      <Input id="register-email" type="email" {...registerForm.register('email')} />
                      {registerForm.formState.errors.email && <p className="text-[11px] text-destructive">{registerForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Role</Label>
                        <select {...registerForm.register('role')} className="h-9 w-full rounded border border-white/[0.1] bg-input px-2 text-xs">
                          <option value="user">User</option>
                          <option value="viewer">Viewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="register-password" className="text-xs text-muted-foreground">Password</Label>
                        <Input id="register-password" type="password" {...registerForm.register('password')} />
                      </div>
                    </div>
                    {registerForm.formState.errors.password && <p className="text-[11px] text-destructive">{registerForm.formState.errors.password.message}</p>}
                    <div className="space-y-1">
                      <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">Confirm password</Label>
                      <Input id="confirm-password" type="password" {...registerForm.register('confirmPassword')} />
                      {registerForm.formState.errors.confirmPassword && <p className="text-[11px] text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                      {registerForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
                    </Button>
                  </form>
                </TabsContent>}
              </Tabs>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">SentryVision · Local data sovereignty</p>
      </motion.div>
    </main>
  );
}
