'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearAdminSession,
  fetchAdminMe,
  readAdminAccessToken,
  type AdminProfile,
} from '@/lib/admin-api';

const links = [
  { href: '/admin', label: 'Resumo' },
  { href: '/admin/units', label: 'Unidades' },
  { href: '/admin/residents', label: 'Moradores' },
  { href: '/admin/gates', label: 'Portarias' },
  { href: '/admin/events', label: 'Eventos' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  useEffect(() => {
    if (!readAdminAccessToken()) {
      router.replace('/admin/login');
      return;
    }

    fetchAdminMe()
      .then(setAdmin)
      .catch(() => {
        clearAdminSession();
        router.replace('/admin/login');
      });
  }, [router]);

  function logout() {
    clearAdminSession();
    router.replace('/admin/login');
  }

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Carregando painel…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-5 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Painel</p>
            <h1 className="text-lg font-semibold text-white">Portaria Virtual</h1>
            <p className="text-xs text-slate-400">
              {admin.email} · {admin.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="self-start rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
          >
            Sair
          </button>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active ? 'bg-sky-500 text-slate-950' : 'border border-slate-800 text-slate-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
    </div>
  );
}
