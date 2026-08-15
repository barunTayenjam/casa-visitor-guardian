# Structure

> Generated: 2026-08-15 | Focus: Arch | Scope: full repo

## Root Directory

- `.planning/`: GSD workflow artifacts and knowledge graph
- `database/`: SQL migrations
- `frontend/`: React SPA source
- `server/`: Express API source
- `opencv-service/`: Python detection pipeline source
- `data/`: Detections, events, snapshots (runtime)

## `frontend/src/`

- `pages/`: Views (App, EventsPage, StreamDashboard, etc.)
- `components/`: Modular UI (shadcn/ui, camera grids, timeline)
- `services/api/`: REST clients
- `contexts/`: React app state (Auth, Camera, Socket)
- `hooks/`: Reusable logic

## `server/src/`

- `controllers/`: MVC logic controllers
- `routes/`: Route definitions
- `services/`: Business logic, detection handlers, external clients
- `models/`: TypeORM entity definitions (`server/src/models/index.ts` re-exports)
- `middleware/`: Auth, validation, rate limiting
- `pipeline/`: Core event persistence
- `streams/`: go2rtc/RTSP orchestration

## `opencv-service/`

- `app.py`: Flask entry point
- `pipeline.py`: Main detection pipeline loop
- `rtsp_ingestion/`: FFmpeg, WebSocket publishing, frame processing
- `models/`: ML model binary weights
- `known_faces/`: Face embedding library storage
