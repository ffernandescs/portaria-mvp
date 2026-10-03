'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  createGate,
  fetchGates,
  openGate,
  rotateGateKey,
  type AdminGate,
} from '@/lib/admin-api';

export function AdminGates() {
  const [gates, setGates] = useState<AdminGate[]>([]);
  const [name, setName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setGates(await fetchGates());
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar portarias');
    });
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const gate = await createGate(name);
      setRevealedKey(gate.agentKey ?? null);
      setName('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a portaria');
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string) {
    setError(null);
    try {
      const gate = await rotateGateKey(id);
      setRevealedKey(gate.agentKey ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao rotacionar a chave');
    }
  }

  async function open(id: string) {
    setError(null);
    try {
      await openGate(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar OPEN_GATE');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Portarias</h2>
        <p className="mt-1 text-sm text-slate-400">
          Status do agente e comando HMAC. A chave bruta só aparece uma vez.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl border border-slate-800 p-4 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Nome da portaria"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-sky-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
        >
          Criar
        </button>
      </form>

      {revealedKey && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          AGENT_KEY (copie agora): <code className="break-all">{revealedKey}</code>
        </p>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <ul className="space-y-3">
        {gates.map((gate) => (
          <li key={gate.id} className="rounded-2xl border border-slate-800 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{gate.name}</p>
                <p className="text-xs text-slate-400">
                  {gate.status} · {gate.id}
                  {gate.lastAgentSeenAt
                    ? ` · visto ${new Date(gate.lastAgentSeenAt).toLocaleTimeString('pt-BR')}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void open(gate.id)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950"
                >
                  Abrir portão
                </button>
                <button
                  type="button"
                  onClick={() => void rotate(gate.id)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
                >
                  Nova chave
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
