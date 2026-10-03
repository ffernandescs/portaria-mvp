'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { FaceVerify } from '@/components/visit/face-verify';
import { publicEnv } from '@/lib/env';
import { LGPD_CONSENT_TEXT } from '@/lib/lgpd';
import type { ResidentSearchResult } from '@/lib/schemas';
import { readVisitorToken, saveVisitorToken } from '@/lib/session';
import {
  acceptConsent,
  createVisitRequest,
  fetchVisitStatus,
  searchResidents,
  sendSelfie,
  startVisit,
} from '@/lib/visit-api';
import { canUseSpeechRecognition, listenOnce, speak } from '@/lib/voice';

type Step = 'boot' | 'consent' | 'selfie' | 'search' | 'waiting' | 'error';
type VisitStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'COMPLETED';

type Props = {
  token: string | null;
};

export function VisitFlow({ token }: Props) {
  const [step, setStep] = useState<Step>('boot');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResidentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ResidentSearchResult | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [visitRequestId, setVisitRequestId] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [visitStatus, setVisitStatus] = useState<VisitStatus>('PENDING');
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [showFaceCheck, setShowFaceCheck] = useState(false);
  const [listening, setListening] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const askedVoice = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('QR inválido ou expirado');
      setStep('error');
      return;
    }

    startVisit(token)
      .then((session) => {
        saveVisitorToken(session.accessToken);
        setStep('consent');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'QR inválido ou expirado');
        setStep('error');
      });
  }, [token]);

  useEffect(() => {
    if (step !== 'selfie') {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setError('Não foi possível abrir a câmera. Use HTTPS (túnel) ou permita o acesso.');
      });

    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      setSearching(true);
      searchResidents(query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (step !== 'waiting' || !visitRequestId) {
      return;
    }

    const token = readVisitorToken();
    const socket = io(`${publicEnv.apiUrl}/visitor`, {
      auth: { token },
      query: { visitRequestId },
      transports: ['websocket', 'polling'],
    });

    socket.on('visit.updated', (payload: { status?: string }) => {
      if (
        payload.status === 'APPROVED' ||
        payload.status === 'DENIED' ||
        payload.status === 'EXPIRED' ||
        payload.status === 'PENDING' ||
        payload.status === 'COMPLETED'
      ) {
        setVisitStatus(payload.status);
      }
    });

    const poll = window.setInterval(() => {
      void fetchVisitStatus(visitRequestId)
        .then((current) => {
          if (
            current.status === 'APPROVED' ||
            current.status === 'DENIED' ||
            current.status === 'EXPIRED' ||
            current.status === 'PENDING' ||
            current.status === 'COMPLETED'
          ) {
            setVisitStatus(current.status);
            if (current.selfieUrl) {
              setSelfieUrl(current.selfieUrl);
            }
          }
        })
        .catch(() => undefined);
    }, 12000);

    return () => {
      socket.disconnect();
      window.clearInterval(poll);
    };
  }, [step, visitRequestId]);

  useEffect(() => {
    if (step !== 'search' || askedVoice.current) {
      return;
    }
    askedVoice.current = true;
    speak('Quem você deseja visitar?');
  }, [step]);

  useEffect(() => {
    if (visitStatus !== 'APPROVED' || !visitRequestId || selfieUrl) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const load = () => {
      void fetchVisitStatus(visitRequestId)
        .then((current) => {
          if (cancelled) {
            return;
          }
          if (current.selfieUrl) {
            setSelfieUrl(current.selfieUrl);
            return;
          }
          timer = window.setTimeout(load, 2000);
        })
        .catch(() => {
          if (!cancelled) {
            timer = window.setTimeout(load, 2500);
          }
        });
    };

    load();
    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [visitStatus, visitRequestId, selfieUrl]);

  async function captureVoice() {
    setListening(true);
    setError(null);
    try {
      const transcript = await listenOnce();
      setQuery(transcript);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível ouvir');
    } finally {
      setListening(false);
    }
  }

  async function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao capturar a foto');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('Falha ao capturar a foto'))),
          'image/jpeg',
          0.85,
        );
      });

      await sendSelfie(blob);
      setStep('search');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no envio da selfie');
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    if (!selected) return;
    const name = visitorName.trim();
    if (name.length < 2) {
      setError('Informe o seu nome');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createVisitRequest({
        residentId: selected.id,
        unitId: selected.unit.id,
        visitorName: name,
      });
      setVisitRequestId(created.visitRequestId);
      setApprovalUrl(created.approvalUrl ?? null);
      setVisitStatus('PENDING');
      setStep('waiting');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a solicitação');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-950 px-5 py-10 text-slate-100">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Visitante</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Portaria Virtual</h1>

      {step === 'boot' && <p className="mt-8 text-slate-300">Validando o QR…</p>}

      {step === 'consent' && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-medium text-white">{LGPD_CONSENT_TEXT.title}</h2>
          {LGPD_CONSENT_TEXT.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-slate-300">
              {paragraph}
            </p>
          ))}
          <p className="text-xs text-slate-500">Versão {LGPD_CONSENT_TEXT.version}</p>
          <button
            type="button"
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950"
            onClick={() => {
              setBusy(true);
              acceptConsent()
                .then(() => setStep('selfie'))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Consentimento obrigatório');
                })
                .finally(() => setBusy(false));
            }}
            disabled={busy}
          >
            Li e autorizo o uso da minha foto
          </button>
        </section>
      )}

      {step === 'selfie' && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-medium text-white">Tire uma selfie</h2>
          <p className="text-sm text-slate-300">Use a câmera frontal. A foto vai para o morador aprovar.</p>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-square w-full rounded-2xl bg-slate-900 object-cover"
          />
          <button
            type="button"
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
            onClick={() => void captureSelfie()}
            disabled={busy}
          >
            {busy ? 'Enviando…' : 'Capturar e continuar'}
          </button>
        </section>
      )}

      {step === 'search' && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-medium text-white">Quem você deseja visitar?</h2>
          <p className="text-sm text-slate-400">
            Fale ou digite nome, bloco ou unidade (mínimo 3 caracteres).
          </p>
          <input
            value={visitorName}
            onChange={(event) => setVisitorName(event.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none"
          />
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: Ana, A, 101"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none"
            />
            {canUseSpeechRecognition() && (
              <button
                type="button"
                onClick={() => void captureVoice()}
                disabled={listening}
                className="shrink-0 rounded-xl border border-slate-700 px-4 py-3 text-sm text-sky-300 disabled:opacity-60"
              >
                {listening ? 'Ouvindo…' : 'Falar'}
              </button>
            )}
          </div>
          {searching && <p className="text-sm text-slate-400">Buscando…</p>}
          <ul className="space-y-2">
            {results.map((resident) => (
              <li key={`${resident.id}-${resident.unit.id}`}>
                <button
                  type="button"
                  onClick={() => setSelected(resident)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                    selected?.id === resident.id
                      ? 'border-sky-400 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  {resident.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resident.photoUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm">
                      {resident.displayName.slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <span className="block font-medium text-white">{resident.displayName}</span>
                    <span className="block text-sm text-slate-400">{resident.unit.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
            onClick={() => void submitRequest()}
            disabled={busy || !selected}
          >
            {busy ? 'Enviando…' : 'Pedir autorização'}
          </button>
        </section>
      )}

      {step === 'waiting' && (
        <section className="mt-8 space-y-4">
          {visitStatus === 'PENDING' && (
            <>
              <h2 className="text-xl font-medium text-white">Aguardando o morador</h2>
              <p className="text-sm leading-6 text-slate-300">
                Pedimos autorização. Esta tela atualiza sozinha quando ele responder.
              </p>
              {approvalUrl && (
                <a
                  href={approvalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-sky-400 underline-offset-4 hover:underline"
                >
                  Abrir aprovação (somente em desenvolvimento)
                </a>
              )}
            </>
          )}
          {visitStatus === 'APPROVED' && !showFaceCheck && (
            <>
              <h2 className="text-xl font-medium text-emerald-300">Aprovado pelo morador</h2>
              <p className="text-sm leading-6 text-slate-300">
                Agora valide o rosto. O portão só abre depois dessa confirmação.
              </p>
              <button
                type="button"
                onClick={() => setShowFaceCheck(true)}
                disabled={!selfieUrl}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
              >
                {selfieUrl ? 'Validar meu rosto' : 'Preparando selfie…'}
              </button>
            </>
          )}
          {visitStatus === 'APPROVED' && showFaceCheck && selfieUrl && visitRequestId && (
            <FaceVerify
              visitRequestId={visitRequestId}
              selfieUrl={selfieUrl}
              onVerified={() => setVisitStatus('COMPLETED')}
            />
          )}
          {visitStatus === 'COMPLETED' && (
            <>
              <h2 className="text-xl font-medium text-emerald-300">Rosto confirmado</h2>
              <p className="text-sm leading-6 text-slate-300">
                O comando de abertura foi enviado ao portão.
              </p>
            </>
          )}
          {visitStatus === 'DENIED' && (
            <>
              <h2 className="text-xl font-medium text-rose-300">Acesso negado</h2>
              <p className="text-sm text-slate-300">O morador recusou este pedido.</p>
            </>
          )}
          {visitStatus === 'EXPIRED' && (
            <>
              <h2 className="text-xl font-medium text-amber-300">Pedido expirado</h2>
              <p className="text-sm text-slate-300">O prazo de 5 minutos acabou. Escaneie um novo QR.</p>
            </>
          )}
        </section>
      )}

      {step === 'error' && (
        <p className="mt-8 text-sm text-rose-300">{error ?? 'QR inválido ou expirado'}</p>
      )}

      {step !== 'error' && error && (
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      )}
    </main>
  );
}
