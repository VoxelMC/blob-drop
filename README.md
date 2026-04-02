# Blob drop (Astro + Vercel Blob + Upstash Redis)

Small glassmorphism dark UI: **public downloads**, **authenticated upload/delete**, at most **3 active files**, each kept for **1 hour** (cleanup via cron + Redis-backed manifest). Max **200 MB** per file using **client-side multipart** uploads to Vercel Blob.

## Prerequisites

- Node 20+
- Vercel project with **Blob** enabled and an **Upstash Redis** database (REST API)
- Env vars configured locally (copy `.env.example` → `.env`) and on Vercel

## Setup

```bash
npm install
```

### Generate `ADMIN_PASSWORD_HASH`

Use bcrypt cost 12 (run from this folder after `npm install`):

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('YOUR_PASSWORD_HERE', 12))"
```

Put the printed hash in `ADMIN_PASSWORD_HASH` (local `.env` and Vercel env).

### Generate secrets

- `SESSION_SECRET`: long random string (32+ chars)
- `CRON_SECRET`: random string if you want to trigger `/api/cron/cleanup` manually with `Authorization: Bearer …`

## Local development

Link Vercel env or paste real `BLOB_*` and Redis `KV_*` / `REDIS_URL` values from Upstash into `.env`. The app reads **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** for the manifest. Then:

```bash
npm run dev
```

**Note:** `onUploadCompleted` uses Vercel’s callback URL. Local uploads may complete in Blob but the manifest update can fail without a public URL. For full end-to-end testing, use `vercel dev` or deploy to a preview environment.

## Deploy on Vercel

1. Push the repo and import the project in Vercel (or `vercel link`).
2. Create/link **Blob**; connect **Upstash Redis** and add the env vars from `.env.example` (at minimum `KV_REST_API_URL` and `KV_REST_API_TOKEN` for uploads and the cron manifest).
3. Deploy. Cron in [`vercel.json`](vercel.json) calls `GET /api/cron/cleanup` once daily (00:00 UTC) to delete expired blobs and trim the manifest.

## User-facing behavior

- Anyone can **download** from file URLs returned by `GET /api/files`.
- **Upload** and **delete** require signing in (`POST /api/auth/login`) with `ADMIN_USERNAME` / bcrypt `ADMIN_PASSWORD_HASH`.
- Sessions are **HttpOnly** cookies signed with `SESSION_SECRET` (JWT via `jose`).
- Slot rule: if **3 non-expired** files exist, token generation returns **403** until one is removed or expires.

## Scripts

| Command        | Action              |
| -------------- | ------------------- |
| `npm run dev`  | Astro dev server    |
| `npm run build`| Production build    |
| `npm run preview` | Preview production build |
