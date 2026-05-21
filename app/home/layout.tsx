import ProtectedShell from '@/components/layout/ProtectedShell';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
