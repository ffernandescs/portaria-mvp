'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { loginAdmin } from '@/lib/admin-api';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('Admin@123');
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginAdmin({ email, password, tenantSlug });
      router.replace('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12 text-slate-100">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Administração</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Entrar no painel</h1>
      <p className="mt-2 text-sm text-slate-400">
        Seed: admin@demo.local / Admin@123 · tenant demo
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          E-mail
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Senha
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Tenant
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
            value={tenantSlug}
            onChange={(event) => setTenantSlug(event.target.value)}
          />
        </label>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
