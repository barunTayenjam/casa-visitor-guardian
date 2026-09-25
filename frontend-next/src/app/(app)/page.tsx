import type { Metadata } from 'next';
import StreamDashboard from '@/views/StreamDashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return <StreamDashboard />;
}
