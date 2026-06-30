# PLUGIN — Website Design System

This document describes the design system for the **PLUGIN web frontend** (`plugin-frontend/`, React + Vite). It is the single reference for colors, typography, spacing, and component patterns so the UI stays consistent across every page.

> Scope: this is the **website** design system. The mobile app (`plugin-app/`) has its own separate tokens.

**Source of truth:**
- Tokens → `src/styles/variables.css` (CSS custom properties on `:root`)
- Base + component classes → `src/styles/global.css`
- Font → Montserrat, loaded in `index.html` (Google Fonts)

---

## 1. Brand & Visual Language

PLUGIN uses a **premium monochrome / dark-charcoal** aesthetic: near-black brand color, graphite accents, soft layered shadows, generous radii, and subtle gradients/animations. The feel is clean, professional, and fintech-like — not flat or "templated."

Signature touches:
- Gradient dark CTAs (`--gradient-dark` / `--gradient-accent`)
- Soft radial glows on the page background (`body` background-image)
- Hairline top-border shimmer on cards (`.card::before`)
- Spring easing on modals; float/pulse micro-animations
- Custom monochrome SVG icon system (`IconGlyph` / `.mono-icon`) — no emoji in UI

---

## 2. Color Tokens

All colors are CSS variables. **Never hardcode hex values in components — use the token.**

### Brand / Accent
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0B0B0D` | Brand near-black, dark CTAs, pagination active |
| `--color-primary-light` | `#1A1A1F` | Gradient partner for primary |
| `--color-accent` | `#1F2937` | Primary accent (graphite) — links, focus, icons |
| `--color-accent-2` | `#374151` | Accent gradient partner |
| `--color-accent-hover` | `#111827` | Accent hover |
| `--color-accent-light` | `rgba(31,41,55,0.08)` | Tinted backgrounds, hover fills |
| `--color-accent-glow` | `rgba(31,41,55,0.22)` | Glow/shadow accents |
| `--color-on-accent` | `#FFFFFF` | Text/icons on accent surfaces |

### Surfaces & Text
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#F8F8FA` | Page background |
| `--color-bg-secondary` | `#F1F2F5` | Secondary fills, ghost hover |
| `--color-surface` | `#FFFFFF` | Cards, tables, modals |
| `--color-border` | `#E3E5E8` | Default borders |
| `--color-border-light` | `#EEF0F2` | Hairline dividers, card borders |
| `--color-text-primary` | `#111318` | Headings, body |
| `--color-text-secondary` | `#4B5563` | Subtext, labels |
| `--color-text-muted` | `#8B93A1` | Placeholders, captions |
| `--color-text-inverse` | `#FFFFFF` | Text on dark |

### Semantic (each has a matching `-light` tint)
| Token | Value | Meaning |
|---|---|---|
| `--color-success` | `#27AE60` | Paid, active, available |
| `--color-danger` | `#E74C3C` | Errors, cancelled, destructive |
| `--color-warning` | `#F39C12` | Pending, unpaid, caution |
| `--color-info` | `#3498DB` | Informational |

### Gradients
`--gradient-accent`, `--gradient-dark`, `--gradient-hero`, `--gradient-card`, `--gradient-glow` — use these for hero sections, CTAs, and stat cards rather than building gradients inline.

---

## 3. Typography

- **Font family:** `--font-family` → **Montserrat**, with system fallbacks.
- Base line-height: `1.65` (body); headings tighten to `1.1–1.2` with negative letter-spacing.

### Scale (`--font-size-*`)
| Token | rem | px (≈) | Typical use |
|---|---|---|---|
| `xs` | 0.75 | 12 | captions, badges, table headers |
| `sm` | 0.875 | 14 | secondary text, buttons |
| `base` | 1 | 16 | body, inputs |
| `lg` | 1.125 | 18 | subtitles |
| `xl` | 1.25 | 20 | section titles |
| `2xl` | 1.5 | 24 | page titles (mobile) |
| `3xl` | 2 | 32 | page titles, stat values |
| `4xl` | 2.75 | 44 | hero |
| `5xl` | 3.75 | 60 | hero (large) |
| `6xl` | 4.5 | 72 | display |

**Weights:** 600 (labels/buttons), 700 (titles/badges), 800 (page headers, stat values).
Headings use `letter-spacing: -0.02em` for a tighter, premium look.

---

## 4. Spacing, Radius, Shadows

### Spacing (`--space-*`) — fluid; shrinks at breakpoints
`xs 4` · `sm 8` · `md 16` · `lg 24` · `xl 32` · `2xl 48` · `3xl 64` · `4xl 96` (px)

### Radius (`--radius-*`)
`sm 8` · `md 12` · `lg 16` · `xl 24` · `2xl 32` · `full 9999` (px)
- Buttons: `md` (sm/lg variants adjust). Cards/tables: `lg`. Modals: `xl`. Pills/badges: `full`.

