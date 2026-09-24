# Frontend Revamp Design Spec

**Date:** 2026-09-24
**Status:** Draft
**Version:** 1.0

---

## 1. Problem Statement

The current SentryVision frontend is a Vite SPA with React Router, three nested Context providers, manual fetch patterns, and a SOC analyst workstation aesthetic. While functional, it has:

- **9 flat routes** with no information hierarchy
- **3 nested React Context providers** (Auth → Camera → Socket) causing unnecessary re-renders
- **Manual fetch + baseClient.ts** instead of leveraging the already-installed TanStack Query
- **No form validation system** — settings and login forms lack typed validation
- **CSS-only animations** (IntersectionObserver + class toggles) with no orchestrated transitions
- **Desktop-only layout** — MacDock bottom nav doesn't adapt to mobile
- **Monolithic App.tsx** (315 lines) with route definitions, providers, and fallbacks

## 2. Goals

1. **Information Architecture:** Consolidate 9 routes into 6 logical sections
2. **Visual System:** Evolve from SOC aesthetic to Linear/Resend-inspired premium dark UI
3. **Framework:** Migrate from Vite SPA to Next.js 14 App Router
4. **State Management:** Replace 3 Context providers with Zustand stores
5. **Data Fetching:** Make TanStack Query the primary data layer (already installed, underused)
6. **Forms:** Add React Hook Form + Zod for typed validation
7. **Motion:** Replace CSS/IntersectionObserver with Framer Motion
8. **Responsive:** Desktop-first with mobile adaptation (bottom nav → sidebar, touch targets)

## 3. Information Architecture

### Current (9 routes)

```
/login          → Login.tsx
/app/streams    → StreamDashboard.tsx (default)
/app/events     → EventsPage.tsx
/app/people     → PeoplePage.tsx
/app/insights   → InsightsPage.tsx
/app/timelapse  → TimelapsePage.tsx
/app/ask        → AskPage.tsx
/app/logs       → LogsPage.tsx
/app/settings   → Settings.tsx
```

### New (7 routes, 5 conceptual sections)

| Section | Route | Merges | Content |
|---------|-------|--------|---------|
| **Dashboard** | `/` | Streams + live event sidebar | Adaptive camera grid, real-time threat count, recent detections strip |
| **Events** | `/events` | — | Full timeline, filters, AI analysis, calendar heatmap, archive |
| **Security** | `/security` | People + Detection history | Face clusters, visitor timeline, detection log table |
| **Analytics** | `/analytics` | Insights + Timelapse | Daily stats, charts, timelapse viewer/generator |
| **Assistant** | `/ask` | — | AI chat with tool calling |
| **Settings** | `/settings` | Settings + Logs + Alerts | System config, detection zones, notification prefs, alert rules, system logs |
| **Login** | `/login` | — | Auth + MFA |

### Navigation

**Bottom dock (5 + gear):**
```
[Dashboard] [Events] [Security] [Analytics] [Assistant]  ···  [⚙ Settings]
```

- Settings accessible via gear icon (not a primary nav item)
- Active indicator: subtle accent underline, not background fill
- Left section: system status (ONLINE/OFFLINE pill)
- Right section: clock (mono font, tabular-nums)
- Logout:移到 user avatar dropdown (top-right on desktop, dock overflow on mobile)

## 4. Visual Design System

### Color Palette

**Dark theme (primary, only ships dark):**

```
Surfaces:
  bg-0: #050505   (page canvas)
  bg-1: #0A0A0B   (cards)
  bg-2: #121215   (raised cards / hover)
  bg-3: #1A1A1D   (inputs / popovers)

Borders:
  border-subtle:   rgba(255,255,255,0.06)
  border-default:  rgba(255,255,255,0.10)
  border-hover:    rgba(255,255,255,0.16)
  border-focus:    rgba(255,255,255,0.20)

Text:
  fg-1: #ECECEC   (primary text)
  fg-2: #A1A1A8   (secondary text)
  fg-3: #6B6B73   (muted text)
  fg-4: #4A4A52   (subtle text, labels)

Accent:
  accent:       #5E6AD2  (primary action — Linear blue)
  accent-hover: #6E7AE0
  accent-glow:  rgba(94,106,210,0.18)

Status:
  success: #34D399  (verified / online)
  warning: #FBBF24  (caution)
  danger:  #F87171  (alert / threat)
  info:    #60A5FA  (informational)
```

