(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.queens.best";
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const CROWN =
    "M4 16.5 6.4 8.2 10 12.2 12 4l2 8.2 3.6-4L20 16.5H4zM3 18.2h18v2.2H3v-2.2z";

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function sizeOf(value) {
    const n = Number(value);
    return n === 6 || n === 9 ? n : 8;
  }

  function placeQueens(n) {
    const cols = new Array(n);
    const used = new Array(n).fill(false);

    function search(row) {
      if (row === n) return true;
      for (const col of shuffle([...Array(n).keys()])) {
        if (used[col]) continue;
        if (row > 0 && Math.abs(cols[row - 1] - col) <= 1) continue;
        used[col] = true;
        cols[row] = col;
        if (search(row + 1)) return true;
        used[col] = false;
      }
      return false;
    }

    return search(0) ? cols : null;
  }

  function solutions(n, region, limit) {
    const usedCol = new Array(n).fill(false);
    const usedRegion = new Array(n).fill(false);
    const cols = new Array(n);
    const found = [];

    function search(row) {
      if (found.length >= limit) return;
      if (row === n) {
        found.push(cols.slice());
        return;
      }
      for (let col = 0; col < n; col++) {
        if (usedCol[col]) continue;
        if (row > 0 && Math.abs(cols[row - 1] - col) <= 1) continue;
        const id = region[row * n + col];
        if (id < 0 || usedRegion[id]) continue;
        usedCol[col] = true;
        usedRegion[id] = true;
        cols[row] = col;
        search(row + 1);
        usedCol[col] = false;
        usedRegion[id] = false;
        if (found.length >= limit) return;
      }
    }

    search(0);
    return found;
  }

  function countWays(n, region, limit) {
    return solutions(n, region, limit).length;
  }

  function neighborIds(n, region, index) {
    const row = (index / n) | 0;
    const col = index % n;
    const ids = [];
    for (const [dr, dc] of DIRS) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextCol < 0 || nextRow >= n || nextCol >= n) continue;
      const id = region[nextRow * n + nextCol];
      if (id >= 0 && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  function staysConnected(n, region, index) {
    const id = region[index];
    let start = -1;
    let total = 0;
    for (let i = 0; i < region.length; i++) {
      if (i === index || region[i] !== id) continue;
      total++;
      if (start < 0) start = i;
    }
    if (total === 0) return false;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      const row = (current / n) | 0;
      const col = current % n;
      for (const [dr, dc] of DIRS) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= n || nextCol >= n) continue;
        const next = nextRow * n + nextCol;
        if (next === index || region[next] !== id || seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    return seen.size === total;
  }

  function growRegions(n, queens, deadline) {
    const region = new Array(n * n).fill(-1);
    const size = new Array(n).fill(0);
    const queenCells = new Set();
    for (let row = 0; row < n; row++) {
      const index = row * n + queens[row];
      region[index] = row;
      size[row] = 1;
      queenCells.add(index);
    }

    let open = n * n - n;
    while (open > 0 && Date.now() < deadline) {
      const options = [];
      for (let index = 0; index < region.length; index++) {
        if (region[index] !== -1) continue;
        for (const id of neighborIds(n, region, index)) {
          options.push({ index, id, weight: 1 / (size[id] * size[id]) });
        }
      }
      if (options.length === 0) return null;
      shuffle(options);
      options.sort((a, b) => b.weight - a.weight);

      let placed = false;
      for (const option of options.slice(0, 8)) {
        if (Date.now() > deadline) break;
        region[option.index] = option.id;
        if (countWays(n, region, 2) === 1) {
          size[option.id]++;
          open--;
          placed = true;
          break;
        }
        region[option.index] = -1;
      }
      if (placed) continue;

      const fallback = options[0];
      region[fallback.index] = fallback.id;
      size[fallback.id]++;
      open--;
      if (!restoreUnique(n, region, queens, queenCells, size, deadline)) return null;
    }
    if (region.includes(-1)) return null;
    return countWays(n, region, 2) === 1 ? region : null;
  }

  function restoreUnique(n, region, queens, queenCells, size, deadline) {
    for (let step = 0; step < n * 4 && Date.now() < deadline; step++) {
      const found = solutions(n, region, 2);
      if (found.length === 1) return true;
      if (found.length === 0) return false;
      const extra = found[0].some((col, row) => col !== queens[row]) ? found[0] : found[1];
      let moved = false;
      const flips = shuffle(extra.map((col, row) => row * n + col).filter((index) => !queenCells.has(index)));
      for (const index of flips) {
        if (!staysConnected(n, region, index)) continue;
        const ids = shuffle(neighborIds(n, region, index).filter((value) => value !== region[index]));
        for (const id of ids) {
          const old = region[index];
          region[index] = id;
          const originalOk = queens.every((col, row) => region[row * n + col] === row);
          if (originalOk && !acceptsPlacement(n, region, extra)) {
            size[old]--;
            size[id]++;
            if (countWays(n, region, 2) === 1) return true;
            moved = true;
            break;
          }
          region[index] = old;
        }
        if (moved) break;
      }
      if (!moved) return false;
    }
    return countWays(n, region, 2) === 1;
  }

  function acceptsPlacement(n, region, cols) {
    const used = new Array(n).fill(false);
    for (let row = 0; row < n; row++) {
      if (row > 0 && Math.abs(cols[row - 1] - cols[row]) <= 1) return false;
      const id = region[row * n + cols[row]];
      if (id < 0 || used[id]) return false;
      used[id] = true;
    }
    return true;
  }

  function makePuzzle(level) {
    const n = sizeOf(level);
    const deadline = Date.now() + (n >= 9 ? 800 : 400);
    while (Date.now() < deadline) {
      const queens = placeQueens(n);
      if (!queens) continue;
      const region = growRegions(n, queens, deadline);
      if (region && countWays(n, region, 2) === 1) return { n, region, queens };
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__queens = { makePuzzle, countWays, placeQueens, growRegions };
    return;
  }

  const settings = GameSettings.mount({
    id: "queens",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "How wide the next board is. Bigger boards take longer.",
        type: "choice",
        default: "8",
        options: [
          { value: "6", label: "6×6" },
          { value: "8", label: "8×8" },
          { value: "9", label: "9×9" },
        ],
      },
      {
        id: "conflicts",
        label: "Show conflicts",
        hint: "Mark queens that share a row, column, color, or touch.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
      else if (state.phase === "play") render();
    },
  });

  const els = {
    queens: document.getElementById("queens"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    tools: document.getElementById("tools"),
    queenMode: document.getElementById("queen-btn"),
    markMode: document.getElementById("mark-btn"),
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    n: 8,
    region: [],
    paint: [],
    queens: [],
    marks: [],
    selected: -1,
    mode: "queen",
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
    token: 0,
  };

  const cells = [];

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function bestKey(size) {
    return `${BEST_PREFIX}.${size}`;
  }

  function readBest(size) {
    const stored = Number(localStorage.getItem(bestKey(size)));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(size, ms) {
    try {
      localStorage.setItem(bestKey(size), String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest(size) {
    const best = readBest(size);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function queenIndexes() {
    const placed = [];
    for (let i = 0; i < state.queens.length; i++) if (state.queens[i]) placed.push(i);
    return placed;
  }

  function clashSet() {
    const placed = queenIndexes();
    const bad = new Set();
    const n = state.n;
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const i = placed[a];
        const j = placed[b];
        const rowA = (i / n) | 0;
        const colA = i % n;
        const rowB = (j / n) | 0;
        const colB = j % n;
        const sameLine = rowA === rowB || colA === colB || state.region[i] === state.region[j];
        const touching = Math.max(Math.abs(rowA - rowB), Math.abs(colA - colB)) <= 1;
        if (sameLine || touching) {
          bad.add(i);
          bad.add(j);
        }
      }
    }
    return bad;
  }

  function crownIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", CROWN);
    svg.append(path);
    const disc = document.createElement("span");
    disc.className = "disc";
    disc.append(svg);
    return disc;
  }

  function render() {
    const bad = settings.values.conflicts ? clashSet() : new Set();
    const playing = state.phase === "play";
    const n = state.n;

    for (let i = 0; i < cells.length; i++) {
      const button = cells[i];
      const selected = i === state.selected;
      const queen = Boolean(state.queens[i]);
      const mark = Boolean(state.marks[i]);
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-bad", bad.has(i));
      button.disabled = !playing;
      button.tabIndex = selected && playing ? 0 : -1;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.dataset.region = String(state.paint[state.region[i]]);

      const where = `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}, region ${"ABCDEFGHIJ"[state.paint[state.region[i]]]}`;
      if (queen) {
        button.replaceChildren(crownIcon());
        button.setAttribute("aria-label", `${where}, queen${bad.has(i) ? ", conflicts" : ""}`);
      } else if (mark) {
        const cross = document.createElement("span");
        cross.className = "mark";
        cross.textContent = "×";
        cross.setAttribute("aria-hidden", "true");
        button.replaceChildren(cross);
        button.setAttribute("aria-label", `${where}, marked empty`);
      } else {
        button.replaceChildren();
        button.setAttribute("aria-label", `${where}, empty`);
      }
    }

    const placed = queenIndexes().length;
    els.queens.textContent = `${placed}/${n || 0}`;
  }

  function buildBoard(n) {
    els.board.replaceChildren();
    els.board.style.setProperty("--n", String(n));
    cells.length = 0;
    for (let row = 0; row < n; row++) {
      const line = document.createElement("div");
      line.className = "board__row";
      line.setAttribute("role", "row");
      for (let col = 0; col < n; col++) {
        const index = row * n + col;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.setAttribute("role", "gridcell");
        button.addEventListener("click", () => onCell(index));
        cells.push(button);
        line.append(button);
      }
      els.board.append(line);
    }
  }

  function select(index) {
    if (state.phase !== "play" && state.phase !== "done") return;
    state.selected = index;
    render();
    if (state.phase === "play") cells[index].focus();
  }

  function onCell(index) {
    if (state.phase !== "play") {
      select(index);
      return;
    }
    state.selected = index;
    if (state.mode === "mark") toggleMark(index);
    else toggleQueen(index);
  }

  function toggleQueen(index) {
    if (state.phase !== "play") return;
    state.queens[index] = state.queens[index] ? 0 : 1;
    if (state.queens[index]) state.marks[index] = 0;
    render();
    if (isSolved()) finish();
    else if (clashSet().size) setStatus("Those queens clash.", "bad");
    else setStatus("One queen per row, column, and color. They cannot touch.");
  }

  function toggleMark(index) {
    if (state.phase !== "play") return;
    if (!state.queens[index]) state.marks[index] = state.marks[index] ? 0 : 1;
    render();
  }

  function clearCell() {
    if (state.phase !== "play" || state.selected < 0) return;
    state.queens[state.selected] = 0;
    state.marks[state.selected] = 0;
    render();
    setStatus("One queen per row, column, and color. They cannot touch.");
  }

  function isSolved() {
    return queenIndexes().length === state.n && clashSet().size === 0;
  }

  function move(dr, dc) {
    if (state.phase !== "play" || state.selected < 0) return;
    const n = state.n;
    const row = (((state.selected / n) | 0) + dr + n) % n;
    const col = (state.selected % n + dc + n) % n;
    select(row * n + col);
  }

  function setMode(mode) {
    state.mode = mode;
    els.queenMode.setAttribute("aria-pressed", mode === "queen" ? "true" : "false");
    els.markMode.setAttribute("aria-pressed", mode === "mark" ? "true" : "false");
    setStatus(mode === "mark" ? "Mark is on. Tap cells to rule them out." : "Queen is on. Tap a cell to place one.");
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function showIdle() {
    state.phase = "idle";
    state.n = sizeOf(settings.values.size);
    state.region = [];
    state.queens = [];
    state.marks = [];
    state.selected = -1;
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.queens.textContent = `0/${state.n}`;
    els.tools.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    els.board.replaceChildren();
    cells.length = 0;
    showBest(state.n);
    setStatus(`One queen per row, column, and color. Next board: ${state.n}×${state.n}.`);
  }

  function begin() {
    if (state.phase === "building") return;
    const n = sizeOf(settings.values.size);
    const token = ++state.token;
    state.phase = "building";
    window.clearTimeout(state.clock);
    els.start.disabled = true;
    els.summary.hidden = true;
    els.tools.hidden = true;
    setStatus(`Building ${n === 8 ? "an" : "a"} ${n}×${n} board…`);

    window.setTimeout(() => {
      if (token !== state.token) return;
      const made = makePuzzle(n);
      if (!made) {
        state.phase = "idle";
        els.start.disabled = false;
        setStatus("Could not build a board. Try again.", "bad");
        return;
      }
      state.phase = "play";
      state.n = made.n;
      state.region = made.region;
      state.paint = shuffle([...Array(made.n).keys()]);
      state.queens = new Array(made.n * made.n).fill(0);
      state.marks = new Array(made.n * made.n).fill(0);
      state.mode = "queen";
      state.record = false;
      state.selected = 0;
      state.started = Date.now();
      state.elapsed = 0;
      els.queenMode.setAttribute("aria-pressed", "true");
      els.markMode.setAttribute("aria-pressed", "false");
      els.tools.hidden = false;
      els.start.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New board";
      els.time.textContent = "0:00";
      showBest(made.n);
      buildBoard(made.n);
      setStatus("One queen per row, column, and color. They cannot touch.");
      render();
      cells[0].focus();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.n);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.n, state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    const best = formatTime(readBest(state.n));
    els.time.textContent = clock;
    showBest(state.n);
    els.tools.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Solved the ${state.n}×${state.n} board in ${clock}. New best.`
      : `Solved the ${state.n}×${state.n} board in ${clock}. Best is ${best}.`;
    setStatus("Solved.", "ok");
    render();
    els.again.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (state.phase !== "play") return;

    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      move(moves[event.key][0], moves[event.key][1]);
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "q" || event.key === "Q") {
      event.preventDefault();
      if (state.selected >= 0) toggleQueen(state.selected);
      return;
    }
    if (event.key === "x" || event.key === "X" || event.key === "m" || event.key === "M") {
      event.preventDefault();
      if (state.selected >= 0) {
        if (state.queens[state.selected]) return;
        toggleMark(state.selected);
      }
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      clearCell();
    }
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearCell);
  els.queenMode.addEventListener("click", () => setMode("queen"));
  els.markMode.addEventListener("click", () => setMode("mark"));
  document.addEventListener("keydown", onKey);
})();
