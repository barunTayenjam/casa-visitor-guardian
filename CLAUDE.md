# SentryVision — Home Security System

**Endpoint**: `http://192.168.31.99:20128/v1`

## Available Models

| Model | Best For |
|-------|----------|
| `gc/gemini-3-flash-preview` | **Default**. Fast, reasoning tokens |
| `gc/gemini-3-pro-preview` | Complex reasoning |
| `gc/gemini-3.1-flash-lite` | Lightweight tasks |
| `oc/sonet-4` | Alternative model |
| `ollama/gpt-oss:120b` | Thorough all-rounder |
| `ollama/minimax-m3` | Quick fallback |
| `ollama/nemotron-3-ultra` | Heavy lifting |
| `ollama/qwen3-coder-next` | Coding tasks |

## Commands

```bash
npm run dev:full       # Frontend + backend
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Jest
```

Run `npm run lint && npm run typecheck` after frontend changes. Full project reference in `AGENTS.md`.
