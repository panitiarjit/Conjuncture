'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUp, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const success = await login(email, password, 'buyer');

    if (!success) {
      setError('Incorrect email or password.');
      setIsLoading(false);
      return;
    }

    // Check if this is an admin account by probing the admin API
    const probe = await fetch('/api/admin/reports?status=new', {
      headers: { 'x-admin-email': email },
    });

    if (probe.ok) {
      router.push('/admin/reports');
    } else {
      router.push('/home');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-black text-black text-lg tracking-tight">CONJUNCTURE</span>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-xl p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-[#111111] mb-1">Sign in</h1>
          <p className="text-sm text-[#717171] mb-6">Welcome back.</p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[#717171]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="input"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-[#717171]">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="input pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#111111] transition-colors focus-ring rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#717171] mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#111111] font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
