# ADR-003: Backend Route Consistency (MVC Enforcement)

**Date:** 2026-09-24  
**Status:** Proposed  
**Deciders:** SentryVision team

## Context

The backend uses Express 5 with an MVC pattern, but adherence is inconsistent across the 20 route modules in `server/src/routes/`:

- **13 route files** properly delegate to controllers (e.g., `cameras.ts` → `cameraController.listAll`, `auth.ts` → `authController.login`).
- **7 route files** define inline request handlers directly inside the route file, mixing routing, validation, business logic, and raw database queries:
  - `motion.ts` (4 endpoints) — frame extraction, consolidated detection, Socket.io event emission inline
  - `highlights.ts` (2 endpoints) — raw SQL queries with `AppDataSource.query()` inline
  - `face-clusters.ts` (3 endpoints) — raw SQL queries inline
  - `detection-operations.ts` (8 endpoints) — stream management, frame extraction, detection stubs inline
  - `detectionRedoRoutes.ts` (2 endpoints) — file system access, raw SQL updates inline
  - `timelapse.ts` (3 endpoints) — file serving, validation, service calls inline
  - `notificationRoutes.ts` (10 endpoints) — Web Push subscriptions inline
  - `staticRoutes.ts` (11 endpoints) — file path validation, image/video serving, health checks inline

This inconsistency causes:
1. Untestable business logic (handlers cannot be unit tested without an Express app instance).
2. Code duplication (e.g., camera ID validation, frame extraction patterns).
3. Raw SQL leaking into the HTTP routing layer instead of residing in services or repositories.

## Decision

**Enforce a strict MVC boundary across all route files.** Every route file must only wire endpoints to controller methods and apply route-level middleware. No business logic or database queries in route files.

### New Controllers to Create

| Controller | Source File | Responsibilities |
|------------|-------------|------------------|
| `MotionController` | `motion.ts` | List motion events, simulate motion, analyze current frame |
| `HighlightsController` | `highlights.ts` | Retrieve daily highlights and summary |
| `FaceClusterController` | `face-clusters.ts` | List face clusters, serve cluster images, assign cluster names |
| `DetectionOperationsController` | `detection-operations.ts` | Trigger detections, get/set person/face/motion settings |
| `DetectionRedoController` | `detectionRedoRoutes.ts` | Re-run detection on files and stored events |
| `TimelapseController` | `timelapse.ts` | List timelapses, serve MP4s, generate from detection snapshots |
| `NotificationController` | `notificationRoutes.ts` | Web Push subscribe/unsubscribe, preferences, test notifications |

### Service Layer Extraction

Move raw SQL queries and business logic out of route files into dedicated service methods:
- `HighlightsService`: encapsulate date-range queries, hourly aggregation, and highlights summary SQL.
- `FaceClusterService`: encapsulate face clustering queries, cluster image resolution, and cluster rename SQL.
- `StaticFileService`: consolidate file path validation, resolution, and serving logic currently duplicated across `staticRoutes.ts`.

### Controller Standard

All controllers must extend `BaseController` and use standard response helpers (`this.ok`, `this.created`, `this.badRequest`, `this.notFound`, `this.serverError`).

```typescript
// Standard pattern for all controllers
export class MotionController extends BaseController {
  async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const events = await eventSearchService.getMotionEvents(limit);
      this.ok(res, { events });
    } catch (error) {
      this.serverError(res, error, 'MotionController.listEvents');
    }
  }
}
```

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Strict MVC with BaseController** (chosen) | Consistent, testable, clean separation of concerns | Creates ~5 new controller files |
| Keep inline handlers, add comments | Zero refactor effort | Tech debt accumulates; testing remains difficult |
| Fastify/NestJS migration | Built-in dependency injection, strict architecture | Massive rewrite, unnecessary churn for working app |

## Consequences

**Positive:**
- Every route file follows the same predictable pattern (under 30 lines).
- Business logic isolated in controllers and services, enabling unit testing.
- Raw SQL queries encapsulated in the service layer with TypeORM repositories.
- Error handling standardized via `BaseController`.

**Negative:**
- ~7 new controller files to create and maintain.
- Short-term risk of regression during handler extraction (mitigated by running server tests).
