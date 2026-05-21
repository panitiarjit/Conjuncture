import { EyeOff, Lock, Scale, ShieldCheck } from 'lucide-react';
import WaitlistHeader from '@/components/WaitlistHeader';
import WaitlistForm from '@/components/WaitlistForm';

const features = [
  {
    Icon: EyeOff,
    h: 'Sealed Competitive Bids',
    d: 'Vendors submit proposals privately — no collusion, no price-sharing.',
  },
  {
    Icon: Lock,
    h: 'Escrow-Protected Payments',
    d: 'Funds are held and released only on milestone completion.',
  },
  {
    Icon: Scale,
    h: 'Government Tenders',
    d: 'Browse and apply to Thai public-sector procurement in one place.',
  },
  {
    Icon: ShieldCheck,
    h: 'Verified Vendor Network',
    d: 'Every supplier is identity-checked before appearing in results.',
  },
];

export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <WaitlistHeader />

      <main className="flex-1">
        {/* ── Hero + form ─────────────────────────────────────────────── */}
        <section className="section bg-white">
          <div className="container-app">
            <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-6">
              <span className="badge">Coming Soon</span>

              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-[#111111] leading-[1.35]">
                Thailand&apos;s Open<br />Procurement Platform
              </h1>

              <p className="text-base text-[#717171] leading-relaxed max-w-md">
                Conjuncture connects Thai businesses and government agencies with verified vendors
                through transparent, competitive procurement. Be the first to know when we launch.
              </p>

              <WaitlistForm />
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section className="section bg-[#F7F7F7]">
          <div className="container-app">
            <h2 className="text-2xl font-semibold text-center text-[#111111] mb-10">
              Everything procurement needs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {features.map((f) => (
                <div key={f.h} className="card flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
                    <f.Icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-[#111111] text-base">{f.h}</h3>
                  <p className="text-sm text-[#717171] leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Minimal footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#E0E0E0] bg-white">
        <div className="container-app py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#717171]">
              &copy; {new Date().getFullYear()} Conjuncture Co., Ltd. &nbsp;|&nbsp; Bangkok, Thailand
            </p>
            <p className="text-xs text-[#717171]">
              Regulated under Thai procurement law
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
