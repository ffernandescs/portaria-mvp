'use client';

import { useEffect, useState } from 'react';
import { decideApproval, fetchApproval } from '@/lib/visit-api';

type Preview = {
  visitorName: string;
  unit: string;
  residentName: string;
  selfieUrl: string | null;
  expiresAt: string;
};

type Props = {
  token: string;
};

export function ApprovePanel({ token }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchApproval(token)
      .then(setPreview)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Link inválido ou expirado');
      });
  }, [token]);

  async function decide(decision: 'APPROVED' | 'DENIED') {
    setBusy(true);
    setError(null);
    try {
      const response = await decideApproval(token, decision);
      setResult(response.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a decisão');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-950 px-5 py-10 text-slate-100">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Morador</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Pedido de visita</h1>

      {error && <p className="mt-6 text-sm text-rose-300">{error}</p>}

      {result === 'APPROVED' && (
        <p className="mt-6 text-emerald-300">Acesso aprovado. O visitante já foi avisado.</p>
      )}
      {result === 'DENIED' && (
        <p className="mt-6 text-rose-300">Acesso negado. O visitante já foi avisado.</p>
      )}

      {preview && !result && (
        <section className="mt-8 space-y-4">
          {preview.selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.selfieUrl}
              alt={`Selfie de ${preview.visitorName}`}
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
              Sem foto
            </div>
          )}
          <div>
            <p className="text-lg font-medium text-white">{preview.visitorName}</p>
            <p className="text-sm text-slate-400">
              Destino: {preview.unit} · {preview.residentName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Expira em {new Date(preview.expiresAt).toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('DENIED')}
              className="rounded-xl border border-rose-400 px-4 py-3 font-medium text-rose-200 disabled:opacity-60"
            >
              Negar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('APPROVED')}
              className="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
            >
              Aprovar
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
