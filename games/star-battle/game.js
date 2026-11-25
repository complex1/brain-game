(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.star-battle.best";
  const VARIANTS = { 6: 1, 8: 1, 10: 2 };

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function bitCount(mask) {
    let count = 0;
    while (mask) { mask &= mask - 1; count++; }
    return count;
  }

  const patternCache = new Map();
  function rowPatterns(n, k) {
    const key = `${n},${k}`;
    if (!patternCache.has(key)) {
      const list = [];
      for (let mask = 0; mask < 1 << n; mask++) {
        if (bitCount(mask) === k && !(mask & (mask >> 1))) list.push(mask);
      }
      patternCache.set(key, list);
    }
    return patternCache.get(key);
  }

  function neighbors(n, i) {
    const r = Math.floor(i / n);
    const c = i % n;
    const out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  function solve(puzzle, limit, maxNodes) {
    const { n, k, regions } = puzzle;
    const total = n * n;
    const lines = 2 * n;
    const units = [];
    for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
    for (let g = 0; g < n; g++) units.push([]);
    for (let i = 0; i < total; i++) units[lines + regions[i]].push(i);
    const near = [];
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) list.push(rr * n + cc);
        }
      }
      near.push(list);
    }
    const solutions = [];
    let nodes = 0;
    let aborted = false;

    function star(st, i) {
      if (st[i] === 2) return false;
      if (st[i] === 1) return true;
      st[i] = 1;
      for (const j of near[i]) {
        if (st[j] === 1) return false;
        st[j] = 2;
      }
      return true;
    }

    function propagate(st) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let u = 0; u < units.length; u++) {
          const cells = units[u];
          let stars = 0;
          let open = 0;
          for (const i of cells) {
            if (st[i] === 1) stars++;
            else if (st[i] === 0) open++;
          }
          if (stars > k) return false;
          if (stars === k) {
            if (open) {
              for (const i of cells) if (st[i] === 0) st[i] = 2;
              changed = true;
            }
            continue;
          }
          if (u < lines) {
            let room = 0;
            let last = -2;
            for (let p = 0; p < cells.length; p++) {
              if (st[cells[p]] === 0 && p > last + 1) { room++; last = p; }
            }
            if (stars + room < k) return false;
          } else if (stars + open < k) return false;
          if (stars + open === k) {
            for (const i of cells) if (st[i] === 0 && !star(st, i)) return false;
            changed = true;
          }
        }
      }
      return true;
    }

    function search(st) {
      if (solutions.length >= limit || aborted) return;
      if (++nodes > maxNodes) { aborted = true; return; }
      if (!propagate(st)) return;
      let pick = -1;
      let fewest = Infinity;
      for (let u = 0; u < units.length; u++) {
        let stars = 0;
        let open = 0;
        for (const i of units[u]) {
          if (st[i] === 1) stars++;
          else if (st[i] === 0) open++;
        }
        if (stars < k && open < fewest) { fewest = open; pick = u; }
      }
      if (pick < 0) {
        const rows = Array(n).fill(0);
        for (let i = 0; i < total; i++) if (st[i] === 1) rows[Math.floor(i / n)] |= 1 << (i % n);
        solutions.push(rows);
        return;
      }
      const options = units[pick].filter((i) => st[i] === 0);
      for (let a = 0; a < options.length; a++) {
        const next = st.slice();
        for (let b = 0; b < a; b++) next[options[b]] = 2;
        if (star(next, options[a])) search(next);
        if (solutions.length >= limit || aborted) return;
      }
    }

    search(new Int8Array(total));
    return { count: aborted ? -1 : solutions.length, solutions, nodes };
  }

  function countSolutions(puzzle, limit = 2, maxNodes = 2000000) {
    return solve(puzzle, limit, maxNodes).count;
  }

  function randomStars(n, k) {
    const patterns = rowPatterns(n, k);
    const colCount = new Int8Array(n);
    const rows = [];
    let guard = 0;
    function place(r, prev) {
      if (++guard > 20000) return false;
      if (r === n) return true;
      const forbidden = prev | (prev << 1) | (prev >> 1);
      for (const mask of shuffle(patterns.slice())) {
        if (mask & forbidden) continue;
        let ok = true;
        for (let c = 0; c < n; c++) {
          if (!(mask & (1 << c))) continue;
          if (colCount[c] >= k) ok = false;
        }
        if (!ok) continue;
        for (let c = 0; c < n; c++) if (mask & (1 << c)) colCount[c]++;
        rows[r] = mask;
        const left = n - 1 - r;
        let fits = true;
        for (let c = 0; c < n; c++) {
          const span = mask & (1 << c) ? left - 1 : left;
          if (k - colCount[c] > Math.ceil(Math.max(0, span) / 2)) fits = false;
        }
        if (fits && place(r + 1, mask)) return true;
        for (let c = 0; c < n; c++) if (mask & (1 << c)) colCount[c]--;
      }
      return false;
    }
    if (!place(0, 0)) return null;
    const stars = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rows[r] & (1 << c)) stars.push(r * n + c);
    return { rows, stars };
  }

  function grow(n, seeds) {
    const owner = new Int16Array(n * n).fill(-1);
    const frontier = [];
    seeds.forEach((cell, id) => {
      owner[cell] = id;
      for (const next of neighbors(n, cell)) frontier.push([next, id]);
    });
    while (frontier.length) {
      const pick = Math.floor(Math.random() * frontier.length);
      const [cell, id] = frontier[pick];
      frontier[pick] = frontier[frontier.length - 1];
      frontier.pop();
      if (owner[cell] >= 0) continue;
      owner[cell] = id;
      for (const next of neighbors(n, cell)) if (owner[next] < 0) frontier.push([next, id]);
    }
    return owner;
  }

  function pairUp(n, owner, count) {
    const touch = Array.from({ length: count }, () => new Set());
    for (let i = 0; i < n * n; i++) {
      for (const j of neighbors(n, i)) if (owner[i] !== owner[j]) touch[owner[i]].add(owner[j]);
    }
    const mate = new Int16Array(count).fill(-1);
    let guard = 0;
    function match() {
      if (++guard > 5000) return false;
      const a = mate.indexOf(-1);
      if (a < 0) return true;
      for (const b of shuffle([...touch[a]])) {
        if (mate[b] >= 0) continue;
        mate[a] = b;
        mate[b] = a;
        if (match()) return true;
        mate[a] = -1;
        mate[b] = -1;
      }
      return false;
    }
    if (!match()) return null;
    const id = new Int16Array(count).fill(-1);
    let next = 0;
    for (let a = 0; a < count; a++) {
      if (id[a] >= 0) continue;
      id[a] = next;
      id[mate[a]] = next;
      next++;
    }
    return Array.from(owner, (seed) => id[seed]);
  }

  function stillConnected(n, regions, without) {
    const g = regions[without];
    let start = -1;
    let size = 0;
    for (let i = 0; i < n * n; i++) {
      if (i === without || regions[i] !== g) continue;
      size++;
      if (start < 0) start = i;
    }
    if (start < 0) return false;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop();
      for (const next of neighbors(n, cur)) {
        if (next === without || regions[next] !== g || seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    return seen.size === size;
  }

  function makePuzzle(n, budget = 4000) {
    const k = VARIANTS[n] || 1;
    const deadline = Date.now() + budget;
    const maxNodes = n >= 10 ? 60000 : 200000;
    while (Date.now() < deadline) {
      const placed = randomStars(n, k);
      if (!placed) continue;
      let regions;
      if (k === 1) regions = Array.from(grow(n, placed.stars));
      else regions = pairUp(n, grow(n, placed.stars), placed.stars.length);
      if (!regions) continue;
      const isStar = new Uint8Array(n * n);
      for (const cell of placed.stars) isStar[cell] = 1;
      const puzzle = { n, k, regions };
      for (let step = 0; step < 4 * n && Date.now() < deadline; step++) {
        const result = solve(puzzle, 2, maxNodes);
        if (result.count === 1) return { n, k, regions: regions.slice() };
        if (result.count < 1) break;
        const other = result.solutions.find((rows) => rows.some((mask, r) => mask !== placed.rows[r]));
        const wrong = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) if ((other[r] & (1 << c)) && !isStar[r * n + c]) wrong.push(r * n + c);
        }
        let moved = false;
        for (const cell of shuffle(wrong)) {
          const targets = shuffle(neighbors(n, cell).filter((next) => regions[next] !== regions[cell]));
          if (!targets.length || !stillConnected(n, regions, cell)) continue;
          regions[cell] = regions[targets[0]];
          moved = true;
          break;
        }
        if (!moved) break;
      }
    }
    return null;
  }

  function inspect(puzzle, stars) {
    const { n, k, regions } = puzzle;
    const rows = new Int16Array(n);
    const cols = new Int16Array(n);
    const regs = new Int16Array(n);
    let placed = 0;
    for (let i = 0; i < n * n; i++) {
      if (!stars[i]) continue;
      placed++;
      rows[Math.floor(i / n)]++;
      cols[i % n]++;
      regs[regions[i]]++;
    }
    const bad = new Set();
    let touching = false;
    for (let i = 0; i < n * n; i++) {
      if (!stars[i]) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      if (rows[r] > k || cols[c] > k || regs[regions[i]] > k) bad.add(i);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          if (stars[rr * n + cc]) { bad.add(i); touching = true; }
        }
      }
    }
    let exact = true;
    for (let x = 0; x < n; x++) if (rows[x] !== k || cols[x] !== k || regs[x] !== k) exact = false;
    return { placed, total: n * k, bad, solved: exact && !touching };
  }

  function regionsConnected(puzzle) {
    const { n, regions } = puzzle;
    for (let g = 0; g < n; g++) {
      const cells = [];
      for (let i = 0; i < n * n; i++) if (regions[i] === g) cells.push(i);
      if (!cells.length) return false;
      const seen = new Set([cells[0]]);
      const stack = [cells[0]];
      while (stack.length) {
        const cur = stack.pop();
        for (const next of neighbors(n, cur)) {
          if (regions[next] !== g || seen.has(next)) continue;
          seen.add(next);
          stack.push(next);
        }
      }
      if (seen.size !== cells.length) return false;
    }
    return true;
  }

  function solutionCells(puzzle) {
    const result = solve(puzzle, 1, 2000000);
    if (result.count !== 1) return null;
    const { n } = puzzle;
    const stars = new Uint8Array(n * n);
    result.solutions[0].forEach((mask, r) => {
      for (let c = 0; c < n; c++) if (mask & (1 << c)) stars[r * n + c] = 1;
    });
    return stars;
  }

  function sizeOf(value) {
    const n = Number(value);
    return n === 6 || n === 10 ? n : 8;
  }

  if (typeof document === "undefined") {
    globalThis.__starBattle = { makePuzzle, countSolutions, solve, inspect, regionsConnected, solutionCells, VARIANTS };
    return;
  }

  const settings = GameSettings.mount({
    id: "star-battle",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board. 10×10 needs two stars per row, column and region.",
        type: "choice",
        default: "8",
        options: [
          { value: "6", label: "6×6 · 1★\uFE0E" },
          { value: "8", label: "8×8 · 1★\uFE0E" },
          { value: "10", label: "10×10 · 2★\uFE0E" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark stars that touch or crowd a row, column or region.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
      else if (state.phase === "play") paint();
    },
  });

  const STAR = "★\uFE0E";
  const TINTS = 10;

  const els = {
    stars: document.getElementById("stars"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    start: document.getElementById("start-btn"),
    clear: document.getElementById("clear-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 8,
    k: 1,
    puzzle: null,
    marks: new Uint8Array(0),
    focus: 0,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

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
    try { localStorage.setItem(bestKey(), String(ms)); } catch { /* this run still finishes */ }
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function starWord(k) {
    return k === 1 ? "1 star" : `${k} stars`;
  }

  function tintRegions(puzzle) {
    const { n, regions } = puzzle;
    const touch = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n * n; i++) {
      for (const j of neighbors(n, i)) if (regions[i] !== regions[j]) touch[regions[i]].add(regions[j]);
    }
    const tint = Array(n).fill(-1);
    for (let g = 0; g < n; g++) {
      const used = new Set([...touch[g]].map((other) => tint[other]));
      let pick = 0;
      while (used.has(pick) && pick < TINTS - 1) pick++;
      tint[g] = pick;
    }
    return tint;
  }

  function cellLabel(i) {
    const n = state.n;
    const mark = state.marks[i];
    const what = mark === 2 ? "star" : mark === 1 ? "marked empty" : "empty";
    return `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, region ${state.puzzle.regions[i] + 1}, ${what}`;
  }

  function paint() {
    if (!state.puzzle) return false;
    const stars = state.marks.map((mark) => (mark === 2 ? 1 : 0));
    const report = inspect(state.puzzle, stars);
    const show = settings.values.conflicts !== false;
    for (const cell of els.board.querySelectorAll(".sb-cell")) {
      const i = Number(cell.dataset.index);
      const mark = state.marks[i];
      cell.textContent = mark === 2 ? STAR : mark === 1 ? "×" : "";
      cell.classList.toggle("is-star", mark === 2);
      cell.classList.toggle("is-note", mark === 1);
      cell.classList.toggle("is-bad", show && mark === 2 && report.bad.has(i));
      cell.setAttribute("aria-label", cellLabel(i));
    }
    els.stars.textContent = `${report.placed}/${report.total}`;
    return report.solved;
  }

  function render() {
    const { n, regions } = state.puzzle;
    const tint = tintRegions(state.puzzle);
    els.board.style.setProperty("--n", String(n));
    els.board.setAttribute("aria-label", `Star Battle board, ${n} by ${n}, ${starWord(state.k)} per row, column and region`);
    els.board.replaceChildren();
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `sb-cell tint-${tint[regions[i]]}`;
      cell.dataset.index = String(i);
      cell.tabIndex = i === state.focus ? 0 : -1;
      cell.style.setProperty("--t", r === 0 || regions[i - n] !== regions[i] ? "1" : "0");
      cell.style.setProperty("--b", r === n - 1 || regions[i + n] !== regions[i] ? "1" : "0");
      cell.style.setProperty("--l", c === 0 || regions[i - 1] !== regions[i] ? "1" : "0");
      cell.style.setProperty("--r", c === n - 1 || regions[i + 1] !== regions[i] ? "1" : "0");
      cell.addEventListener("click", () => cycle(i));
      els.board.append(cell);
    }
    paint();
  }

  function moveFocus(next) {
    const cells = els.board.querySelectorAll(".sb-cell");
    if (!cells[next]) return;
    if (cells[state.focus]) cells[state.focus].tabIndex = -1;
    state.focus = next;
    cells[next].tabIndex = 0;
    cells[next].focus();
  }

  function onKey(event) {
    if (state.phase !== "play") return;
    const n = state.n;
    const r = Math.floor(state.focus / n);
    const c = state.focus % n;
    const moves = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] };
    const target = moves[event.key];
    if (!target) return;
    event.preventDefault();
    const [rr, cc] = target;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n) return;
    moveFocus(rr * n + cc);
  }

  function cycle(i) {
    if (state.phase !== "play") return;
    const cells = els.board.querySelectorAll(".sb-cell");
    if (cells[state.focus] && state.focus !== i) cells[state.focus].tabIndex = -1;
    state.focus = i;
    if (cells[i]) cells[i].tabIndex = 0;
    state.marks[i] = (state.marks[i] + 1) % 3;
    if (paint()) finish();
  }

  function clearBoard() {
    if (state.phase !== "play") return;
    state.marks.fill(0);
    paint();
    setStatus("Board cleared. The clock keeps running.");
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.k = VARIANTS[state.n];
    state.puzzle = null;
    state.marks = new Uint8Array(0);
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.stars.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.board.replaceChildren();
    els.board.hidden = true;
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Next board: ${state.n}×${state.n}, ${starWord(state.k)} per row, column and region.`);
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
    state.k = VARIANTS[n];
    state.puzzle = null;
    state.record = false;
    state.focus = 0;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.stars.textContent = "0";
    els.summary.hidden = true;
    els.board.replaceChildren();
    els.board.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${n}×${n} sky…`);
    const giveUp = Date.now() + (n >= 10 ? 6000 : 3000);
    const attempt = () => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n, 250);
      if (token !== state.token) return;
      if (!puzzle && Date.now() < giveUp) {
        window.setTimeout(attempt, 0);
        return;
      }
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair board. Try again.", "bad");
        return;
      }
      state.puzzle = puzzle;
      state.marks = new Uint8Array(n * n);
      state.phase = "play";
      state.started = Date.now();
      els.board.hidden = false;
      els.clear.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New board";
      setStatus(`Tap a cell: × note, then star, then clear. ${starWord(state.k)} per row, column and region.`);
      render();
      tick();
    };
    window.setTimeout(attempt, 30);
  }

  function finish() {
    if (state.phase !== "play") return;
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
    els.best.textContent = formatTime(readBest());
    els.start.hidden = true;
    els.clear.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Solved the ${state.n}×${state.n} sky in ${clock}. New best.`
      : `Solved the ${state.n}×${state.n} sky in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Every row, column and region is complete.", "ok");
    els.again.focus();
  }

  showIdle();
  els.board.addEventListener("keydown", onKey);
  els.start.addEventListener("click", begin);
  els.clear.addEventListener("click", clearBoard);
  els.again.addEventListener("click", begin);
})();
