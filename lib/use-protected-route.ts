'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';

export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
