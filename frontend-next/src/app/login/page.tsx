import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginPage from '@/views/LoginPage';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
