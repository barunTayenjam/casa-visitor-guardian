# Frontend

React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui. Served by backend as static files.

## Quick Start

```bash
cd frontend
npm install
npm run dev          # Vite dev server on :5173
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Jest
```

**Always run `npm run lint && npm run typecheck` after changes.**

## Build

```bash
npm run build        # Vite build → dist/
```

Output goes to `frontend/dist/`, which backend serves via `server/public/`.

## Routing

```
/login              → Login.tsx (public)
/app/streams        → StreamDashboard.tsx (default redirect)
/app/events         → EventsPage.tsx
/app/people         → PeoplePage.tsx
/app/insights       → InsightsPage.tsx
/app/timelapse      → TimelapsePage.tsx
/app/ask            → AskPage.tsx
/app/logs           → LogsPage.tsx
/app/settings       → Settings.tsx
/                   → Auth redirect
*                   → NotFound.tsx
```

All `/app/*` routes wrapped in `ProtectedRoute` → `AppLayout` → `ErrorBoundary`.

## Provider Stack

```
QueryClientProvider (React Query)
  → TooltipProvider
    → BrowserRouter
      → SocketProvider (Socket.io)
        → CameraProvider (camera state)
          → AuthProvider (JWT + MFA)
            → ScrollRevealProvider (IntersectionObserver)
```

## Pages

| Page | Route | Purpose | Key Services |
|------|-------|---------|--------------|
| `StreamDashboard` | `/app/streams` | Live camera grid | `cameraService`, `SocketService` |
| `EventsPage` | `/app/events` | Event timeline + filters | `eventService`, `detectionService` |
| `PeoplePage` | `/app/people` | Face clusters + known faces | `personService`, `detectionService` |
| `InsightsPage` | `/app/insights` | Daily analytics dashboard | `insightsService`, `systemService` |
| `TimelapsePage` | `/app/timelapse` | Timelapse viewer + generator | `systemService` |
| `AskPage` | `/app/ask` | AI chat interface | `chatService` |
| `LogsPage` | `/app/logs` | System logs + alerts | `settingsService` |
| `Settings` | `/app/settings` | System settings | `settingsService`, `detectionService`, `notificationService` |
| `Login` | `/login` | Auth + MFA | `authService` |

## API Services

All in `services/api/`. Use `baseClient.ts` helpers (`apiGet`, `apiPost`, `apiPut`, `apiDelete`) for HTTP calls.

| Service | Purpose |
|---------|---------|
| `baseClient.ts` | `fetchWithRetry` with JWT, auto-refresh on 401, 120s timeout |
| `authService.ts` | Login, register, MFA, JWT management |
| `cameraService.ts` | Camera CRUD, streams, zones, filters, snapshots |
| `eventService.ts` | Event listing, calendar stats, archive |
| `detectionService.ts` | Detection triggers, settings, AI analysis, motion settings, detection redo |
| `personService.ts` | Face clusters list/name |
| `chatService.ts` | AI chat with tool calling, history |
| `insightsService.ts` | Daily insights (25+ analytics dimensions) |
| `systemService.ts` | Health, stats, overview, highlights, timelapse |
| `settingsService.ts` | System settings, detection config, logs, alerts |
| `notificationService.ts` | Push notifications, preferences, VAPID |

## Real-time

`SocketService.ts` (singleton) connects to backend via Socket.io.

Events listened: `streamFrame`, `cameraStatus`, `eventCreated`, `personDetected`, `faceDetected`, `enhancedMotionDetected`

Events emitted: `requestStream`, `stopStream`

## Contexts

| Context | File | State |
|---------|------|-------|
| `AuthContext` | `contexts/AuthContext.tsx` | User, token, login/logout, MFA, register |
| `CameraContext` | `contexts/CameraContext.tsx` | Camera list, stream management |
| `SocketContext` | `contexts/SocketContext.tsx` | Socket.io connection, event dispatch |

## UI Stack

- **Radix UI (shadcn/ui)**: Dialog, Dropdown, Select, Toast, Tooltip, etc.
- **TailwindCSS**: All styling. No CSS modules, no inline styles.
- **Recharts**: Charts in analytics/insights pages.
- **React Router v6**: Client-side routing.
- **React Query**: Server state management.

## Lazy Loading

All pages use `lazyWithRecovery()` — React lazy with chunk-reload recovery on redeploy:
```typescript
const EventsPage = lazyWithRecovery(() => import('./pages/EventsPage'));
```

## Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useCameraStream` | `hooks/useCameraStream.ts` | Camera stream lifecycle management |
| `useViewportStream` | `hooks/useViewportStream.ts` | Viewport-based stream optimization |
| `use-toast` | `hooks/use-toast.ts` | Toast notification hook |

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Router, providers, lazy page imports |
| `services/api/baseClient.ts` | HTTP client with auth, retry, refresh |
| `services/SocketService.ts` | Socket.io singleton client |
| `contexts/AuthContext.tsx` | Auth state management |
| `types/security.ts` | Shared TypeScript interfaces |

## Deployment

Frontend is compiled to static files and served by the backend:

```bash
npm run build        # → frontend/dist/
cd server && npm run build && npm start
# Backend serves frontend/dist/ as static files
```

No separate frontend container in production.
