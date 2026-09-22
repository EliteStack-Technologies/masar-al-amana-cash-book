'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Button, ErrorNote, Field, Spinner } from '@/components/ui';


export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size={28} className="muted" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm rise">
        <div className="mb-8">
          {/* The mark is the split itself, drawn small. */}
          <div className="flex h-2 w-24" aria-hidden="true">
            <div className="flex-[7] bg-ink-900 dark:bg-ink-200" />
            <div className="flex-[2] border-l border-[var(--paper)] bg-leaf-500 dark:bg-leaf-400" />
            <div className="flex-[2] border-l border-[var(--paper)] bg-stamp-500" />
          </div>
          <h1 className="display mt-4 text-[30px] font-bold leading-none">Cash Book</h1>
          <p className="mt-2 text-[13px] muted">
            Card transactions, commission and settlement, kept in one book.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Field label="Email">
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="you@shop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Password">
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" loading={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="colhead mt-6 text-center">Shop owner access only</p>
      </div>
    </div>
  );
}
