import Link from 'next/link';
import { HealthPanel } from '@/components/health-panel';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-400">
            SaaS de condomínio
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Portaria Virtual
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Fase 5: testes, retenção automática das selfies e checklist LGPD.
            O fluxo completo já fecha do QR até o OPEN_GATE.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/gate/seed-gate-principal/display"
            className="rounded-xl bg-sky-500 px-5 py-3 text-center font-medium text-slate-950"
          >
            Monitor da portaria
          </Link>
          <Link
            href="/admin/login"
            className="rounded-xl border border-slate-700 px-5 py-3 text-center font-medium text-slate-100"
          >
            Painel admin
          </Link>
          <Link
            href="/resident/seed-resident-ana/notify"
            className="rounded-xl border border-slate-700 px-5 py-3 text-center font-medium text-slate-100"
          >
            Notificações da Ana
          </Link>
        </div>

        <HealthPanel />
      </div>
    </main>
  );
}
