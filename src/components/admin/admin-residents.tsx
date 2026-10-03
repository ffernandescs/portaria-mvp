'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  createResident,
  deleteResident,
  fetchResidents,
  fetchUnits,
  type AdminResident,
  type AdminUnit,
} from '@/lib/admin-api';

export function AdminResidents() {
  const [residents, setResidents] = useState<AdminResident[]>([]);
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [nextResidents, nextUnits] = await Promise.all([fetchResidents(), fetchUnits()]);
    setResidents(nextResidents);
    setUnits(nextUnits);
    setUnitId((current) => current || nextUnits[0]?.id || '');
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Falha ao listar moradores');
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createResident({
        name,
        nickname: nickname || undefined,
        unitIds: unitId ? [unitId] : [],
      });
      setName('');
      setNickname('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o morador');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deleteResident(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Moradores</h2>
        <p className="mt-1 text-sm text-slate-400">Cada morador fica vinculado a uma unidade.</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-800 p-4 sm:grid-cols-4">
        <input
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Apelido"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {[unit.block, unit.identifier].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
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
        {residents.map((resident) => (
          <li key={resident.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-white">{resident.name}</p>
              <p className="text-xs text-slate-400">
                {resident.units
                  .map((item) => [item.unit.block, item.unit.identifier].filter(Boolean).join(' · '))
                  .join(', ') || 'Sem unidade'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(resident.id)}
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
