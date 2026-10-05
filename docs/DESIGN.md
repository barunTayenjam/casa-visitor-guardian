---
name: SentryVision
description: Self-hosted AI security monitoring — vigilant, quiet, always on duty
colors:
  canvas: "#050505"
  surface: "#0A0A0B"
  surface-raised: "#121215"
  surface-control: "#1A1A1D"
  primary: "#5E6AD2"
  primary-hover: "#6E7AE0"
  destructive: "#F87171"
  success: "#34D399"
  warning: "#FBBF24"
  info: "#60A5FA"
  text-primary: "#ECECEC"
  text-secondary: "#A1A1A8"
  text-muted: "#6B6B73"
  text-subtle: "#4A4A52"
  border-subtle: "rgba(255,255,255,0.06)"
  border-default: "rgba(255,255,255,0.10)"
  border-hover: "rgba(255,255,255,0.16)"
  border-focus: "rgba(255,255,210,0.20)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "48/52"
    fontWeight: 600
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32/36"
    fontWeight: 600
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24/28"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14/20"
    fontWeight: 400
    letterSpacing: "0"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11/14"
    fontWeight: 500
    letterSpacing: "0.04em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "13/18"
    fontWeight: 400
    fontFeature: "tabular-nums"
rounded:
  control: "4px"
  card: "8px"
  popover: "12px"
  dialog: "16px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "rgba(236,236,236,0.7)"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  input:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.text-primary}"
    rounded: "12px"
    padding: "8px 12px"
---

# Design System: SentryVision

## Overview

**Creative North Star: "The Night Watchman"**

SentryVision's visual system embodies vigilant calm. The dark canvas is night; the interface is the watch post — alert, composed, never loud. Every element earns its place through function, not decoration. The palette is almost entirely neutral — deep charcoals and muted grays — with a single accent color reserved exclusively for interactive states and system status. When the accent appears, it means something.

The aesthetic draws from Linear's instrument-grade precision: dense information hierarchy, hairline separation, monospace data, and controls that feel like machined hardware. Buttons scale on press. Cards sit in concentric bezels. The interface responds immediately and then gets out of the way. This is monitoring software — it should feel like operating equipment, not browsing a website.

**Key Characteristics:**
- OLED-black canvas with tonal surface layering (no shadows for depth, only border contrast)
- Single muted indigo accent used sparingly — rarity is the point
- Geist typeface family: geometric sans for chrome, monospace for data
- Pill-shaped controls with inset highlights and press-down scale (0.97)
- Hairline borders (`rgba(255,255,255,0.06)` to `0.16`) as the primary depth language
- Bottom dock navigation with animated sliding indicator
- Zero glassmorphism, zero backdrop-blur on cards — solid surfaces only

## Colors

The palette is almost entirely neutral, built on OLED-black surfaces with a single muted indigo accent. Status colors are desaturated to avoid competing with the accent.

