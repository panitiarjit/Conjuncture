'use client';

import dynamic from 'next/dynamic';

const WaitlistForm = dynamic(() => import('@/components/WaitlistForm'), { ssr: false });

export default function WaitlistFormLoader() {
  return <WaitlistForm />;
}
