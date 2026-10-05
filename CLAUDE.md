# SentryVision — Home Security System

**Endpoint**: `http://192.168.31.99:20128/v1`

## Available Models

Vision-capable models that AI analysis (`NVIDIA_MODEL`) can use. Model IDs are
volatile — a model that resolves today can 404 or time out tomorrow, so
`VISION_FALLBACK_MODELS` in `server/src/services/nvidia/nvidiaClient.ts` spans
multiple provider prefixes (`ag/`, `ollama-local/`) and advances the chain on any
retryable failure (5xx / 429 / timeout).

| Model                        | Best For                                   |
| ---------------------------- | ------------------------------------------ |
| `ag/gemini-3.8-flash`        | **Vision default**. Fast, full scene + bbox |
| `ag/gemini-3.8-flash-medium` | Vision, deeper reasoning                   |
| `ollama-local/qwen3-vl:2b`   | Fully local, no egress; returns prose, not JSON — last resort only |
| `ag/gemini-3.8-flash-low`    | Cheapest vision                            |

Chat/completion and other non-vision work can use any model the router serves;
check `GET /v1/models` for the live list.

## Commands

```bash
npm run dev:full       # Frontend + backend
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Jest
```

Run `npm run lint && npm run typecheck` after frontend changes. Full project reference in `AGENTS.md`.
