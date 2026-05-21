import ProtectedShell from '@/components/layout/ProtectedShell';

export default function TendersLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