### Typography

Font stack: Geist (UI) + Geist Mono (data), loaded via `next/font`.

```
Display: 48/52, -0.04em, semibold    (empty states, auth)
H1:      32/36, -0.03em, semibold    (page titles)
H2:      24/28, -0.025em, semibold   (section headers)
H3:      18/22, -0.02em, medium      (card titles)
Body:    14/20, 0, normal            (default text)
Small:   13/18, 0, normal            (secondary text)
Micro:   11/14, 0.04em, uppercase    (labels, badges)
Mono:    13/18, tabular-nums         (timestamps, IDs, data values)
```

### Spacing

- Base unit: 4px
- Card padding: `p-5` (20px) or `p-6` (24px)
- Section gap: `gap-8` (32px)
- Between card groups: `gap-6` (24px)

### Radii

- Controls (buttons, inputs): `4px`
- Cards: `8px`
- Popovers, dropdowns: `12px`
- Modals, dialogs: `16px`
- Pills (badges, status): `9999px`

### Shadows

Subtle, layered — no glow effects:
```
sm:  0 1px 2px rgba(0,0,0,0.5)
md:  0 4px 12px rgba(0,0,0,0.4)
lg:  0 8px 24px rgba(0,0,0,0.4)
```

Accent glow reserved for primary CTAs only (one per screen max):
```
accent-glow: 0 0 0 1px rgba(94,106,210,0.2), 0 0 20px rgba(94,106,210,0.1)
```

### Key Visual Principles

1. **Solid surfaces only** — no glassmorphism, no backdrop-blur on cards
2. **Hairline borders** — `border-subtle` for separation, `border-default` for interactive
3. **Mono font for data only** — timestamps, IDs, coordinates; chrome uses Geist
4. **No heavy shadows** — depth via border + background contrast, not blur
5. **Iconography:** Lucide at 16px (chrome) or 20px (controls), 1.5 stroke
6. **Noise overlay:** removed — clean surfaces
7. **Radial glow backgrounds:** removed — solid bg-0 only

## 5. Motion System

Framer Motion replaces CSS animations + IntersectionObserver.

### Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page enter | `opacity 0→1`, `y 8→0` | 250ms | spring (stiffness: 300, damping: 30) |
| Route crossfade | `opacity` on `<main>` | 180ms | ease-out |
| Card hover | `scale 1→1.005`, bg brighten | 150ms | ease-out |
| Modal/dialog enter | `scale 0.96→1`, `opacity 0→1` | 200ms | spring |
| Modal exit | `opacity 1→0`, `scale 1→0.98` | 150ms | ease-in |
| Toast enter | `opacity 0→1`, `y -8→0` | 200ms | spring |
| Dock item active | `scale 1→1.05` on icon | 100ms | spring |

### Reduced Motion

Respect `prefers-reduced-motion: reduce` — all animations collapse to `duration: 0.01ms`. Already implemented in current CSS; carry forward to Framer Motion via `useReducedMotion()`.

### ScrollReveal Replacement

Replace IntersectionObserver-based ScrollRevealProvider with Framer Motion's `whileInView` + `viewport` props. No custom provider needed.

## 6. State Management

### Zustand Stores (replace 3 Context providers)

**Store: `auth.ts`** — replaces `AuthContext`
```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  verifyMFA: (code: string) => Promise<void>;
  refreshToken: () => Promise<void>;
}
```
- Persisted to localStorage via `zustand/middleware/persist`
- `partialize`: only store `accessToken`, not full state

**Store: `camera.ts`** — replaces `CameraContext`
```typescript
interface CameraState {
  cameras: Camera[];
  selectedCamera: string | null;
  streamStatus: Record<string, 'connected' | 'disconnected' | 'loading'>;
  fetchCameras: () => Promise<void>;
  selectCamera: (id: string | null) => void;
}
```

**Store: `socket.ts`** — replaces `SocketContext`
```typescript
interface SocketState {
  connected: boolean;
  lastEvent: DetectionEvent | null;
  connect: () => void;
  disconnect: () => void;
}
```

