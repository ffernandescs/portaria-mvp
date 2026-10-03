'use client';

import { useEffect, useRef, useState } from 'react';
import { getFaceVerifier } from '@/lib/face/face-api-verifier';
import type { LivenessProgress, LivenessStep } from '@/lib/face/face-verification';
import { verifyVisitFace } from '@/lib/visit-api';
import { speak } from '@/lib/voice';

type Props = {
  visitRequestId: string;
  selfieUrl: string;
  onVerified: () => void;
};

const STEPS: { id: LivenessStep; label: string }[] = [
  { id: 'center', label: 'Encaixe o rosto' },
  { id: 'blink', label: 'Pisque ou sorria' },
  { id: 'turn', label: 'Vire a cabeça' },
];

export function FaceVerify({ visitRequestId, selfieUrl, onVerified }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastHint = useRef('');
  const [busy, setBusy] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LivenessProgress>({
    step: 'center',
    hint: 'Encaixe o rosto no oval',
    faceFound: false,
    centered: false,
    done: [],
  });

  useEffect(() => {
    let cancelled = false;
    void getFaceVerifier()
      .load()
      .catch(() => {
        if (!cancelled) {
          setError('Não carreguei os modelos de face. Verifique a rede e tente de novo.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingModels(false);
        }
      });

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
        if (!cancelled) {
          setError('Não foi possível abrir a câmera. Use HTTPS ou permita o acesso.');
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    const video = videoRef.current;
    const image = imageRef.current;
    if (!video || !image) {
      return;
    }
    setBusy(true);
    setError(null);
    lastHint.current = '';
    try {
      if (!image.complete) {
        await image.decode();
      }
      const result = await getFaceVerifier().verify({
        video,
        referenceImage: image,
        onProgress: (next) => {
          setProgress(next);
          if (next.hint !== lastHint.current && next.faceFound) {
            lastHint.current = next.hint;
            speak(next.hint);
          }
        },
      });
      if (!result.livenessPassed) {
        throw new Error(result.reason ?? 'Não concluímos os movimentos. Tente de novo.');
      }
      await verifyVisitFace(visitRequestId, {
        matchScore: result.matchScore,
        distance: result.distance,
        livenessPassed: result.livenessPassed,
      });
      onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validação facial recusada');
    } finally {
      setBusy(false);
    }
  }

  const ovalReady = progress.centered && progress.faceFound;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium text-white">Validar meu rosto</h2>
      <p className="text-sm leading-6 text-slate-300">
        Igual ao banco: encaixe o rosto, pisque ou sorria, e vire a cabeça. Tudo no seu aparelho.
      </p>

      <ol className="flex gap-2 text-xs">
        {STEPS.map((item, index) => {
          const complete = progress.done.includes(item.id);
          const current = progress.step === item.id && busy;
          return (
            <li
              key={item.id}
              className={`flex-1 rounded-xl px-2 py-2 text-center ${
                complete
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : current
                    ? 'bg-sky-500/20 text-sky-200'
                    : 'bg-slate-900 text-slate-500'
              }`}
            >
              {index + 1}. {item.label}
              {complete ? ' ✓' : ''}
            </li>
          );
        })}
      </ol>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} src={selfieUrl} alt="" className="hidden" crossOrigin="anonymous" />

      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-3/4 w-full -scale-x-100 object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`h-[62%] w-[58%] rounded-[50%] border-4 ${
              ovalReady ? 'border-emerald-400' : 'border-white/70'
            }`}
          />
        </div>
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/75 px-3 py-2 text-center text-sm font-medium text-white">
          {busy ? progress.hint : 'Toque em começar e siga as três dicas'}
        </p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || loadingModels}
        className="w-full rounded-xl bg-sky-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-60"
      >
        {loadingModels ? 'Preparando…' : busy ? progress.hint : 'Começar validação'}
      </button>
    </section>
  );
}
