---
status: resolved
trigger: "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object. Check the render method of `PageHeader`."
created: 2026-05-19
updated: 2026-05-19
---

## Symptoms

**Expected behavior**: Page at /app/gallery should render normally with PageHeader component showing title, subtitle, and action buttons without errors.

**Actual behavior**: React throws "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object" error when loading any page using PageHeader component.

**Error messages**: "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object. Check the render method of `PageHeader`."

**Timeline**: Started after a recent change. Triggered on page load at http://192.168.31.99:5173/app/gallery.

**Reproduction**: Navigate to /app/gallery (or any page using PageHeader) - error appears immediately on page load.

## Code Context

**Component file**: `frontend/src/components/ui/PageHeader.tsx`
- Named export: `export { PageHeader }`
- Uses `React.forwardRef` with `LucideIcon` type for `icon` prop
- Renders icon via: `{Icon && (<Icon className="..." />)}`
- Line 19: `const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(...)`
- Line 91: `export { PageHeader }`

**Usage in Gallery.tsx**: `import { PageHeader } from '@/components/ui/PageHeader'`
- Named import matches named export - appears correct

**Pages using PageHeader**:
- Gallery.tsx (line 15, line 105)
- UnknownFaces.tsx (line 12, line 122)
- DayHighlights.tsx (line 12, line 287, line 314)

## Current Focus

- hypothesis: CONFIRMED — `icon` prop receives a JSX element (object) instead of a LucideIcon component function
- next_action: fix applied

## Evidence

- Gallery.tsx line 108: `icon={<Grid className="w-6 h-6 text-blue-500" />}` — passes JSX element instead of component ref
- UnknownFaces.tsx line 125: `icon={<ShieldAlert className="w-6 h-6 text-amber-500" />}` — same pattern
- DayHighlights.tsx lines 290, 317: `icon={Calendar}` — CORRECT (component ref)
- EmptyState also affected: Gallery.tsx line 179, UnknownFaces.tsx line 189 — same JSX-element-as-icon bug
- PageHeader.tsx line 59: `<Icon className="..." />` tries to render a JSX element as a component → "got: object"

## Eliminated

- Import mismatch (named vs default) — confirmed correct
- lucide-react version change — not the issue
- forwardRef misuse — not the issue

## Resolution

**root_cause**: The `icon` prop in PageHeader (and EmptyState) is typed as `LucideIcon` (a React component function), but Gallery.tsx and UnknownFaces.tsx passed pre-rendered JSX elements (`<Grid ... />` which evaluates to a React element object) instead of component references (`Grid`). When PageHeader tries to render `<Icon />`, React receives an object instead of a function.

**fix**: Changed `icon={<Component className="..." />}` to `icon={Component}` in 4 locations:
1. `Gallery.tsx` line 108: PageHeader icon prop → `icon={Grid}`
2. `Gallery.tsx` line 179: EmptyState icon prop → `icon={Maximize2}`
3. `UnknownFaces.tsx` line 125: PageHeader icon prop → `icon={ShieldAlert}`
4. `UnknownFaces.tsx` line 189: EmptyState icon prop → `icon={Users}`
