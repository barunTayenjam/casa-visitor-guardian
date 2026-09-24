# ADR-001: Frontend State Management — Zustand over React Contexts

**Date:** 2026-09-24  
**Status:** Proposed  
**Deciders:** SentryVision team

## Context

The frontend currently uses 3 React Contexts (Auth, Camera, Socket) + React Query for server state. Provider nesting is 7 levels deep in `App.tsx`. Each context triggers re-renders on any state change, causing performance issues on the stream dashboard (60fps frame updates via Socket.io).

Key pain points:
- `CameraContext` holds camera list + stream state — any camera status update re-renders all consumers
- `SocketContext` wraps the entire app — connection status changes re-render everything
- No way to subscribe to specific state slices (Zustand selector pattern)

## Decision

**Use Zustand** for client-side state management. React Query stays for server state (API cache).

### Stores to Create

| Store | Replaces | Key State |
|-------|----------|-----------|
| `authStore.ts` | `AuthContext` | user, token, isAuthenticated, isLoading, error |
| `cameraStore.ts` | `CameraContext` | cameras[], streamingCameras, loading, error |
| `socketStore.ts` | `SocketContext` | connected, connectionStatus |
| `uiStore.ts` | (new) | theme, activeCameraId, sidebarOpen, focusedModal |

### Migration Path

1. Create Zustand stores alongside existing contexts
2. Migrate one provider at a time (Socket → Camera → Auth)
3. Remove context providers from `App.tsx` after migration
4. Update all `useContext` calls to store hooks

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Zustand** (chosen) | No providers, selective subscriptions, small bundle (~1KB), immer built-in | New dependency |
| Jotai | Atomic state, fine-grained | More complex API, less community |
| Redux Toolkit | Mature, DevTools | Heavy, boilerplate, overkill for this scale |
| React Context only | No new deps | Re-render cascade, no selectors |

## Consequences

**Positive:**
- Eliminates 7-level provider nesting
- Selective subscriptions prevent unnecessary re-renders
- ~1KB gzipped bundle increase
- Better TypeScript inference

**Negative:**
- One new dependency to maintain
- Migration effort: ~2 days for 3 stores + updating all consumers

**Risks:**
- Zustand v5 has breaking changes from v4 — pin to v4 for stability
