'use client';

import { useProtectedRoute } from '@/lib/use-protected-route';

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}
