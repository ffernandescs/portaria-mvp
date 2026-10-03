'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, type HealthSnapshot } from '@/lib/api';
import { publicEnv } from '@/lib/env';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: HealthSnapshot };

function StatusDot({ up }: { up: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${up ? 'bg-emerald-400' : 'bg-rose-400'}`}
      aria-hidden
    />
  );
}

export function HealthPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((data) => {
        if (!cancelled) setState({ kind: 'ok', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'API indisponível. Suba o backend na porta 3001.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fase 0</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Status da infraestrutura</h2>
      <p className="mt-1 text-sm text-slate-400">
        API: <code className="text-sky-300">{publicEnv.apiUrl}</code>
      </p>

      {state.kind === 'loading' && (
        <p className="mt-4 text-sm text-slate-300">Consultando /health/ready…</p>
      )}

      {state.kind === 'error' && (
        <p className="mt-4 text-sm text-rose-300">{state.message}</p>
      )}

      {state.kind === 'ok' && (
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li className="flex items-center gap-2">
            <StatusDot up={state.data.status === 'ok'} />
            API {state.data.status}
          </li>
          <li className="flex items-center gap-2">
            <StatusDot up={state.data.database?.status === 'up'} />
            Postgres {state.data.database?.status ?? 'desconhecido'}
            {state.data.database ? ` (${state.data.database.latencyMs}ms)` : ''}
          </li>
          <li className="flex items-center gap-2">
            <StatusDot up={state.data.storage?.status === 'up'} />
            R2 {state.data.storage?.status ?? 'desconhecido'}
            {state.data.storage ? ` (${state.data.storage.latencyMs}ms)` : ''}
          </li>
        </ul>
      )}
    </section>
  );
}
