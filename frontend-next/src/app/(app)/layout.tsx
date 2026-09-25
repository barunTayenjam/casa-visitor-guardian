import { AppFrame } from '@/components/layout/AppFrame';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
