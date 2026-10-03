'use client';

import { useEffect, useState } from 'react';
import { backendUrl } from '@/lib/backend';

type Props = {
  residentId: string;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function ResidentNotify({ residentId }: Props) {
  const [name, setName] = useState('Morador');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(backendUrl(`/residents/${residentId}/notify-profile`))
      .then(async (response) => {
        if (!response.ok) throw new Error('Morador não encontrado');
        return response.json() as Promise<{ name: string }>;
      })
      .then((profile) => setName(profile.name))
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : 'Falha ao carregar');
      });
  }, [residentId]);

  async function subscribe() {
    setBusy(true);
    setMessage(null);
    try {
      const vapid = await fetch(backendUrl('/notifications/vapid-public')).then(
        (response) => response.json() as Promise<{ publicKey: string | null }>,
      );
      if (!vapid.publicKey) {
        throw new Error('Web Push ainda sem chaves VAPID. Use o Telegram ou o link de desenvolvimento.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permissão de notificação negada');
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) as BufferSource,
      });
      const payload = subscription.toJSON();
      const response = await fetch(backendUrl(`/residents/${residentId}/push`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: payload.endpoint,
          keys: payload.keys,
        }),
      });
      if (!response.ok) {
        throw new Error('Não foi possível salvar a inscrição');
      }
      setMessage('Notificações ativadas neste aparelho.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Falha ao ativar notificações');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-950 px-5 py-10 text-slate-100">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Morador</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">{name}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Ative o Web Push para receber o pedido de visita neste celular. No Telegram, envie
        {' '}
        <code className="text-sky-300">/vincular {residentId}</code>
        {' '}
        ao bot.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void subscribe()}
        className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
      >
        Ativar notificações
      </button>
      {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
    </main>
  );
}
