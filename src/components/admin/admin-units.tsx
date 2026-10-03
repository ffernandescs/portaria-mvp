'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createUnit, deleteUnit, fetchUnits, type AdminUnit } from '@/lib/admin-api';

export function AdminUnits() {
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [block, setBlock] = useState('');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setUnits(await fetchUnits());
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar unidades');
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUnit({
        identifier,
        block: block || undefined,
        floor: floor || undefined,
      });
      setIdentifier('');
      setBlock('');
      setFloor('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a unidade');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deleteUnit(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Unidades</h2>
        <p className="mt-1 text-sm text-slate-400">Blocos, números e andares do condomínio.</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-800 p-4 sm:grid-cols-4">
        <input
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Número (101)"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
        <input
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Bloco"
          value={block}
          onChange={(event) => setBlock(event.target.value)}
        />
        <input
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Andar"
          value={floor}
          onChange={(event) => setFloor(event.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-sky-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
        >
          Adicionar
        </button>
      </form>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
        {units.map((unit) => (
          <li key={unit.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-white">
                {[unit.block, unit.identifier].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-slate-400">
                {unit.floor ? `Andar ${unit.floor} · ` : ''}
                {unit._count?.residents ?? 0} moradores
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(unit.id)}
              className="text-sm text-rose-300"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
