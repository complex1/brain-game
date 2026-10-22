(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.find-the-word.best";
  const WORD_API = "https://randomapi.dev/api/words";
  const STRAIGHT = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const DIAGONAL = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function wordsFrom(data) {
    if (!Array.isArray(data)) return [];
    const words = [];
    for (const item of data) {
      const word = String(item && item.word ? item.word : "")
        .toLowerCase()
        .trim();
      if (/^[a-z]{3,5}$/.test(word)) words.push(word);
    }
    return words;
  }

  function countOf(value) {
    const count = Number(value);
    return count === 3 || count === 8 ? count : 5;
  }

  function sizeFor(words) {
    const letters = words.reduce((sum, word) => sum + word.length, 0);
    const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
    return Math.max(8, longest, Math.ceil(Math.sqrt(letters * 2.2)));
  }

  function fits(grid, word, row, col, dr, dc) {
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || c < 0 || r >= grid.length || c >= grid.length) return false;
      const letter = grid[r][c];
      if (letter && letter !== word[i]) return false;
    }
    return true;
  }

  function placeOne(grid, word, dirs) {
    const n = grid.length;
    const spots = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) spots.push([row, col]);
    }
    shuffle(spots);
    const options = shuffle(dirs.slice());
    for (const [row, col] of spots) {
      for (const [dr, dc] of options) {
        if (!fits(grid, word, row, col, dr, dc)) continue;
        for (let i = 0; i < word.length; i++) grid[row + dr * i][col + dc * i] = word[i];
        return true;
      }
    }
    return false;
  }

  function placeWords(words, directions) {
    const list = words.map((word) => word.toUpperCase());
    const n = sizeFor(list);
    const dirs = directions === "straight" ? STRAIGHT : STRAIGHT.concat(DIAGONAL);
    for (let attempt = 0; attempt < 24; attempt++) {
      const grid = Array.from({ length: n }, () => Array(n).fill(""));
      const order = shuffle(list.slice()).sort((a, b) => b.length - a.length);
      const placed = order.every((word) => placeOne(grid, word, dirs));
      if (!placed) continue;
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          if (!grid[row][col]) grid[row][col] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
      return grid;
    }
    return null;
  }

  function lineBetween(start, end) {
    const dr = end.row - start.row;
    const dc = end.col - start.col;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return [{ row: start.row, col: start.col }];
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    const cells = [];
    for (let i = 0; i <= steps; i++) cells.push({ row: start.row + sr * i, col: start.col + sc * i });
    return cells;
  }

  if (typeof document === "undefined") {
    globalThis.__findWord = { wordsFrom, placeWords, lineBetween, sizeFor };
    return;
  }

  const settings = GameSettings.mount({
    id: "find-the-word",
    fields: [
      {
        id: "count",
        label: "Words",
        hint: "How many nouns to hide. Loaded when the next puzzle starts.",
        type: "choice",
        default: "5",
        options: [
          { value: "3", label: "3" },
          { value: "5", label: "5" },
          { value: "8", label: "8" },
        ],
      },
      {
        id: "directions",
        label: "Directions",
        hint: "Where a word is allowed to run.",
        type: "choice",
        default: "any",
        options: [
          { value: "straight", label: "Across & down" },
          { value: "any", label: "Any direction" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
    },
  });

  const els = {
    found: document.getElementById("found"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    words: document.getElementById("words"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    count: 5,
    directions: "any",
    grid: [],
    words: [],
    foundCells: new Set(),
    anchor: null,
    hover: null,
    dragging: false,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function directionLabel(value) {
    return value === "straight" ? "across and down" : "any direction";
  }

  function bestKey() {
    return `${BEST_PREFIX}.${state.count}.${state.directions}`;
  }

  function readBest() {
    const stored = Number(localStorage.getItem(bestKey()));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(ms) {
    try {
      localStorage.setItem(bestKey(), String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest() {
    const best = readBest();
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function cellKey(cell) {
    return `${cell.row},${cell.col}`;
  }

  async function loadWords(count) {
    const gathered = [];
    const seen = new Set();
    for (let attempt = 0; attempt < 3 && gathered.length < count; attempt++) {
      const url = `${WORD_API}?type=noun&minLength=3&maxLength=5&count=${count}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("Couldn't load words. Try again.");
      const { data } = await res.json();
      for (const word of wordsFrom(data)) {
        if (seen.has(word)) continue;
        seen.add(word);
        gathered.push(word);
        if (gathered.length === count) break;
      }
    }
    if (gathered.length < count) throw new Error("The word list came back short. Try again.");
    return gathered;
  }

  function paint() {
    const found = state.words.filter((word) => word.found).length;
    els.found.textContent = state.words.length ? `${found}/${state.words.length}` : "0";
    els.words.replaceChildren();
    for (const word of state.words) {
      const item = document.createElement("li");
      item.className = "word";
      item.classList.toggle("is-found", word.found);
      item.textContent = word.text;
      els.words.append(item);
    }
    const pick = state.anchor ? lineBetween(state.anchor, state.hover || state.anchor) || [state.anchor] : [];
    const pickKeys = new Set(pick.map(cellKey));
    for (const button of els.grid.querySelectorAll(".cell")) {
      const key = `${button.dataset.row},${button.dataset.col}`;
      button.classList.toggle("is-pick", pickKeys.has(key));
      button.classList.toggle("is-found", state.foundCells.has(key));
    }
  }

  function renderBoard() {
    const n = state.grid.length;
    els.grid.style.setProperty("--n", String(n));
    els.grid.replaceChildren();
    state.grid.forEach((row, r) => {
      row.forEach((letter, c) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.row = String(r);
        button.dataset.col = String(c);
        button.textContent = letter;
        button.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}, ${letter}`);
        els.grid.append(button);
      });
    });
    paint();
  }

  function clearBoard() {
    state.grid = [];
    state.words = [];
    state.foundCells = new Set();
    state.anchor = null;
    state.hover = null;
    state.dragging = false;
    els.grid.replaceChildren();
    els.words.replaceChildren();
    paint();
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.count = countOf(settings.values.count);
    state.directions = settings.values.directions === "straight" ? "straight" : "any";
    window.clearTimeout(state.clock);
    state.elapsed = 0;
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    clearBoard();
    showBest();
    setStatus(`Nouns are hidden in a straight line. Next puzzle: ${state.count} words, ${directionLabel(state.directions)}.`);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  async function begin() {
    if (state.phase === "building") return;
    const token = ++state.token;
    const count = countOf(settings.values.count);
    const directions = settings.values.directions === "straight" ? "straight" : "any";
    state.phase = "building";
    state.count = count;
    state.directions = directions;
    state.record = false;
    window.clearTimeout(state.clock);
    state.elapsed = 0;
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Loading…";
    clearBoard();
    showBest();
    setStatus("Fetching words…");
    try {
      const words = await loadWords(count);
      if (token !== state.token) return;
      const grid = placeWords(words, directions);
      if (!grid) throw new Error("Couldn't hide those words. Try again.");
      state.grid = grid;
      state.words = words.map((word) => ({ text: word.toUpperCase(), found: false }));
      state.foundCells = new Set();
      state.phase = "play";
      state.started = Date.now();
      renderBoard();
      els.start.disabled = false;
      els.start.textContent = "New puzzle";
      setStatus("Drag across a word, or tap the first and last letter.");
      tick();
    } catch (error) {
      if (token !== state.token) return;
      state.phase = "idle";
      els.start.disabled = false;
      els.start.textContent = "Try again";
      setStatus(error instanceof Error ? error.message : "Couldn't load words. Try again.", "bad");
    }
  }

  function trySelect(start, end) {
    const cells = lineBetween(start, end);
    state.anchor = null;
    state.hover = null;
    state.dragging = false;
    if (!cells || cells.length < 2) {
      paint();
      return;
    }
    const text = cells.map((cell) => state.grid[cell.row][cell.col]).join("");
    const reverse = [...text].reverse().join("");
    const match = state.words.find((word) => !word.found && (word.text === text || word.text === reverse));
    if (!match) {
      setStatus("Keep looking.");
      paint();
      return;
    }
    match.found = true;
    for (const cell of cells) state.foundCells.add(cellKey(cell));
    const left = state.words.filter((word) => !word.found).length;
    paint();
    if (left === 0) {
      finish();
      return;
    }
    setStatus(`${match.text} found. ${left} left.`);
  }

  function cellFromEvent(event) {
    const point = document.elementFromPoint(event.clientX, event.clientY);
    const node = point && point.closest ? point.closest(".cell") : null;
    if (!node || !els.grid.contains(node)) return null;
    return { row: Number(node.dataset.row), col: Number(node.dataset.col) };
  }

  function onPointerDown(event) {
    if (state.phase !== "play" || event.button !== 0) return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    event.preventDefault();
    if (state.anchor && !state.dragging) {
      trySelect(state.anchor, cell);
      return;
    }
    state.dragging = true;
    state.anchor = cell;
    state.hover = cell;
    els.grid.setPointerCapture(event.pointerId);
    paint();
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    state.hover = cell;
    paint();
  }

  function onPointerUp() {
    if (!state.dragging) return;
    const start = state.anchor;
    const end = state.hover;
    state.dragging = false;
    if (!start || !end || (start.row === end.row && start.col === end.col)) {
      paint();
      return;
    }
    trySelect(start, end);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest();
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    const best = formatTime(readBest());
    els.time.textContent = clock;
    showBest();
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Found all ${state.words.length} words in ${clock}. New best.`
      : `Found all ${state.words.length} words in ${clock}. Best is ${best}.`;
    setStatus("All words found.", "ok");
    paint();
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.grid.addEventListener("pointerdown", onPointerDown);
  els.grid.addEventListener("pointermove", onPointerMove);
  els.grid.addEventListener("pointerup", onPointerUp);
  els.grid.addEventListener("pointercancel", () => {
    state.dragging = false;
    state.anchor = null;
    state.hover = null;
    paint();
  });
})();
