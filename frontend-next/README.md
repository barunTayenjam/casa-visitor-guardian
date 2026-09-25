# SentryVision Next frontend

Next.js 14 App Router frontend for SentryVision. The legacy Vite frontend remains in `frontend/` as a rollback target.

## Development

```bash
npm install
npm run dev
```

The development server runs on port 3000 by default. Set `BACKEND_URL` when the API is not running at `http://localhost:9753`:

```bash
BACKEND_URL=http://localhost:9753 npm run dev
```

Development requests to `/api/*` and `/socket.io/*` are proxied to `BACKEND_URL`. Production builds are static exports in `out/`; the existing Express server can serve that directory without changing API behavior.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

Routes: `/`, `/login`, `/events`, `/security`, `/analytics`, `/ask`, and `/settings`. Legacy `/app/*` links redirect to the corresponding workspace route.
