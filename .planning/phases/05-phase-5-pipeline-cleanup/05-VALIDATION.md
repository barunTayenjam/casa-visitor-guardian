---
phase: 05
slug: pipeline-cleanup
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | server/jest.config.js |
| **Quick run command** | `cd server && node --experimental-vm-modules node_modules/.bin/jest --no-coverage` |
| **Full suite command** | `cd server && node --experimental-vm-modules node_modules/.bin/jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --experimental-vm-modules node_modules/.bin/jest src/config/no-legacy-imports.test.ts --no-coverage`
- **After every plan wave:** Run `node --experimental-vm-modules node_modules/.bin/jest src/config/index.test.ts --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-pipeline-default | 01 | 1 | CLN-01 | — | N/A | unit | `node --experimental-vm-modules node_modules/.bin/jest src/config/index.test.ts --no-coverage -t "python-only"` | ✅ | ✅ green |
| 05-01-polling-removal | 01 | 1 | CLN-04 | — | N/A | unit | `node --experimental-vm-modules node_modules/.bin/jest src/config/no-legacy-imports.test.ts --no-coverage -t "poll"` | ✅ | ✅ green |
| 05-02-module-removal | 02 | 1 | CLN-02 | — | N/A | unit | `node --experimental-vm-modules node_modules/.bin/jest src/config/no-legacy-imports.test.ts --no-coverage -t "legacy\|import\|delete"` | ✅ | ✅ green |
| 05-03-rtsp-simplify | 03 | 2 | CLN-03 | — | N/A | unit | `node --experimental-vm-modules node_modules/.bin/jest src/streams/rtspManager.test.ts --no-coverage` | ✅ | ✅ green |
| 05-03-adr-accept | 03 | 2 | CLN-05 | — | N/A | manual | — | — | ✅ manual |

---

## Wave 0 Requirements

- [ ] `server/src/config/index.test.ts` — added pipeline mode default test (CLN-01)
- [ ] `server/src/config/no-legacy-imports.test.ts` — new: deleted module import + polling verification (CLN-02, CLN-04)
- [ ] `server/src/streams/rtspManager.test.ts` — new: simplified rtspManager structural tests (CLN-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ADR-003 status changed to Accepted | CLN-05 | Documentation change — no automated test possible | Verify `docs/architecture/ADR-003-detection-pipeline-redesign.md` Status header reads "Accepted" |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Validation Audit 2026-05-29

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 3 automated, 1 manual |
| Escalated | 0 |
