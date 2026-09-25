'use client';

import { useSearchParams } from 'next/navigation';

const EMPTY_PARAMS = new URLSearchParams();

export function useUrlSearchParams() {
  return useSearchParams() ?? EMPTY_PARAMS;
}
