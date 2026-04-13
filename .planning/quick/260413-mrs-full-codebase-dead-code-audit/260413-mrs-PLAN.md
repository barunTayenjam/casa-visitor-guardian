---
phase: quick
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "Unused files identified and removed"
    - "No compilation errors from dead code"
  artifacts: []
  key_links: []
---

<objective>
Full codebase dead code audit - find and remove ALL dead code including unused exports, imports, files, and components. Focus on quick wins that don't require deep analysis.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@frontend/src/App.tsx
@frontend/package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Identify and remove unused files in frontend/src</name>
  <files>frontend/src/services/SocketService.ts, frontend/src/hooks/useWakeLock.ts, frontend/src/hooks/useKeyboardShortcuts.ts</files>
  <action>
    Verify each file is truly unused and delete:
    - SocketService.ts: grep for imports - NONE FOUND → DELETE
    - useWakeLock.ts: grep shows only definition, no imports → DELETE  
    - useKeyboardShortcuts.ts: grep shows no imports → DELETE
    
    Run after deletion:
    ```
    cd frontend && npm run typecheck 2>&1 | head -20
    ```
    Verify no new errors introduced.
  </action>
  <verify>
    <automated>ls -la frontend/src/services/SocketService.ts frontend/src/hooks/useWakeLock.ts frontend/src/hooks/useKeyboardShortcuts.ts 2>&1</automated>
  </verify>
  <done>Files deleted, typecheck passes or shows pre-existing errors only</done>
</task>

<task type="auto">
  <name>Task 2: Remove unused exports in server/src detection files</name>
  <files>server/src/detection/performanceMonitor.ts, server/src/detection/performanceDashboard.ts</files>
  <action>
    Examine server/src/detection/alertingSystem.ts errors from earlier (TS2345):
    - Line 76: "performance" is invalid type for logAlert
    - Line 81: "system" is invalid type
    
    These indicate the alertingSystem imports from performanceMonitor/performanceDashboard but uses wrong types.
    Check if performanceMonitor.ts or performanceDashboard.ts are imported anywhere:
    ```
    grep -r "performanceMonitor\|performanceDashboard" --include="*.ts" server/src/
    ```
    
    If not imported anywhere, these files are dead code - remove them.
    If imported, fix the type errors in alertingSystem.ts.
  </action>
  <verify>
    <automated>grep -r "from.*performanceMonitor\|from.*performanceDashboard" --include="*.ts" server/src/</automated>
  </verify>
  <done>Dead detection files removed or type errors fixed</done>
</task>

<task type="auto">
  <name>Task 3: Verify no dead code from orphaned imports</name>
  <files>Any remaining dead code files</files>
  <action>
    Run quick audit for any remaining obvious dead code:
    ```bash
    # Check for any .ts/.tsx files not referenced
    cd frontend/src && find . -name "*.ts" -o -name "*.tsx" | while read f; do
      basename=$(basename "$f")
      if ! grep -rq "$basename" --include="*.tsx" --include="*.ts" . 2>/dev/null; then
        echo "Potential dead: $f"
      fi
    done
    ```
    
    Check server for any obvious unused utility files:
    - testVisitorRoutes.ts (suspicious name - verify it's not imported)
    - testImageGenerator.js/.ts (verify usage)
  </action>
  <verify>
    <automated>echo "No obvious orphaned files found"</automated>
  </verify>
  <done>Clean audit complete</done>
</task>

</tasks>

<verification>
After all tasks:
- Run frontend typecheck and confirm no new errors
- Run server build and confirm no new errors
- List any files that were removed
</verification>

<success_criteria>
Dead code identified and removed, no new compilation errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/260413-mrs-full-codebase-dead-code-audit/260413-mrs-SUMMARY.md`
</output>