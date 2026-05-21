import ProtectedShell from '@/components/layout/ProtectedShell';

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
