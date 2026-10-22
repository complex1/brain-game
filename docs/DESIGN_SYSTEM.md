# Design System — Mental Game

**Style:** flat-futuristic, dark-first. Clean flat surfaces, thin borders, one bright accent, monospace labels, and a faint grid in the background. Soft shadows are allowed but used for elevation and interaction, not decoration.

All values live as CSS custom properties in [`assets/css/tokens.css`](../assets/css/tokens.css). **Never hard-code a color, size, or shadow in a component — use a token.**

## 1. Principles

1. **Flat first.** Surfaces are solid colors separated by 1px borders. Depth comes from surface lightness, not gradients.
2. **One accent.** Cyan is the single "action" color. Violet is secondary and used sparingly.
3. **Quiet chrome, loud content.** UI recedes; the game is the focus.
4. **Futuristic through detail.** Monospace uppercase labels, the `//` prefix, a subtle grid backdrop, and a thin accent line on hover — not neon or heavy glow.
5. **Accessible by default.** AA contrast, visible focus rings, reduced-motion support.

## 2. Color

### Surfaces

| Token                     | Value     | Use                               |
| ------------------------- | --------- | --------------------------------- |
| `--color-bg`              | `#0a0c11` | Page background                   |
| `--color-surface`         | `#11141b` | Cards, inputs                     |
| `--color-surface-raised`  | `#181c25` | Badges, nested panels             |
| `--color-surface-hover`   | `#1f2430` | Hover state for ghost elements    |
| `--color-border`          | `#262c38` | Default borders and dividers      |
| `--color-border-strong`   | `#353d4d` | Hover borders, ghost buttons      |

### Text

| Token                   | Value     | Use                          |
| ----------------------- | --------- | ---------------------------- |
| `--color-text`          | `#e6e9f0` | Primary text                 |
| `--color-text-muted`    | `#8b93a5` | Secondary text, descriptions |
| `--color-text-subtle`   | `#5d6577` | Placeholders, footers        |
| `--color-text-on-accent`| `#04161a` | Text on accent backgrounds   |

### Brand & status

| Token               | Value     | Use                                      |
| ------------------- | --------- | ---------------------------------------- |
| `--color-accent`    | `#35d6e8` | Primary actions, focus, active states    |
| `--color-secondary` | `#8f7dff` | Secondary highlights, charts             |
| `--color-success`   | `#3ddc97` | Correct answer, "easy"                   |
| `--color-warning`   | `#ffc857` | Time running out, "medium"               |
| `--color-danger`    | `#ff5c7a` | Wrong answer, "hard"                     |

`--color-accent-soft` and `--color-secondary-soft` are 12–14% tints for chip/badge backgrounds.

## 3. Typography

- **Sans** (`--font-sans`): Inter if installed, otherwise system UI. Used for everything readable.
- **Mono** (`--font-mono`): system monospace. Used for labels, badges, keyboard hints, scores, and timers.

| Token        | Size               | Use                      |
| ------------ | ------------------ | ------------------------ |
| `--text-xs`  | 12px               | Labels, badges           |
| `--text-sm`  | 14px               | Card body, buttons       |
| `--text-md`  | 16px               | Body                     |
| `--text-lg`  | 20px               | Card titles, lead text   |
| `--text-xl`  | 24px               | Section headings         |
| `--text-2xl` | 32px               | Game titles              |
| `--text-3xl` | 36–52px (fluid)    | Homepage hero            |

Headings use tight leading (`1.15`) and slight negative tracking. The `.label` class gives the signature mono, uppercase, wide-tracked style — prefix section labels with `//`.

## 4. Spacing, shape, elevation

- **Spacing** follows a 4px base: `--space-1` (4px) through `--space-8` (64px).
- **Radius:** `--radius-sm` 6px (badges), `--radius-md` 10px (buttons, inputs), `--radius-lg` 16px (cards), `--radius-pill` (chips).
- **Shadows:** flat by default. `--shadow-md` on hover/raised cards, `--shadow-lg` for modals/overlays, `--shadow-glow` reserved for a single highlighted element (e.g. active game tile).
- **Focus:** always `--focus-ring` (2px accent ring offset from the background).

## 5. Motion

- `--duration-fast` (120ms) for color/border changes, `--duration-base` (200ms) for movement.
- Easing: `--ease-out`.
- Hover lift is at most `translateY(-2px)`.
- Both durations drop to `0ms` under `prefers-reduced-motion`.

## 6. Components

Defined in [`assets/css/components.css`](../assets/css/components.css).

| Component   | Classes                                              | Notes                                                    |
| ----------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Button      | `.btn` + `.btn--primary` / `.btn--ghost`             | One primary button per view. Disable via `aria-disabled`. |
| Input       | `.input`                                             | Always pair with a `<label>` (visible or `.visually-hidden`). |
| Chip        | `.chip` + `aria-pressed`                             | Toggle filters. Use `<button>`.                          |
| Badge       | `.badge`, `--accent`, `--secondary`, `--easy/medium/hard` | Static, non-interactive labels.                     |
| Card        | `.card`, `.card--interactive`, `__header/__title/__body/__meta/__footer` | Clickable cards use `.card__link` to stretch one link over the card. |
| Empty state | `.empty-state`                                       | Dashed border, centered message.                         |
| Kbd         | `.kbd`                                               | Keyboard hints.                                          |
| Label       | `.label`                                             | Mono uppercase micro-heading.                            |
| Icon button | `.icon-btn`                                          | Square control for the settings gear and close.          |
| Settings    | `.settings`, `.settings__panel`, `.settings__field`  | Per-game dialog opened from `[data-game-settings]`.      |

## 7. Layout

- `.container` caps content at `--container-max` (1200px) with side padding.
- Card grids use `repeat(auto-fill, minmax(280px, 1fr))`.
- Sticky header, 64px tall, translucent with blur.

## 8. Rules for game pages

- Link `tokens.css`, `base.css`, `components.css` first; put game-specific styles in the game folder's `style.css`.
- Use status colors for feedback: success = correct, danger = wrong, warning = time pressure.
- Show scores and timers in `--font-mono`.
- Keep a visible "← All games" link at the top, with the settings gear on the same row (`.game__bar` + `[data-game-settings]`).
- Settings belong to that game. Register them with `GameSettings.mount({ id, fields })` in the game's `game.js`. Use `choice` or `toggle` fields. Don't put another game's options in the dialog.
- Don't introduce new colors; if a game truly needs one, add it as a token first.

## 9. Naming

- CSS classes: BEM-ish — `.block`, `.block__element`, `.block--modifier`.
- Files and game ids: kebab-case.
