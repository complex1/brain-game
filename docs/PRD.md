# Product Requirements — Mental Game

**Status:** Draft v0.1 · **Last updated:** 2026-10-19

## 1. Summary

Mental Game is a web catalog of short brain-training games. Players land on a homepage, find a game by searching or filtering, and play it instantly in the browser. New games are added by dropping a folder into `games/` and registering it in `data/games.json`.

## 2. Goals

- Make it effortless to find and start a brain game (≤ 2 clicks from homepage to playing).
- Make it effortless to **add** a new game — no code changes to the homepage.
- Keep the stack dependency-free: static HTML, CSS, and vanilla JS that runs on any static host.
- Deliver a consistent, recognizable look across every game via a shared design system.

## 3. Non-goals (for now)

- User accounts, login, or cloud sync.
- Multiplayer or leaderboards across users.
- Frameworks, bundlers, or a build step.
- Native mobile apps.

## 4. Target users

- People who want a few minutes of focused mental exercise (commute, break, warm-up).
- Students and professionals looking to sharpen memory, focus, or quick math.

## 5. Game categories

Each game has exactly one primary `tag` (category):

| Category   | Trains                                    |
| ---------- | ----------------------------------------- |
| Memory     | Short-term and working memory             |
| Focus      | Attention, inhibition, reaction           |
| Logic      | Reasoning, pattern recognition, puzzles   |
| Arithmetic | Mental math speed and accuracy            |
| Language   | Vocabulary, word association, spelling    |
| Spatial    | Visualization, rotation, navigation       |

New categories are allowed; they appear automatically as filter chips.

## 6. Functional requirements

### 6.1 Homepage / catalog

| ID   | Requirement                                                                                          | Priority |
| ---- | ---------------------------------------------------------------------------------------------------- | -------- |
| H-1  | Load the game list from `data/games.json` at runtime.                                                | Must     |
| H-2  | Render each game as a card: name, category, description, tags, difficulty, duration, action button.  | Must     |
| H-3  | Search box filters games live across name, category, description, and tags (multi-word, AND match).  | Must     |
| H-4  | Category filter chips, generated from the data, plus an "All" option.                                | Must     |
| H-5  | Show a result count and an empty state when nothing matches.                                         | Must     |
| H-6  | Games with `status: "live"` are clickable; others show a disabled "Coming soon" button.              | Must     |
| H-7  | Keyboard: `/` focuses search, `Esc` clears it.                                                        | Should   |
| H-8  | Show a clear error message if the catalog fails to load.                                             | Should   |
| H-9  | Persist search/filter in the URL so results are shareable.                                           | Could    |
| H-10 | Sort options (newest, A–Z, duration).                                                                 | Could    |

### 6.2 Game pages

| ID   | Requirement                                                                     | Priority |
| ---- | ------------------------------------------------------------------------------- | -------- |
| G-1  | Each game lives in `games/<id>/` with its own `index.html`.                      | Must     |
| G-2  | Each game links back to the catalog.                                            | Must     |
| G-3  | Games use the shared tokens and components from `assets/css/`.                  | Must     |
| G-4  | Each game has clear instructions, a start action, and an end-of-round summary.  | Must     |
| G-5  | Store personal best score locally (`localStorage`, keyed by game id).            | Should   |
| G-6  | Playable with mouse, touch, and (where sensible) keyboard.                      | Should   |

### 6.3 Catalog data (`data/games.json`)

Shape:

```json
{
  "version": 1,
  "games": [ { "id": "...", "name": "...", "tag": "...", "description": "...", "tags": [], "path": "...", "status": "live" } ]
}
```

Full field reference lives in the [README](../README.md#gamesjson-fields).

## 7. Non-functional requirements

- **Performance:** Homepage interactive in < 1s on a mid-range phone; no external runtime dependencies.
- **Accessibility:** WCAG 2.1 AA contrast, visible focus states, semantic HTML, respects `prefers-reduced-motion`.
- **Responsive:** Works from 360px wide phones to large desktops.
- **Browser support:** Latest two versions of Chrome, Safari, Firefox, Edge.
- **Security:** Catalog data is rendered via `textContent`, never `innerHTML`.
- **Hosting:** Deployable as-is to any static host (GitHub Pages, Netlify, Cloudflare Pages).

## 8. Success metrics

- Time from homepage load to game start.
- Search usage and zero-result rate.
- Games played per session; return visits (local only, until analytics are decided).

## 9. Milestones

1. **M0 — Foundation** (this setup): README, PRD, design system, catalog homepage, game template.
2. **M1 — First games:** Ship 3–4 playable games (Memory Grid, Quick Math, Color Clash, Sequence Recall).
3. **M2 — Polish:** Personal bests, URL-synced filters, sort, favicon/social preview.
4. **M3 — Growth:** More categories, daily challenge, optional PWA/offline support.

## 10. Open questions

- Final product name and logo?
- Do we want any analytics, and if so, privacy-friendly only?
- Should games share a common scoring/HUD component?
