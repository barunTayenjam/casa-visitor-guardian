# ADR-002: Frontend Service Decomposition

**Date:** 2026-09-24  
**Status:** Proposed  
**Deciders:** SentryVision team

## Context

Three frontend API services are oversized and mix multiple concerns:

| File | Lines | Methods | Concerns |
|------|-------|---------|----------|
| `detectionService.ts` | 434 | 15 | Triggers, settings, AI analysis, redo, motion |
| `settingsService.ts` | 264 | 9 | System settings, detection config, logs, alerts |
| `systemService.ts` | 328 | 9 | Health, stats, analytics, highlights, timelapse |

Each method's error handling is identical (try/catch → ApiError), creating 60% boilerplate. The "service" pattern is correct — it's the boundaries that need fixing.

## Decision

**Split each oversized service into focused modules.** Keep `baseClient.ts` helpers (`apiGet`, `apiPost`, `apiPut`, `apiDelete`) as the shared foundation.

### Detection Service Split

| New File | Methods | Lines |
|----------|---------|-------|
| `detectionTriggers.ts` | `triggerPersonDetection`, `triggerFaceDetection` | ~70 |
| `detectionSettings.ts` | `getPersonDetectionSettings`, `updatePersonDetectionSettings`, `getFacialRecognitionSettings`, `updateFacialRecognitionSettings`, `getMotionSettings`, `updateMotionSettings` | ~200 |
| `detectionAi.ts` | `analyzeEvent`, `analyzeEventWithBboxes`, `getEventAnalysis`, `analyzeMotionWithDetection` | ~180 |
| `detectionRedo.ts` | `redoDetection`, `batchDetect` | ~60 |

### Settings Service Split

| New File | Methods | Lines |
|----------|---------|-------|
| `systemSettings.ts` | `getSettings`, `updateSettings` | ~60 |
| `detectionConfig.ts` | `getDetectionConfig`, `updateDetectionConfig` | ~70 |
| `logService.ts` | `getSystemLogs`, `clearSystemLogs` | ~70 |
| `alertService.ts` | `getAlerts`, `acknowledgeAlert`, `deleteAlert` | ~80 |

### System Service Split

| New File | Methods | Lines |
|----------|---------|-------|
| `healthService.ts` | `getHealth`, `getStats`, `getSystemOverview` | ~80 |
| `highlightsService.ts` | `getDayHighlights`, `getDaySummary`, `getHourlyAnalytics`, `getStorageStats` | ~120 |
| `timelapseService.ts` | `getTimelapses`, `generateTimelapse` | ~100 |

## Migration Path

1. Create new service files with extracted methods
2. Update all page imports (`EventsPage`, `Settings`, `InsightsPage`, etc.)
3. Keep old files as re-exports for backward compatibility during transition
4. Delete old files once all imports updated
5. Run `npm run lint && npm run typecheck` after each service split

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Split into focused files** (chosen) | Clear boundaries, each file <200 lines | More files to manage |
| Keep single files, extract hooks | Less file churn | Doesn't address the real issue |
| Auto-generate services from OpenAPI | Canonical source | No OpenAPI spec exists for this project |

## Consequences

**Positive:**
- Each service file under 200 lines — readable in one screen
- Single-responsibility: changing detection settings doesn't require reading AI analysis code
- Easier to write focused tests per service

**Negative:**
- More import paths for developers to remember
- Migration effort: ~1 day for all three splits

**Risks:**
- None — services are stateless, no shared mutable state between them
