'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button, Spinner } from '@/components/ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await api.register({ name, email, password });
      } else {
        await api.login({ email, password });
      }
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {isRegister && (
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 8 : undefined}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      )}

      <Button type="submit" loading={busy} loadingLabel={isRegister ? 'Creating account…' : 'Signing in…'} className="w-full">
        {busy ? <Spinner className="size-4" /> : null}
        {isRegister ? 'Create account' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-slate-500">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}