export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#F0F0F0] rounded-lg ${className}`} />;
}