**Store: `ui.ts`** — new, replaces scattered local state
```typescript
interface UIState {
  sidebarOpen: boolean;
  theme: 'dark';           // only dark ships initially
  toggleSidebar: () => void;
}
```

### Benefits
- No provider nesting (4 flat providers → 0)
- Selective subscriptions (`useAuthStore(s => s.user)` — only re-renders when user changes)
- Built-in persistence (auth tokens, UI prefs)
- DevTools support via `zustand/middleware/devtools`

## 7. Data Fetching

### TanStack Query (primary layer)

Every API call becomes a Query or Mutation hook:

```typescript
// hooks/useEvents.ts
export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventService.getEvents(filters),
    staleTime: 30_000,
  });
}

// hooks/useUpdateCamera.ts
export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CameraUpdate) => cameraService.update(data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}
```

### Real-time integration

Socket.io events merge into TanStack Query cache:
```typescript
// In SocketProvider effect:
socket.on('eventCreated', (event) => {
  queryClient.setQueryData(['events', latestFilters], (old) => [event, ...old]);
});
```

### Service layer

Keep existing `services/api/*.ts` files. Wrap them in Query hooks in `hooks/` directory. No changes to the HTTP layer (`baseClient.ts`).

## 8. Component Architecture

### Layout

```
Shell (new AppLayout)
├── Sidebar (desktop, collapsible) or MobileNav (bottom sheet)
├── BreadcrumbBar (contextual)
├── <main> with page content
└── Dock (bottom bar, responsive)
```

**Sidebar (desktop, ≥1024px):**
- Collapsed: 64px icon rail (hover expands labels)
- Expanded: 220px with section labels
- System status pill (top)
- User avatar + dropdown (bottom)

**Mobile (<1024px):**
- Bottom dock (5 items + gear, same as current but adapted)
- No sidebar
- Hamburger for secondary actions

**Responsive breakpoint:** `1024px` (lg in Tailwind)

### Page Patterns

Each page follows a consistent structure:

```tsx
// app/events/page.tsx
import { Suspense } from 'react';
import { EventsView } from '@/components/events/EventsView';
import { EventsSkeleton } from '@/components/events/EventsSkeleton';

export default function EventsPage() {
  return (
    <Shell>
      <Suspense fallback={<EventsSkeleton />}>
        <EventsView />
      </Suspense>
    </Shell>
  );
}
```

Server Components where possible (page shells, metadata). Client Components for interactive parts (camera grid, chat, filters).

### Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Shell` | `components/layout/Shell.tsx` | Page wrapper with sidebar/dock |
| `DataTable` | `components/ui/data-table.tsx` | Typed table with sorting, pagination |
| `EmptyState` | `components/ui/EmptyState.tsx` | Keep, restyle |
| `PageHeader` | `components/ui/PageHeader.tsx` | Keep, restyle |
| `StatCard` | `components/ui/StatCard.tsx` | Keep, restyle |
| `LoadingSkeleton` | `components/ui/LoadingSkeleton.tsx` | Keep, expand patterns |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | Keep as-is |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | Keep, adapt for Next.js middleware |

## 9. File Structure

