'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { io, type Socket } from 'socket.io-client';
import { publicEnv } from '@/lib/env';
import { issuedQrSchema, type IssuedQr } from '@/lib/schemas';

function toDisplayVisitUrl(visitUrl: string): string {
  const url = new URL(visitUrl);
  url.protocol = window.location.protocol;
  url.host = window.location.host;
  return url.toString();
}

type Props = {
  gateId: string;
};

export function GateDisplay({ gateId }: Props) {
  const [qr, setQr] = useState<IssuedQr | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let received = false;
    let socket: Socket | null = null;
    let fallback: number | undefined;

    const apply = async (payload: IssuedQr) => {
      const parsed = issuedQrSchema.parse({
        ...payload,
        visitUrl: toDisplayVisitUrl(payload.visitUrl),
      });
      received = true;
      const dataUrl = await QRCode.toDataURL(parsed.visitUrl, {
        width: 360,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (!active) return;
      setQr(parsed);
      setImage(dataUrl);
      setError(null);
    };

    const issueViaHttp = async () => {
      const response = await fetch(`/api/gates/${gateId}/qr`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error('Não foi possível gerar o QR');
      }
      await apply(issuedQrSchema.parse(await response.json()));
    };

    void issueViaHttp().catch((err: unknown) => {
      if (active) {
        setError(err instanceof Error ? err.message : 'Falha no monitor');
      }
    });

    socket = io(`${publicEnv.apiUrl}/gate`, {
      query: { gateId },
      transports: ['websocket', 'polling'],
    });

    socket.on('qr.updated', (payload: unknown) => {
      void apply(issuedQrSchema.parse(payload));
    });

    const timeout = window.setTimeout(() => {
      if (active && !received) {
        setError('Aguardando o QR da portaria…');
      }
    }, 8000);

    socket.on('connect_error', () => {
      if (fallback) return;
      void issueViaHttp().catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Falha no monitor');
        }
      });
      fallback = window.setInterval(() => {
        void issueViaHttp().catch(() => undefined);
      }, 40_000);
    });

    return () => {
      active = false;
      socket?.disconnect();
      window.clearTimeout(timeout);
      if (fallback) window.clearInterval(fallback);
    };
  }, [gateId]);

  const remaining = useMemo(() => {
    if (!qr) return 0;
    return Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - now) / 1000));
  }, [now, qr]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-10 text-center text-slate-100">
      <p className="text-sm uppercase tracking-[0.25em] text-sky-400">Portaria</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        {qr?.gateName ?? 'Carregando…'}
      </h1>
      <p className="mt-2 max-w-md text-slate-300">
        Aponte a câmera do celular para o QR. O código troca sozinho a cada 45 segundos.
      </p>

      <div className="mt-8 rounded-3xl bg-white p-5 shadow-2xl">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="QR Code da visita" width={320} height={320} />
        ) : (
          <div className="flex h-80 w-80 items-center justify-center text-slate-500">
            Gerando QR…
          </div>
        )}
      </div>

      <p className="mt-6 text-lg text-slate-200">
        Expira em <span className="font-semibold text-white">{remaining}s</span>
      </p>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {qr && (
        <a
          href={qr.visitUrl}
          className="mt-8 text-sm text-sky-400 underline-offset-4 hover:underline"
        >
          Abrir o fluxo deste QR neste aparelho
        </a>
      )}
    </main>
  );
}
