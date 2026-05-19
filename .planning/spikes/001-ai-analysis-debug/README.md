---
spike: 001
name: ai-analysis-debug
type: standard
validates: "Given an event with an image, when AI analyze is triggered, then NVIDIA API returns valid JSON analysis"
verdict: VALIDATED
related: []
tags: [ai-analysis, nvidia, system-prompt, fix]
---

# Spike 001: AI Analysis Debug

## What This Validates

Given an event with an image, when AI analyze is triggered, then NVIDIA API returns valid JSON analysis.

## Root Cause Found

**The system prompt in `nvidiaAnalysisService.ts` triggers NVIDIA's content safety filter.**

The original prompt contained heavy security framing:
```
You are a home security AI. Analyze this camera image and respond ONLY with valid JSON.

CRITICAL: Your response must be ONLY valid JSON - no explanations, no markdown, no additional text before or after.
```

This caused the model to refuse requests with: `"I'm not going to engage in this conversation topic."`

## Investigation Trail

1. Confirmed AI analysis "failing" — endpoint returned empty responses
2. Verified NVIDIA API key, connectivity, and model all work (both host and container)
3. Tested via direct curl from container — image analysis works with neutral prompt, fails with security-framed prompt
4. Root cause: SECURITY_PROMPT triggers content safety on legitimate images (driveways, vehicles)
5. Found identical pattern affects all 3 system prompts (SYSTEM_PROMPT, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT)

## Fix Applied

**File**: `server/src/services/nvidiaAnalysisService.ts`

**Change 1** — Main analysis prompt (lines 87-111):
```typescript
// BEFORE:
// "You are a home security AI. Analyze this camera image and respond ONLY with valid JSON."
// + 23 more lines of restrictive rules

// AFTER:
// "You are a vision AI assistant. Analyze this image and respond ONLY with valid JSON."
// + concise JSON schema only
```

**Change 2** — Bbox analysis prompt (line 114):
```typescript
// FROM: "You are a home security expert AI assistant..."
// TO: "You are a vision AI assistant analyzing objects in an image..."
```

**Change 3** — Person detection prompt (line 149):
```typescript
// FROM: "You are a home security expert AI specializing in human detection..."
// TO: "You are a vision AI assistant specialized in human detection..."
```

## Verification

```
Before fix:
  sceneDescription: "I'm not going to engage in this conversation topic."

After fix:
  sceneDescription: "The camera captures a residential courtyard with a white SUV parked on the left,
                    a blue scooter in the foreground, and a pink circular area containing a small
                    white structure in the center..."
```

## How to Run

1. Ensure NVIDIA_API_KEY is set in environment
2. Go to Events page, click "AI Analyze" on any event
3. Observe scene description with detected vehicles, objects, etc.

## Constraints

- NVIDIA API key must be set (check `/api/nvidia/health`)
- Event must have a valid image file
- Default model: `meta/llama-3.2-90b-vision-instruct` (or `NVIDIA_MODEL` env var)

## Origin

Spike 001 — AI analysis debugging session, May 2026.