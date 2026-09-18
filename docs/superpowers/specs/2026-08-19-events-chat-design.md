# Events Chat ("Ask") — Design

Date: 2026-08-19
Status: Proposed
Branch: feature/persistent-logging-and-event-quality

## Problem

User wants to interrogate persisted detection data in natural language: when a
scooter left the premises and returned, when an SUV came and went, how many
humans were seen at a given time of day, and a readable report covering a
period.

## Approach

**Intent library + LLM.** The LLM classifies the user's question into one of a
fixed set of query tools and fills typed parameters. The server validates
parameters (Zod), runs parameterized SQL against existing tables, and renders
the answer. The LLM never writes SQL.

LLM backend: existing NVIDIA OpenAI-compatible endpoint
(`NVIDIA_API_KEY`, `NVIDIA_API_BASE_URL`, `NVIDIA_MODEL` env vars — same wiring
as `services/nvidia/nvidiaClient.ts`), text-only, `temperature: 0`.

## Data model (existing, no migrations)

- `events` — one row per persisted tracking event (timestamp, camera_id,
  event_type, confidence, object_detections JSONB, scene_context,
  threat_assessment, motion_stats).
- `event_detections` — one row per YOLO/tracker detection per event (class,
  confidence, bbox, track_id, track_state, tracklet_len, identity,
  human_verified, verification_tier, person_attributes).
- `human_verifications` — tiered human-verification metadata.
- Class vocabulary is stock COCO: `person, bicycle, car, motorcycle, bus,
  truck, ...`. No `scooter`/`SUV` classes — alias map below.

## Intents (MVP: 3 tools + fallback)

### 1. `vehicle_timeline`
Question pattern: "when did the scooter leave and come back", "did the SUV
return yesterday".

Params: `vehicle` (alias), `range` (resolved time window), `camera?`.

Alias map:

| User says | Class(es) queried |
| --- | --- |
| scooter / bike | `motorcycle` |
| suv / car | `car` |
| truck / lorry | `truck` |
| bus | `bus` |
| bicycle / cycle | `bicycle` |
| vehicle (generic) | car, truck, bus, motorcycle, bicycle |

SQL per (class, camera, track_id):

```sql
SELECT track_id,
       MIN(timestamp) AS first_seen,
       MAX(timestamp) AS last_seen,
       (array_agg(track_state ORDER BY timestamp) FILTER (WHERE track_state IS NOT NULL))[1] AS first_state,
       (array_agg(track_state ORDER BY timestamp DESC) FILTER (WHERE track_state IS NOT NULL))[1] AS last_state,
       count(*) AS obs
FROM event_detections
WHERE class IN (...)
  AND timestamp >= $from AND timestamp < $to
  AND confidence >= 0.4
  [AND camera_id = $cam]
GROUP BY track_id
ORDER BY first_seen
```

Rendering per track:
- `first_state = 'started'` → `arrived/returned` at `first_seen`.
- `last_state IN ('ended','lost')` → `left` at `last_seen`.
- Otherwise → `observing` / `last seen at` (track cut mid-view).

Confidence floor 0.4 matches pipeline thresholds and cuts mid-frame
misclassification drift. Older backfilled rows without track_state always
render as `observed`, never `left`.

### 2. `human_counts`
Question pattern: "how many humans were seen around 6-7pm", "people seen
yesterday".

Params: `range`, `hour?`, `granularity` (`hour` default), `camera?`.

SQL: group `class = 'person'` rows by hour of day (IST):

- `distinct (camera_id, track_id)` → unique humans
- `count(*)` → person detections
- verified humans: `count(*) FILTER (WHERE human_verified = true)`

Distinct by `(camera_id, track_id)` — track_ids are per-camera; naive
grouping would double-count across cameras.

### 3. `period_report`
Question pattern: "report on what happened this week", "summary for last 3
days".

Runs ~6 summary queries over the window:
1. total events, total detections
2. humans: distinct tracks, detections, % verified (`human_verified`)
3. vehicles by class: distinct tracks, arrivals (`started`), departures
   (`ended`/`lost`)
