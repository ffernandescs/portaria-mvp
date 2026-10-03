'use client';

import { useEffect, useState } from 'react';
import { fetchEvents, type AdminEvent } from '@/lib/admin-api';

export function AdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetchEvents()
        .then(setEvents)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Falha ao listar eventos');
        });

    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Eventos de acesso</h2>
        <p className="mt-1 text-sm text-slate-400">Auditoria append-only. Atualiza sozinha.</p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
        {events.map((event) => (
          <li key={event.id} className="px-4 py-3">
            <p className="font-medium text-white">{event.type}</p>
            <p className="text-xs text-slate-400">
              {new Date(event.createdAt).toLocaleString('pt-BR')} · {event.actor}
              {event.gate ? ` · ${event.gate.name}` : ''}
              {event.visitRequest?.visitorName ? ` · ${event.visitRequest.visitorName}` : ''}
            </p>
          </li>
        ))}
        {events.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Nenhum evento ainda.</li>}
      </ul>
    </section>
  );
}
