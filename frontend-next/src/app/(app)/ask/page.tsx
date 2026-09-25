import type { Metadata } from 'next';
import AskPage from '@/views/AskPage';

export const metadata: Metadata = { title: 'Assistant' };

export default function AskRoute() {
  return <AskPage />;
}