### Primary
- **Quiet Indigo** (#5E6AD2): Interactive accent — buttons, active nav indicators, focus rings, links. Used on ≤15% of any screen surface. Its restraint is its authority.
- **Quiet Indigo Hover** (#6E7AE0): Brightened variant for hover states only.

### Neutral
- **OLED Black** (#050505): Page canvas. The night sky of the system.
- **Surface** (#0A0A0B): Card backgrounds, raised containers. One step above canvas.
- **Surface Raised** (#121215): Hover states on cards, popover backgrounds, input fields.
- **Surface Control** (#1A1A1D): Active input states, accent backgrounds at low opacity.
- **Text Primary** (#ECECEC): Headlines, body text, primary content.
- **Text Secondary** (#A1A1A8): Timestamps, descriptions, secondary labels.
- **Text Muted** (#6B6B73): Disabled states, placeholder text, tertiary labels.
- **Text Subtle** (#4A4A52): Micro-labels, badges at rest.

### Status
- **Success** (#34D399): Verified persons, online status, positive confirmations.
- **Warning** (#FBBF24): Caution states, confidence thresholds.
- **Danger** (#F87171): Threats, errors, destructive actions.
- **Info** (#60A5FA): Informational badges, informational states.

### Border Scale
- **Border Subtle** (rgba(255,255,255,0.06)): Section dividers, hairline separators.
- **Border Default** (rgba(255,255,255,0.10)): Card borders, input borders at rest.
- **Border Hover** (rgba(255,255,255,0.16)): Interactive hover borders, chip outlines.
- **Border Focus** (rgba(255,255,210,0.20)): Focus ring outlines on interactive elements.

### Named Rules
**The Restraint Rule.** The primary accent appears on ≤15% of any screen. When it appears, it means something: an active state, a primary action, or a status indicator. Never use it for decoration, backgrounds, or decorative gradients.

**The Tonal Surface Rule.** Depth is communicated through surface color steps, not shadows. Canvas (#050505) → Surface (#0A0A0B) → Raised (#121215) → Control (#1A1A1D). Never use drop shadows to separate content from background.

## Typography

**Display/Body Font:** Geist (with ui-sans-serif, system-ui, sans-serif fallback)
**Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, monospace fallback)

**Character:** Geist is a geometric sans-serif designed for interfaces — crisp at small sizes, confident at display scale. Paired with Geist Mono for data-heavy contexts (timestamps, IDs, confidence scores). The two share the same design DNA, creating a seamless hierarchy between chrome and data.

### Hierarchy
- **Display** (600, 48/52, -0.04em): Empty states, auth hero, splash text. Rarely used.
- **Headline** (600, 32/36, -0.03em): Page titles. One per page maximum.
- **Title** (600, 24/28, -0.025em): Section headers within pages.
- **Body** (400, 14/20, 0): Default text. Max comfortable line length ~65ch.
- **Small** (400, 13/18, 0): Secondary descriptions, help text.
- **Label** (500, 11/14, 0.04em uppercase): Micro-labels, badges, navigation labels. Always uppercase with positive tracking.
- **Mono** (400, 13/18, tabular-nums): Timestamps, IDs, confidence percentages, system data. Tabular figures always enabled.

### Named Rules
**The Data Font Rule.** All temporal data (timestamps, durations, IDs, percentages) uses Geist Mono with `font-variant-numeric: tabular-nums`. No exceptions. Monospace is never used for UI chrome.

**The Tracking Rule.** Large text gets tighter tracking (-0.02em to -0.04em). Small uppercase labels get wider tracking (0.04em). Body text has zero tracking.

## Layout

Bottom-dock navigation on all viewports. The dock is a fixed 56px bar at the screen bottom with five primary nav items and a settings gear icon. A system status pill sits top-left; a mono clock sits top-right.

Content fills a responsive container (`max-w-7xl` = 80rem) centered with auto margins. Mobile viewports get full-width content with `px-4` padding. Desktop viewports get `px-6`.

**Density:** Dashboard-dense by default. Cards use `p-5` (20px) internal padding. Section gaps are `gap-8` (32px). Between card groups, `gap-6` (24px). The interface is information-dense but never cramped — whitespace between functional groups is generous.

**Responsive:** Single-column on mobile (<640px). Two-column grid at `sm` (640px). Three-column at `lg` (1024px). Four-column event grids at `xl` (1280px). The camera grid is adaptive based on camera count.

**Full-height constraint:** All pages use `min-h-[100dvh]` (never `100vh`) to prevent iOS Safari viewport jumping. The dock occupies the remaining space.

## Elevation & Depth

SentryVision uses **tonal layering exclusively** — no shadows on cards, no backdrop-blur, no glassmorphism. Depth is communicated through surface color progression: canvas → surface → raised → control.

### Shadow Vocabulary

Shadows are defined in Tailwind config but reserved exclusively for **focus states** and **modal overlays** — never for card separation:
- **Focus glow** (`box-shadow: 0 0 0 1px rgba(94,106,210,0.2), 0 0 20px rgba(94,106,210,0.1)`): Primary button focus state only, once per screen maximum.
- **Modal backdrop** (rgba(0,0,0,0.4)): Dialog and popover overlay.

### Named Rules
**The Flat-By-Default Rule.** Every surface is flat at rest. The only shadows in the system are the focus glow on the primary CTA and the modal overlay. Cards never cast shadows. Depth comes from surface color contrast and hairline borders.

## Shapes

A tiered radius system with deliberate variation by element type:

- **Controls** (buttons, inputs, selects): 4px radius. Tight and precise — machined hardware feel.
- **Cards and containers**: 8px radius. Slightly softer than controls for visual hierarchy.
- **Popovers and dropdowns**: 12px radius. Distinct from cards, clearly floating.
- **Dialogs and modals**: 16px radius. Maximum softness for overlay surfaces.
- **Pills** (badges, status indicators, buttons): 9999px radius. Fully rounded. Used for all primary action buttons and status badges.

Borders are always hairline (1px) using the Border Scale from Colors. No thick borders, no double borders, no border-image.

### Named Rules
**The Pill Button Rule.** All primary and secondary action buttons use `rounded-full` (pill shape). Ghost buttons and icon buttons also pill-shaped. The pill is the system's signature interactive silhouette.

**The Concentric Bezel Rule.** The bezel utility applies a 1px inset highlight on card containers — a subtle machined edge that suggests physical depth without shadows. Outer bezel: `background: rgba(255,255,255,0.06); padding: 1px; border-radius: 8px`. Inner core: `background: #0A0A0B; border-radius: 7px`. Used on settings cards and premium containers.

## Components

### Buttons
- **Shape:** Fully rounded pill (`rounded-full`). Sizes: default (h-10, px-5), sm (h-9, px-4), lg (h-12, px-8), icon (h-10 w-10), icon-sm (h-8 w-8).
- **Primary:** Quiet Indigo (#5E6AD2) background, white text. Inset white highlight at 15% opacity. `active:scale-[0.97]` on press. Hover: brightens to #6E7AE0 with added glow shadow.
- **Outline:** Transparent background with `border-white/[0.16]` border and `bg-white/[0.06]`. Text foreground. Same press scale.
- **Ghost:** No border, no background. Text at 70% opacity, full opacity on hover. Used for secondary actions (Reset, Back).
- **Destructive:** #F87171 background, dark text. Used only for destructive confirmations (two-click pattern: first click turns button destructive, second executes).
- **Transition:** `transition-[transform,background-color,box-shadow,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]`. Custom strong ease-out for immediate response.

### Inputs
- **Style:** 12px radius (larger than buttons). `bg-white/[0.06]` background, `border-white/[0.16]` border. 40px height, 12px horizontal padding.
- **Focus:** Border stays at 0.16 but gains 1px focus ring (`ring-ring` at 90% opacity). Background lightens to `bg-white/[0.05]`.
- **Error:** Destructive text below field, no border color change (validation is inline, not decorative).
- **Disabled:** 50% opacity, `cursor-not-allowed`.
- **Transition:** `transition-[border-color,background-color] duration-150`. No size transition.

### Navigation (Bottom Dock)
- **Style:** Fixed bottom bar, 56px height. `bg-card` background, hairline top border (`border-white/[0.06]`).
- **Items:** Five nav items (Dashboard, Events, Security, Analytics, Assistant) plus a Settings gear. Icons at 16px, labels hidden below `sm`, shown as 10px uppercase text at `sm+`.
- **Active state:** Quiet Indigo text color with a 3px-tall, 32px-wide indigo bar indicator at the top edge. Indicator animates between items using Framer Motion `layoutId="dock-active"`.
- **Hover:** Text color transitions from muted to foreground. No background change.
- **Spring:** Indicator slides with spring physics (stiffness: 300, damping: 30).

### Cards / Containers
- **Corner Style:** 8px radius.
- **Background:** `#0A0A0B` (card surface), one step above the page canvas.
- **Shadow Strategy:** None. Flat by default. Depth from surface contrast.
- **Border:** 1px `border-white/[0.10]` at rest, `border-white/[0.16]` on hover.
- **Internal Padding:** `p-5` (20px) standard, `p-6` (24px) for larger containers.
- **Bezel variant:** Settings cards use the Concentric Bezel — outer 1px highlight ring, inner content at card surface. Creates a machined-edge feel without shadows.

### Chips / Badges
- **Style:** Pill-shaped (`rounded-full`). Tiny: 9px uppercase text with 0.04em tracking. 6px vertical, 10px horizontal padding.
- **Status colors:** Emerald for online, Zinc for offline. Blue/Green/Amber verification tiers with matching 10% opacity backgrounds and 20% opacity borders.
- **Border:** 1px, color-matched to status (e.g., `border-emerald-400/20`).

### Dropdown / Popover
- **Corner Style:** 12px radius.
- **Background:** `#121215` (popover surface).
- **Border:** 1px `border-white/[0.10]`.
- **Shadow:** None — tonal layering only.
- **Items:** 32px height, 8px radius, text foreground. Hover: `bg-white/[0.06]`. Focus: same.
- **Separator:** 1px `border-white/[0.06]` between item groups.

### Select
- **Style:** Same as Input — 12px radius, `bg-white/[0.06]`, `border-white/[0.16]`.
- **Content:** Popover-style dropdown with same background and radius.
- **Active item:** `bg-white/[0.06]` background, foreground text. Check icon aligned right.

## Do's and Don'ts

### Do:
- **Do** use the Border Scale (0.06 → 0.10 → 0.16) as the primary depth language. The progression communicates hierarchy without shadows.
- **Do** use Geist Mono for all temporal and numeric data (timestamps, percentages, IDs). Tabular figures always.
- **Do** use the pill shape for all primary action buttons. The pill is the system's interactive signature.
- **Do** use `active:scale-[0.97]` on every pressable element. Physical feedback is mandatory.
- **Do** use `transition-[transform,background-color] duration-150` for state changes. Fast and deliberate.
- **Do** use surface color steps (canvas → surface → raised → control) to communicate depth.
- **Do** keep the primary accent under 15% of any screen. Its rarity is its authority.

### Don't:
- **Don't** use drop shadows on cards or content containers. Depth comes from surface contrast and borders.
- **Don't** use `backdrop-filter: blur()` on scrolling content or cards. Reserved for fixed overlays only.
- **Don't** use `transition-all` on buttons or inputs. Specify exact properties.
- **Don't** use `ease-in` for UI animations. It starts slow and feels sluggish.
- **Don't** use the primary accent for decorative backgrounds, gradients, or section fills.
- **Don't** use `100vh` for full-height sections. Always `100dvh` to prevent iOS Safari jumping.
- **Don't** use generic circular spinners. Skeleton loaders matching the content shape are preferred.
