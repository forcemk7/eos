# earnOS design tokens and UI rules

This document is the single reference for spacing, color semantics, typography scale, buttons, focus, and elevation. Legacy CSS in [`app/globals.css`](../app/globals.css) and Tailwind/shadcn in [`tailwind.config.js`](../tailwind.config.js) should follow these rules.

## Token layers

1. **shadcn HSL tokens** (`:root` in `@layer base`) — Used by Tailwind utilities such as `bg-background`, `text-foreground`, `border-border`, `ring-ring`. These use **space-separated HSL components** (e.g. `--border: 215 28% 17%`) so `hsl(var(--border))` works. Do not overwrite these with hex/rgba in a second `:root` block.
2. **Legacy layout/surface tokens** (second `:root`) — App shell colors and borders that predate shadcn: `--bg`, `--bg-card`, `--bg-input`, `--eos-border`, `--eos-accent`, `--text`, `--text-secondary`, `--text-muted`, `--danger`, etc. The `eos-*` prefix avoids name collisions with shadcn.

## Semantic colors

| Role | CSS variables (HSL components) | Tailwind (examples) |
|------|--------------------------------|---------------------|
| Success | `--success`, `--success-foreground` | `text-success`, `bg-success/10`, `border-success/30` |
| Warning | `--warning`, `--warning-foreground` | `text-warning`, `bg-warning/10`, `border-warning/40` |
| Error / destructive | `--destructive` (shadcn) + legacy `--danger` for hex surfaces | `text-destructive`, `bg-destructive/10`, `.error-box` |
| Muted text | `--muted-foreground` (Tailwind) + `--text-muted` / `--text-secondary` (legacy) | `text-muted-foreground` |

Use **success / warning / destructive** for user-facing status (alerts, badges, incomplete hints), not one-off hex or raw `amber-*` unless bridging a third-party widget.

## Typography scale

Use these classes (defined in `globals.css`) for headings so page structure stays consistent.

| Level | Class | Use |
|-------|--------|-----|
| Page title | `.eos-title-page` | Top-level screen title (h1), e.g. dashboard, auth hero |
| Section title | `.eos-title-section` or `.app-section-title` | Major sections, preferences/credentials headers, editor chrome |
| Card / list title | `.eos-title-card` | Job cards, chat titles, panel headings inside a card |
| Uppercase label | `.eos-title-label` | Chunk/section labels (data groups, resume sections) |
| Hint / supporting copy | `.eos-text-hint` or `.app-section-hint` | Subtitles under titles, helper text |

[`AppPageHeader`](../app/components/shell/AppPageHeader.tsx): `variant="page"` uses `.eos-title-page`; `variant="section"` uses `.eos-title-section`.

## Buttons

Prefer the shadcn [`Button`](../app/components/ui/button.tsx) component over ad-hoc classes.

| Intent | Variant | Notes |
|--------|---------|--------|
| Primary CTA | `default` | Single main action per region |
| Secondary (alternate action, cancel next to primary) | `outline` | Default for “back / cancel” in sheets and dialogs |
| Tertiary / nav / toolbar | `ghost` | Tabs, icon buttons, low-emphasis actions |
| Destructive | `destructive` | Delete, irreversible actions |

Legacy `.primary-button` / `.secondary-button` remain for gradual migration; new code should use `<Button>`.

## Focus visible

- **Tailwind/shadcn**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (see `button.tsx`).
- **Legacy CSS**: Use `.eos-focus-ring` on interactive elements that are not yet on `<Button>`, or match the same **double box-shadow** as in `.eos-focus-ring` (ring + offset using `hsl(var(--background))` and `hsl(var(--ring))`).
- **Native inputs** in legacy screens keep border + subtle glow via `--border-focus` where applicable; prefer keyboard-visible rings where you touch those styles.

## Radius and elevation

| Token | Value / usage |
|-------|----------------|
| `--radius` | shadcn base radius (Tailwind `rounded-md` / `rounded-lg` mapping) |
| `--radius-lg` | Larger panels, cards (`rounded-xl` / `var(--radius-lg)` in TSX) |
| Tailwind `shadow-eosCard`, `shadow-eosPopover`, `shadow-eosDrawer` | Card hover, menus, drawer — prefer over scattered `rgba` shadows |

## Spacing (app shell)

Legacy variables such as `--app-shell-gap`, `--app-content-pad-x`, and `--content-max` define the main column; keep new layouts aligned with [`AppShell`](../app/components/shell/AppShell.tsx) rather than one-off horizontal padding.

## Migration note

When adding features, default to **Tailwind semantic colors** (`primary`, `muted`, `success`, `warning`, `destructive`) for React components, and **legacy tokens** only inside large `globals.css` feature blocks until those areas are ported.
