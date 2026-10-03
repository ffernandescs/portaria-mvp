# Portaria Virtual — Frontend

Next.js App Router (porta **3000**), Tailwind e PWA básico.

```bash
cp .env.example .env.local
pnpm dev
```

O guia completo está no [README da raiz](../README.md).

## Deploy no Vercel

O Vercel só hospeda este frontend. A API Nest precisa estar **pública em HTTPS** (Railway, Render, Fly, VPS). `localhost` e túnel local não funcionam para os visitantes.

### 1. Repositório

No painel do Vercel, importe o Git e defina:

- **Root Directory:** `frontend`
- **Framework Preset:** Next.js (o `vercel.json` já declara)
- **Install Command:** `pnpm install`
- **Build Command:** `pnpm build`
- **Node.js:** 20

Se o Git da raiz for a pasta `portao ai`, o Root Directory é só `frontend`. Se o Git for a pasta pai (`MyProject`), use `portao ai/frontend`.

### 2. Variáveis no Vercel

Em **Settings → Environment Variables** (Production e Preview):

| Nome | Exemplo |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://sua-api.exemplo.com` |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | site key do Turnstile (teste: `1x00000000000000000000AA`) |

Sem barra no final. Depois de mudar `NEXT_PUBLIC_*`, faça um **Redeploy**.

### 3. Backend e R2

No `backend/.env` da API pública:

```env
FRONTEND_URL=https://seu-app.vercel.app
CORS_ORIGINS=http://localhost:3000,https://seu-app.vercel.app
```

Reinicie a API. O CORS já aceita previews `*.vercel.app`. Inclua a URL de produção no R2 (o backend aplica no boot):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://seu-app.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

O QR e os links de aprovação usam `FRONTEND_URL`. Sem a URL do Vercel, o visitante continua caindo no localhost.

### 4. Conferir o build local

```bash
pnpm --dir frontend build
```
