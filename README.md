# Mental Game

A collection of focused browser games for memory, attention, arithmetic,
language, spatial reasoning, and logic.

[Play Mental Game](https://complex1.github.io/brain-game/)

The project uses plain HTML, CSS, and JavaScript. It has no framework, package
installation, build command, backend, account system, or tracking.

## Included games

- Memory Grid, Sequence Recall, Concentration, Reverse Digits, Corsi Blocks
- Quick Math, Quick Sum, Missing Operator
- Color Clash, Odd One Out, Reaction Tap, Dual N-Back
- Find the Number, Find the Word, Anagram Sprint, Word Ladder, Cryptogram
- Mirror Match, Rush Hour, Sokoban
- Chess, Othello, Checkers
- Sudoku, Killer Sudoku, Queens, Zip, Futoshiki
- Slitherlink, Nonogram, Kakuro, Hashi, Nurikabe, Star Battle, Akari, Masyu, Hitori
- Guess the Pattern, Mastermind, Minesweeper

Settings and personal-best times are saved in the browser with `localStorage`.
Find the Word retrieves short nouns from
[`randomapi.dev`](https://randomapi.dev/).

## Run locally

The catalog loads `data/games.json` with `fetch()`. Serve the repository over
HTTP because browsers do not allow this request from a `file://` page.

```bash
git clone https://github.com/complex1/brain-game.git
cd brain-game
python3 -m http.server 8000
```

Open <http://localhost:8000>. You can also use `npx serve .` if Node.js is
installed.

## Publish with GitHub Pages

The repository includes `.github/workflows/pages.yml`. Every push to `main`
deploys the repository root as a static GitHub Pages site.

For the first deployment:

1. Open the repository on GitHub.
2. Select **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish.
5. Visit <https://complex1.github.io/brain-game/>.

Future pushes to `main` deploy automatically. The `.nojekyll` file tells
GitHub Pages to serve all project files directly.

## Install as an app (PWA)

The site is an installable, offline-capable web app. Open it over HTTPS (the
GitHub Pages URL) and use **Install** in the browser's address bar (Chrome,
Edge), or **Share → Add to Home Screen** on iPhone and **⋮ → Install app** on
Android.

- `manifest.webmanifest` describes the app; icons live in `assets/icons/`
  (regenerate with `node scripts/generate-icons.js`).
- `sw.js` caches the catalog and every game listed in `data/games.json`, so new
  games are picked up automatically. Pages load from the network first and fall
  back to the cache when offline. Bump `CACHE_VERSION` in `sw.js` to force a
  full refresh.
- Every new game page needs the manifest/icon tags and `pwa.js` script from
  `games/_template/index.html`.

## Project structure

```text
.
├── .github/workflows/pages.yml  # GitHub Pages deployment
├── assets/
│   ├── css/                     # Shared tokens and components
│   └── js/                      # Catalog and game settings
├── data/games.json              # Catalog source of truth
├── docs/                        # Product and design documentation
├── games/
│   ├── _template/               # Starting point for a new game
│   └── <game-id>/               # Standalone game page, styles, and logic
├── index.html                   # Searchable game catalog
└── README.md
```

All links and asset paths are relative, so the site works from the
`/brain-game/` GitHub Pages project path.

## Add a game

1. Copy `games/_template/` to `games/<game-id>/`. Use a kebab-case ID.
2. Build the game inside that folder with `index.html`, `style.css`, and
   `game.js`.
3. Reuse the shared design tokens and components described in
   [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).
4. Mount game-specific options with `GameSettings.mount`. Settings are stored
   separately for each game.
5. Add the game metadata to `data/games.json`.
6. Set its `status` to `"live"` when it is ready. Other status values render a
   disabled catalog card.

Example metadata:

```json
{
  "id": "memory-grid",
  "name": "Memory Grid",
  "tag": "Memory",
  "description": "A pattern lights up briefly. Reproduce it from memory.",
  "tags": ["memory", "visual", "pattern"],
  "difficulty": "medium",
  "durationMinutes": 3,
  "path": "games/memory-grid/",
  "status": "live",
  "addedOn": "2026-10-19"
}
```

Required fields are `id`, `name`, `tag`, `description`, `tags`, `path`, and
`status`. Optional fields are `difficulty`, `durationMinutes`, and `addedOn`.

## Documentation

- [Product requirements](docs/PRD.md)
- [Design system](docs/DESIGN_SYSTEM.md)
