(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.hitori.best";
  const SIZES = [5, 6, 8];
  const OPEN = 0;
  const SHADED = 1;
  const KEPT = 2;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function neighborsOf(n) {
    const list = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const near = [];
      if (r > 0) near.push(i - n);
      if (r < n - 1) near.push(i + n);
      if (c > 0) near.push(i - 1);
      if (c < n - 1) near.push(i + 1);
      list.push(near);
    }
    return list;
  }

  // Cells that share a row or column with cell i and hold the same number.
  function twinsOf(n, grid) {
    const twins = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const list = [];
      for (let k = 0; k < n; k++) {
        if (k !== c && grid[r * n + k] === grid[i]) list.push(r * n + k);
        if (k !== r && grid[k * n + c] === grid[i]) list.push(k * n + c);
      }
      twins.push(list);
    }
    return twins;
  }

  // Unshaded cells (anything not shaded) form one orthogonally connected region.
  function whitesConnected(n, near, shaded) {
    const total = n * n;
    let start = -1;
    let whites = 0;
    for (let i = 0; i < total; i++) {
      if (shaded(i)) continue;
      whites++;
      if (start < 0) start = i;
    }
    if (start < 0) return false;
    const seen = new Uint8Array(total);
    const stack = [start];
    seen[start] = 1;
    let reach = 0;
    while (stack.length) {
      const i = stack.pop();
      reach++;
      for (const j of near[i]) {
        if (seen[j] || shaded(j)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    return reach === whites;
  }

  function rulesHold(n, grid, shaded) {
    const near = neighborsOf(n);
    for (let i = 0; i < n * n; i++) {
      if (shaded(i)) {
        if (near[i].some((j) => shaded(j))) return false;
        continue;
      }
      const r = Math.floor(i / n);
      const c = i % n;
      for (let k = c + 1; k < n; k++) if (!shaded(r * n + k) && grid[r * n + k] === grid[i]) return false;
      for (let k = r + 1; k < n; k++) if (!shaded(k * n + c) && grid[k * n + c] === grid[i]) return false;
    }
    return whitesConnected(n, near, shaded);
  }

  function countSolutions(puzzle, limit = 2, deadline = Infinity, nodeCap = 200000) {
    const n = puzzle.n;
    const grid = puzzle.grid;
    const total = n * n;
    const near = neighborsOf(n);
    const twins = twinsOf(n, grid);
    const state = new Uint8Array(total);
    const isShaded = (i) => state[i] === SHADED;
    let found = 0;
    let nodes = 0;
    let aborted = false;

    function assign(i, value, queue) {
      if (state[i] === value) return true;
      if (state[i] !== OPEN) return false;
      state[i] = value;
      queue.push(i);
      return true;
    }

    function propagate(queue) {
      while (queue.length) {
        const i = queue.pop();
        if (state[i] === SHADED) {
          for (const j of near[i]) if (!assign(j, KEPT, queue)) return false;
        } else {
          for (const j of twins[i]) if (!assign(j, SHADED, queue)) return false;
        }
      }
      return whitesConnected(n, near, isShaded);
    }

    // With every contested cell settled, the remaining open cells clash with nothing, so any of them may also be
    // shaded as long as no two shaded cells touch and the rest stays connected. Each such set is one more solution.
    function extras(from) {
      for (let i = from; i < total && found < limit; i++) {
        if (state[i] !== OPEN || near[i].some((j) => state[j] === SHADED)) continue;
        state[i] = SHADED;
        if (whitesConnected(n, near, isShaded)) {
          found++;
          extras(i + 1);
        }
        state[i] = OPEN;
      }
    }

    function settle() {
      found++;
      extras(0);
    }

    function pick() {
      let best = -1;
      let bestScore = -1;
      for (let i = 0; i < total; i++) {
        if (state[i] !== OPEN) continue;
        let rivals = 0;
        for (const j of twins[i]) if (state[j] === OPEN) rivals++;
        if (rivals > bestScore) {
          bestScore = rivals;
          best = i;
        }
      }
      return bestScore > 0 ? best : -1;
    }

    function search() {
      if (found >= limit || aborted) return;
      nodes++;
      if (nodes > nodeCap || ((nodes & 63) === 0 && Date.now() > deadline)) {
        aborted = true;
        return;
      }
      const cell = pick();
      if (cell < 0) {
        settle();
        return;
      }
      const saved = state.slice();
      for (const value of [KEPT, SHADED]) {
        state.set(saved);
        const queue = [];
        if (assign(cell, value, queue) && propagate(queue)) search();
        if (found >= limit || aborted) break;
      }
      state.set(saved);
    }

    search();
    return aborted ? -1 : found;
  }

  function latinSquare(n) {
    const rows = shuffle([...Array(n).keys()]);
    const cols = shuffle([...Array(n).keys()]);
    const symbols = shuffle([...Array(n).keys()].map((k) => k + 1));
    const grid = new Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) grid[r * n + c] = symbols[(rows[r] + cols[c]) % n];
    }
    // A few random intercalate swaps break the cyclic pattern while keeping every row and column a permutation.
    for (let pass = 0; pass < n * n * 4; pass++) {
      const r1 = Math.floor(Math.random() * n);
      const r2 = Math.floor(Math.random() * n);
      const c1 = Math.floor(Math.random() * n);
      const c2 = Math.floor(Math.random() * n);
      if (r1 === r2 || c1 === c2) continue;
      const a = grid[r1 * n + c1];
      const b = grid[r1 * n + c2];
      if (grid[r2 * n + c1] === b && grid[r2 * n + c2] === a) {
        grid[r1 * n + c1] = b;
        grid[r1 * n + c2] = a;
        grid[r2 * n + c1] = a;
        grid[r2 * n + c2] = b;
      }
    }
    return grid;
  }

  // A maximal set of shaded cells: none adjacent, the rest connected, and no further cell can be added.
  function shadePattern(n) {
    const near = neighborsOf(n);
    const shaded = new Uint8Array(n * n);
    for (const i of shuffle([...Array(n * n).keys()])) {
      if (near[i].some((j) => shaded[j])) continue;
      shaded[i] = 1;
      if (!whitesConnected(n, near, (k) => shaded[k] === 1)) shaded[i] = 0;
    }
    return shaded;
  }

  function sizeOf(value) {
    const n = Number(value);
    return SIZES.includes(n) ? n : 6;
  }

  function budgetFor(n) {
    return n >= 8 ? 3500 : 1500;
  }

  function makePuzzle(size, budget) {
    const n = sizeOf(size);
    const deadline = Date.now() + (budget || budgetFor(n));
    while (Date.now() < deadline) {
      const grid = latinSquare(n);
      const shaded = shadePattern(n);
      for (let i = 0; i < n * n; i++) {
        if (!shaded[i]) continue;
        const r = Math.floor(i / n);
        const c = i % n;
        const pool = [];
        for (let k = 0; k < n; k++) {
          if (!shaded[r * n + k]) pool.push(grid[r * n + k]);
          if (!shaded[k * n + c]) pool.push(grid[k * n + c]);
        }
        grid[i] = pool[Math.floor(Math.random() * pool.length)];
      }
      const puzzle = { n, grid };
      if (countSolutions(puzzle, 2, Math.min(deadline, Date.now() + 400)) === 1) return puzzle;
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__hitori = { makePuzzle, countSolutions, rulesHold };
    return;
  }

  const settings = GameSettings.mount({
    id: "hitori",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board.",
        type: "choice",
        default: "6",
        options: [
          { value: "5", label: "5×5" },
          { value: "6", label: "6×6" },
          { value: "8", label: "8×8" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark numbers that still repeat and shaded cells that touch.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
      else if (state.phase === "play") paint();
    },
  });

  const els = {
    shaded: document.getElementById("shaded"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    clear: document.getElementById("clear-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 6,
    grid: [],
    marks: [],
    focus: 0,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  const cells = [];

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function bestKey() {
    return `${BEST_PREFIX}.${state.n}`;
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

  function isShaded(i) {
    return state.marks[i] === SHADED;
  }

  function describe(i) {
    const n = state.n;
    const mark = state.marks[i] === SHADED ? "shaded" : state.marks[i] === KEPT ? "circled" : "open";
    return `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${state.grid[i]}, ${mark}`;
  }

  function paint() {
    const n = state.n;
    const show = settings.values.conflicts !== false;
    const repeat = new Uint8Array(n * n);
    const touch = new Uint8Array(n * n);
    if (show) {
      for (let i = 0; i < n * n; i++) {
        if (isShaded(i)) {
          const r = Math.floor(i / n);
          const c = i % n;
          if (c < n - 1 && isShaded(i + 1)) touch[i] = touch[i + 1] = 1;
          if (r < n - 1 && isShaded(i + n)) touch[i] = touch[i + n] = 1;
          continue;
        }
        const r = Math.floor(i / n);
        const c = i % n;
        for (let k = c + 1; k < n; k++) {
          const j = r * n + k;
          if (!isShaded(j) && state.grid[j] === state.grid[i]) repeat[i] = repeat[j] = 1;
        }
        for (let k = r + 1; k < n; k++) {
          const j = k * n + c;
          if (!isShaded(j) && state.grid[j] === state.grid[i]) repeat[i] = repeat[j] = 1;
        }
      }
    }
    let shaded = 0;
    for (let i = 0; i < cells.length; i++) {
      const button = cells[i];
      const mark = state.marks[i];
      if (mark === SHADED) shaded++;
      button.classList.toggle("is-shaded", mark === SHADED);
      button.classList.toggle("is-kept", mark === KEPT);
      button.classList.toggle("is-repeat", repeat[i] === 1);
      button.classList.toggle("is-touch", touch[i] === 1);
      button.setAttribute("aria-label", describe(i));
    }
    els.shaded.textContent = String(shaded);
  }

  function render() {
    const n = state.n;
    els.grid.style.setProperty("--n", String(n));
    els.grid.classList.remove("is-solved");
    els.grid.replaceChildren();
    cells.length = 0;
    for (let i = 0; i < n * n; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.textContent = String(state.grid[i]);
      button.tabIndex = i === state.focus ? 0 : -1;
      button.addEventListener("click", () => cycle(i));
      button.addEventListener("focus", () => moveFocus(i, false));
      cells.push(button);
      els.grid.append(button);
    }
    paint();
  }

  function moveFocus(i, focus) {
    if (!cells.length) return;
    cells[state.focus].tabIndex = -1;
    state.focus = i;
    cells[i].tabIndex = 0;
    if (focus) cells[i].focus();
  }

  function cycle(i) {
    if (state.phase !== "play") return;
    state.marks[i] = (state.marks[i] + 1) % 3;
    paint();
    if (rulesHold(state.n, state.grid, isShaded)) finish();
  }

  function clearMarks() {
    if (state.phase !== "play") return;
    state.marks.fill(OPEN);
    paint();
    setStatus("Board cleared.");
  }

  function onKey(event) {
    if (state.phase !== "play") return;
    const n = state.n;
    const r = Math.floor(state.focus / n);
    const c = state.focus % n;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const rr = Math.min(n - 1, Math.max(0, r + move[0]));
    const cc = Math.min(n - 1, Math.max(0, c + move[1]));
    moveFocus(rr * n + cc, true);
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.grid = [];
    state.marks = [];
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.shaded.textContent = "0";
    els.grid.replaceChildren();
    cells.length = 0;
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest();
    setStatus(`Shade the repeats away. Next board: ${state.n}×${state.n}.`);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function begin() {
    if (state.phase === "building") return;
    const token = ++state.token;
    const n = sizeOf(settings.values.size);
    state.phase = "building";
    state.n = n;
    state.record = false;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.shaded.textContent = "0";
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.grid.replaceChildren();
    cells.length = 0;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Building…";
    showBest();
    setStatus(`Building a ${n}×${n} board…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n);
      if (token !== state.token) return;
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair board. Try again.", "bad");
        return;
      }
      state.grid = puzzle.grid;
      state.marks = new Array(n * n).fill(OPEN);
      state.focus = 0;
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New board";
      els.clear.hidden = false;
      setStatus("Tap once to shade, twice to circle a number you keep, three times to clear.");
      render();
      tick();
    }, 30);
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
    els.time.textContent = clock;
    showBest();
    els.grid.classList.add("is-solved");
    els.clear.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Solved the ${state.n}×${state.n} board in ${clock}. New best.`
      : `Solved the ${state.n}×${state.n} board in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("No repeats, nothing touching, all connected.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearMarks);
  els.grid.addEventListener("keydown", onKey);
})();
