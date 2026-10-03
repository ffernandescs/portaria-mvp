'use client';

import { useEffect, useState } from 'react';
import { fetchEvents, fetchGates, fetchResidents, fetchUnits } from '@/lib/admin-api';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    units: 0,
    residents: 0,
    gatesOnline: 0,
    events: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchUnits(), fetchResidents(), fetchGates(), fetchEvents()])
      .then(([units, residents, gates, events]) => {
        setStats({
          units: units.length,
          residents: residents.length,
          gatesOnline: gates.filter((gate) => gate.status === 'ONLINE').length,
          events: events.length,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar o resumo');
      });
  }, []);

  return (
    <section>
      <h2 className="text-2xl font-semibold text-white">Resumo do condomínio</h2>
      <p className="mt-2 text-sm text-slate-400">
        Cadastre unidades e moradores, acompanhe o agente da portaria e os eventos de acesso.
      </p>
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Unidades" value={stats.units} />
        <Card label="Moradores" value={stats.residents} />
        <Card label="Portarias online" value={stats.gatesOnline} />
        <Card label="Eventos recentes" value={stats.events} />
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
