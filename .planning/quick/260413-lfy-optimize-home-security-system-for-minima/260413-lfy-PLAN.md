---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
  - server/src/config/detectionConfig.ts
autonomous: true
requirements:
  - OPT-01
must_haves:
  truths:
    - System uses reduced CPU resources when LOW_RESOURCE_MODE is enabled
    - Detection runs less frequently to reduce processing load
    - All services have reduced memory limits
  artifacts:
    - path: docker-compose.yml
      provides: Container resource limits
    - path: server/src/config/detectionConfig.ts
      provides: Detection behavior settings
  key_links:
    - from: docker-compose.yml (backend service)
      to: LOW_RESOURCE_MODE env var
      via: environment variable
---

<objective>
Optimize home security system for minimal resource usage on server

Purpose: Reduce CPU and memory footprint for low-resource environments (1 core, 2GB RAM)
Output: Updated docker-compose.yml and detectionConfig.ts with minimal resource settings
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
Current docker-compose.yml resource limits:
- PostgreSQL: 0.25 CPU, 384MB (already minimal)
- Backend: 1.0 CPU, 1024MB
- Redis: 0.1 CPU, 64MB (already minimal)
- OpenCV: 0.5 CPU, 512MB

Current detectionConfig.ts defaults:
- sensitivity: 90 (high)
- detectionInterval: 3000ms
- cooldownPeriod: 10000ms
- maxEventsPerHour: 100
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enable LOW_RESOURCE_MODE in docker-compose.yml</name>
  <files>docker-compose.yml</files>
  <action>
Change LOW_RESOURCE_MODE from "false" to "true" in backend service environment variables. This enables optimized code paths throughout the application.

Also reduce these container resource limits:
- Backend: 1.0 CPU → 0.5 CPU, 1024MB → 512MB
- OpenCV: 0.5 CPU → 0.25 CPU, 512MB → 256MB
</action>
  <verify>
grep "LOW_RESOURCE_MODE" docker-compose.yml | grep -v "#" returns "true"
</verify>
  <done>
LOW_RESOURCE_MODE environment variable set to true, container CPU/memory limits reduced by 50%
</done>
</task>

<task type="auto">
  <name>Task 2: Optimize detection parameters for minimal resources</name>
  <files>server/src/config/detectionConfig.ts</files>
  <action>
Create LOW_RESOURCE_MODE config that overrides defaults when environment variable is set. Modify loadDetectionConfig() to:

1. Reduce sensitivity from 90 → 75 (still effective for motion detection but fewer false positives to process)
2. Increase detectionInterval from 3000ms → 5000ms (less frequent = less CPU)
3. Increase cooldownPeriod from 10000ms → 15000ms (fewer events generated)
4. Reduce maxEventsPerHour from 100 → 50

Set these as new defaults or conditional checks for LOW_RESOURCE_MODE.
</action>
  <verify>
npm run typecheck --prefix server 2>&1 | head -20
</verify>
  <done>
Detection runs every 5s instead of 3s, cooldown 15s instead of 10s, sensitivity reduced to 75
</done>
</task>

<task type="auto">
  <name>Task 3: Verify no breaking changes to detection capability</name>
  <files>server/src/detection/optimizedMotionDetection.ts</files>
  <action>
Verify the detection code handles reduced sensitivity gracefully without breaking. Quick check:
- sensitivity 75 is still above minimum threshold to detect motion
- increased intervals still meet the 3-second minimum in detection code
- cooldown changes only affect event frequency, not detection logic
</action>
  <verify>
grep -n "sensitivity\|detectionInterval\|cooldownPeriod" server/src/detection/optimizedMotionDetection.ts | head -20
</verify>
  <done>
Detection code accepts all new values, no breaking changes
</done>
</task>

</tasks>

<verification>
After implementation:
1. Verify LOW_RESOURCE_MODE=true in docker-compose.yml
2. Verify detection config returns optimized values
3. Run: docker-compose up -d && docker stats to see reduced usage
</verification>

<success_criteria>
- LOW_RESOURCE_MODE enabled in docker-compose.yml
- Container CPU limits reduced by 50% across services
- Detection interval increased to 5 seconds (reduces CPU load by ~40%)
- Sensitivity reduced to 75 (maintains detection capability while reducing false positives)
- System remains functional with 2 cameras and motion detection
</success_criteria>

<output>
After completion, create .planning/quick/260413-lfy-optimize-home-security-system-for-minima/260413-lfy-SUMMARY.md
</output>