4. busy hours (top hours by detection count)
5. longest tracks (top 5 by tracklet_len / span)
6. alerts: threat_assessment level counts

Numbers are rendered by the server as tables/cards (authoritative). LLM
writes only secondary narrative prose from the numbers; post-check scans the
narrative for digit sequences absent from the stats payload and drops
offending sentences (fallback: numbers-only output).

### 4. `fallback`
Out-of-scope questions. LLM answers from a schema description with explicit
"no data for that" caveat, or states it can't answer.

## Accuracy guarantees

- **Numbers always server-rendered from SQL.** LLM is classification + prose
  only. Digit post-check on all prose.
- **Dates resolved server-side.** LLM emits semantic tokens
  (`today`, `yesterday`, `last_N_days`, `this_week`, ISO range) — never
  computed dates. Server resolves to IST boundaries
  (`TZ=Asia/Kolkata`, same as stack).
- **IST grouping everywhere** (`to_char(timestamp AT TIME ZONE
  'Asia/Kolkata', ...)`).
- **Honest labels**: `left` only for `ended`/`lost`; everything else
  `last seen`. Coverage caveat footer on every answer: "based on N
  detections / M events, cameras [...]". Absence of detections = observation
  gap, never proof of absence.
- **Single evidence block per turn** — one camera/time window stated
  explicitly; no silent mixing.

## API

`POST /api/chat/message` (auth `requireUser`, rate-limited)

```json
{
  "message": "when did the scooter leave today?",
  "history": [{ "role": "user" | "assistant", "content": "..." }]  // last ~10
}
```

Response:

```json
{
  "tool": "vehicle_timeline",
  "params": { "vehicle": "scooter", "range": { "from": "...", "to": "..." }, "camera": null },
  "answer": { "type": "markdown", "content": "..." },
  "tables": [{ "headers": [...], "rows": [...] }],
  "evidence": { "detections": 42, "events": 18, "cameras": ["front"] },
  "caveat": "based on 42 detections / 18 events, cameras: front. No detections = gap, not absence."
}
```

`tables` and `evidence` are server-rendered; `answer` may embed them.

## Server structure

```
server/src/
├── routes/chat.ts                    # POST /api/chat/message
├── controllers/ChatController.ts     # thin: auth, body parse, delegate
├── services/chat/
│   ├── chatService.ts                # orchestrator: classify → validate → query → render
│   ├── chatLlm.ts                    # text-only NVIDIA call (reuse env, temperature 0, JSON mode)
│   ├── queryTools.ts                 # intent defs + zod schemas + SQL builders
│   ├── dateResolver.ts               # semantic date tokens → IST boundaries (deterministic)
│   └── reportGenerator.ts            # period queries + markdown renderer
├── types/chat.ts
└── routes/index.ts                   # mount /api/chat
```

Safety: whitelisted intents; zod param validation (alias map, camera
whitelist, max 90-day span); parameterized queries; row caps; existing rate
limiter; circuit breaker reuse from `services/circuitBreaker.ts`; JSON
parse retry (1) then fallback.

## Frontend

- `frontend/src/pages/AskPage.tsx` — chat window at `/app/ask`: message
  list, suggested-query chips, markdown + table rendering, "Download .md"
  button (client-side blob) for reports.
- `frontend/src/services/api/chatService.ts` — `sendMessage(message, history)`.
- `MacDock.tsx` — new item `{ href: '/app/ask', label: 'Ask', icon: MessageSquare }`.
- `App.tsx` — route `/app/ask` under `ProtectedRoute`.

Visual language: existing glass/bezels/design tokens; dock icon consistent.

## Testing

- Jest (server): alias map, zod param validation, dateResolver tokens →
  IST boundaries, LEAVE/RETURN grouping on synthetic rows, report renderer
  output, digit post-check rejection.
- Gates: `npm run lint`, `npm run typecheck`, `npm run build:server`.
- Manual smoke: real question against live NVIDIA key, verify evidence
  numbers against a raw psql query of the same window.

## Out of scope (YAGNI)

- Raw-SQL mode (approach B), email digests, conversation persistence,
  per-instance vehicle identity (color matching), multi-camera vehicle
  continuity.