```
frontend/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout: fonts, providers, Shell
│   │   ├── page.tsx                # Dashboard (redirect if unauthenticated)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── events/
│   │   │   └── page.tsx
│   │   ├── security/
│   │   │   └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   ├── ask/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   ├── not-found.tsx
│   │   └── api/                    # Route handlers (auth proxy, health)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Shell.tsx           # Main layout with sidebar + dock
│   │   │   ├── Sidebar.tsx         # Desktop collapsed/expanded nav
│   │   │   ├── MobileNav.tsx       # Mobile bottom sheet nav
│   │   │   └── Dock.tsx            # Bottom bar (responsive)
│   │   ├── dashboard/
│   │   │   ├── CameraGrid.tsx
│   │   │   ├── ThreatMatrix.tsx
│   │   │   └── RecentDetections.tsx
│   │   ├── events/
│   │   │   ├── EventsView.tsx
│   │   │   ├── EventTimeline.tsx
│   │   │   ├── EventDetailPanel.tsx
│   │   │   ├── SmartFilters.tsx
│   │   │   └── RelatedEvents.tsx
│   │   ├── security/
│   │   │   ├── SecurityView.tsx
│   │   │   ├── FaceClusters.tsx
│   │   │   ├── VisitorTimeline.tsx
│   │   │   └── DetectionLog.tsx
│   │   ├── analytics/
│   │   │   ├── AnalyticsView.tsx
│   │   │   ├── Charts.tsx
│   │   │   └── TimelapseViewer.tsx
│   │   ├── ask/
│   │   │   ├── AskView.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── ChatInput.tsx
│   │   ├── settings/
│   │   │   ├── SettingsView.tsx
│   │   │   ├── DetectionSettings.tsx
│   │   │   ├── NotificationSettings.tsx
│   │   │   ├── AlertRules.tsx
│   │   │   └── SystemLogs.tsx
│   │   └── ui/                     # shadcn/ui (keep existing + add)
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── camera.ts
│   │   ├── socket.ts
│   │   └── ui.ts
│   ├── hooks/
│   │   ├── useCameraStream.ts
│   │   ├── useViewportStream.ts
│   │   ├── use-toast.ts
│   │   ├── useEvents.ts
│   │   ├── useCameras.ts
│   │   ├── useInsights.ts
│   │   └── useUpdateCamera.ts
│   ├── lib/
│   │   ├── api.ts                  # TanStack Query config + typed fetchers
│   │   ├── socket.ts               # Socket.io singleton
│   │   └── utils.ts                # cn() and helpers
│   ├── services/
│   │   ├── baseClient.ts           # HTTP layer (keep, extend)
│   │   └── api/                    # Keep existing service modules
│   ├── types/
│   │   └── security.ts             # Keep, extend
│   └── styles/
│       ├── globals.css             # Design tokens + component styles
│       └── design-tokens.ts        # Keep, update for new palette
```

## 10. Migration Strategy

### Strangler Fig Pattern

Build the new frontend alongside the old. Swap one section at a time. No big-bang rewrite.

### Phase 1: Scaffold (Week 1)
- Initialize Next.js 14 app in `frontend-next/`
- Install: Zustand, Framer Motion, React Hook Form, Zod
- Configure Tailwind with new design tokens
- Port shadcn/ui components (keep existing, restyle)
- Set up Socket.io + auth integration
- Implement `Shell` layout (sidebar + dock)
- Login page (full auth flow)

### Phase 2: Core Pages (Week 2)
- Dashboard: camera grid + threat matrix + recent detections
- Events: timeline + filters + AI analysis
- Security: face clusters + visitor timeline + detection log

### Phase 3: Secondary Pages (Week 3)
- Analytics: charts + timelapse viewer
- Assistant: chat UI
- Settings: all forms + logs + alerts + notification config

### Phase 4: Polish & Cutover (Week 4)
- Responsive testing (mobile dock, sidebar collapse)
- Animation pass (page transitions, hover states, loading skeletons)
- Keyboard shortcuts port
- Error boundaries + loading states
- Build optimization + static export config
- Backend static serving swap
- Remove old `frontend/`

### Rollback Plan

Old frontend stays intact until Phase 4 cutover. If new frontend has critical issues, revert backend static serving to old build.

## 11. Constraints

- **Backend stays unchanged** — no API changes required for frontend revamp
- **Socket.io protocol stays** — same WebSocket events, same frame format
- **Auth flow stays** — JWT + MFA, same token refresh logic
- **Detection pipeline untouched** — Python OpenCV service is independent
- **Static file serving** — backend continues serving frontend as static files
- **Dark theme only initially** — light theme derivable later via CSS variables
- **No new external dependencies** beyond Zustand, Framer Motion, RHF, Zod (all well-established, tiny bundles)

## 12. Success Criteria

1. All 6 sections fully functional with feature parity to current 9 routes
2. Login + MFA flow works identically
3. Real-time camera streams with same latency
4. Detection events appear in real-time
5. AI chat functional
6. All settings forms work with proper validation
7. Responsive on mobile (≥375px) and desktop (≥1024px)
8. Lighthouse Performance ≥ 90
9. No increase in JS bundle size beyond 10%
10. Build time ≤ 60s for production