### Shadows (`--shadow-*`)
`xs → xl` ascending depth, plus `--shadow-accent` / `--shadow-accent-lg` (graphite-tinted) for accent CTAs and `--shadow-inner`. Shadows are soft and layered — **use tokens, don't write raw `box-shadow`.**

### Transitions
`--transition-fast` 180ms · `--transition-base` 320ms · `--transition-slow` 600ms · `--transition-spring` 500ms (overshoot). All use the same premium easing `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 5. Core Component Classes

Use these existing classes from `global.css` rather than re-styling per page.

### Buttons — `.btn` + modifier
- `.btn--primary` — dark gradient, default CTA
- `.btn--accent` — graphite gradient, emphasis CTA (lifts on hover)
- `.btn--outline` — bordered, secondary
- `.btn--danger` — destructive
- `.btn--ghost` — minimal/tertiary
- Sizes: `.btn--sm`, `.btn--lg`; layout: `.btn--block`
- Built-in: hover lift, `:active` scale, sheen overlay, disabled state.

### Forms
`.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-error`.
Inputs use a **2px border**, accent focus ring (`0 0 0 4px --color-accent-light`), hover border darken.

### Cards — `.card` (`.card__header`, `.card__body`)
White surface, hairline border, `shadow-sm` → hover `shadow-md` + 2px lift + top shimmer line.

### Stat cards — `.stat-grid` > `.stat-card`
`.stat-card__icon` (gradient tile), `__label` (uppercase), `__value` (3xl/800), `__sub`. Auto-fill grid, min 240px.

### Tables — `.table-container` > `.table`
Sticky uppercase `th`, hairline rows, accent-tint row hover. Horizontal scroll on mobile (min-width 680px).

### Badges — `.badge` + `--success | --danger | --warning | --info | --neutral | --live`
Pill-shaped, tinted bg + matching border. `--live` pulses.

### Other
- **Modal:** `.modal-overlay` (blur backdrop) + `.modal` (`.modal__title`, `.modal__actions`); `body.modal-open` locks scroll.
- **Page header:** `.page-header` (`__title` 3xl/800, `__subtitle`).
- **Empty state:** `.empty-state` (floating gradient icon, title, text).
- **Pagination:** `.pagination` (`__btn`, `__info`).
- **Spinner:** `.spinner` / `.spinner--sm`.
- **Layout:** `.container` (max 1200px), `.page-wrapper` (offsets navbar), `.page-content`, `.page-back`.

---

## 6. Iconography

- Custom **monochrome SVG icons** via the `IconGlyph` component → renders `.mono-icon` (sizes `--sm`, `--md`, `--lg`).
- Icons inherit `--color-accent` (or `currentColor` in sidebars).
- **Do not use raw emoji** in the UI — map them through `IconGlyph`'s glyph table (`src/components/IconGlyph/IconGlyph.jsx`).

---

## 7. Animation Library (keyframes in `global.css`)

`fadeInUp`, `fadeIn`, `slideInRight`, `scaleIn`, `shimmer`, `pulse-glow`, `float`, `gradient-shift`, `spin`, `borderGlow`.
Use sparingly for entrance (`fadeInUp`/`scaleIn`), live status (`pulse-glow`), and loaders (`spin`).

---

## 8. Responsive System

Mobile-first hardening lives at the bottom of `global.css`. Key breakpoints:

| Width | Behavior |
|---|---|
| `≤1024px` | Admin sidebar → horizontal scroll bar; multi-col grids → 2-col; navbar tightens |
| `≤768px` | `.container` padding shrinks; stat grid → 2-col; tables scroll; **44px min touch targets** |
| `≤480px` | Stat grid → 1-col; modals full-width; fluid `clamp()` title sizes |
| `≤360px` | Most grids → single column |

Spacing tokens themselves shrink at `1024 / 768 / 480` (see `variables.css` media queries). Global rules prevent horizontal overflow (`overflow-x: clip`, `max-width: 100%`, `min-width: 0` on flex/grid children).

---

## 9. Usage Rules (do / don't)

✅ **Do**
- Reference tokens (`var(--…)`) for every color, space, radius, shadow, transition.
- Reuse `.btn`, `.card`, `.badge`, `.table`, `.form-*`, `.stat-card` classes.
- Keep page-specific CSS in the page's own `*.css` (BEM-ish naming, e.g. `dashboard__summary-card`).
- Maintain 44px min touch targets on interactive elements for mobile.

❌ **Don't**
- Hardcode hex colors, px shadows, or one-off font sizes.
- Introduce a new accent color or font without updating `variables.css`.
- Use emoji directly in markup (use `IconGlyph`).
- Add fixed widths that can overflow small viewports.

---

_Last updated: 2026-06-15. When tokens change, update `variables.css` first, then this doc._
