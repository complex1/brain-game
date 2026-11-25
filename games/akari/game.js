(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.akari.best";
  const WHITE = -2;
  const WALL = -1;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function orthogonal(n, i) {
    const r = Math.floor(i / n);
    const c = i % n;
    const out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  function sightLines(n, cells) {
    const sees = Array.from({ length: n * n }, () => []);
    for (let i = 0; i < n * n; i++) {
      if (cells[i] !== WHITE) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && cc >= 0 && rr < n && cc < n && cells[rr * n + cc] === WHITE) {
          sees[i].push(rr * n + cc);
          rr += dr;
          cc += dc;
        }
      }
    }
    return sees;
  }

  function solve(puzzle, limit, maxNodes) {
    const { n, cells } = puzzle;
    const total = n * n;
    const sees = sightLines(n, cells);
    const whites = [];
    const clues = [];
    for (let i = 0; i < total; i++) {
      if (cells[i] === WHITE) whites.push(i);
      else if (cells[i] >= 0) clues.push({ need: cells[i], around: orthogonal(n, i).filter((j) => cells[j] === WHITE) });
    }
    const solutions = [];
    let nodes = 0;
    let aborted = false;

    function place(st, lit, i) {
      if (st[i] === 1) return true;
      if (st[i] === 2) return false;
      st[i] = 1;
      lit[i] = 1;
      for (const j of sees[i]) {
        if (st[j] === 1) return false;
        st[j] = 2;
        lit[j] = 1;
      }
      return true;
    }

    function propagate(st, lit) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const clue of clues) {
          let lamps = 0;
          let open = 0;
          for (const j of clue.around) {
            if (st[j] === 1) lamps++;
            else if (st[j] === 0) open++;
          }
          if (lamps > clue.need || lamps + open < clue.need) return false;
          if (!open) continue;
          if (lamps === clue.need) {
            for (const j of clue.around) if (st[j] === 0) st[j] = 2;
            changed = true;
          } else if (lamps + open === clue.need) {
            for (const j of clue.around) if (st[j] === 0 && !place(st, lit, j)) return false;
            changed = true;
          }
        }
        for (const i of whites) {
          if (lit[i]) continue;
          let only = -1;
          let options = 0;
          if (st[i] === 0) { only = i; options++; }
          for (const j of sees[i]) {
            if (st[j] === 0) { only = j; options++; if (options > 1) break; }
          }
          if (!options) return false;
          if (options === 1) {
            if (!place(st, lit, only)) return false;
            changed = true;
          }
        }
      }
      return true;
    }

    function search(st, lit) {
      if (solutions.length >= limit || aborted) return;
      if (++nodes > maxNodes) { aborted = true; return; }
      if (!propagate(st, lit)) return;
      let pick = -1;
      let best = Infinity;
      for (const i of whites) {
        if (lit[i]) continue;
        let options = st[i] === 0 ? 1 : 0;
        for (const j of sees[i]) if (st[j] === 0) options++;
        if (options < best) { best = options; pick = i; }
      }
      if (pick < 0) {
        for (const clue of clues) {
          let lamps = 0;
          for (const j of clue.around) if (st[j] === 1) lamps++;
          if (lamps !== clue.need) return;
        }
        solutions.push(Array.from(st, (value) => (value === 1 ? 1 : 0)));
        return;
      }
      const options = [];
      if (st[pick] === 0) options.push(pick);
      for (const j of sees[pick]) if (st[j] === 0) options.push(j);
      for (let a = 0; a < options.length; a++) {
        const nextSt = st.slice();
        const nextLit = lit.slice();
        let ok = true;
        for (let b = 0; b < a; b++) nextSt[options[b]] = 2;
        if (!place(nextSt, nextLit, options[a])) ok = false;
        if (ok) search(nextSt, nextLit);
        if (solutions.length >= limit || aborted) return;
      }
    }

    search(new Int8Array(total), new Uint8Array(total));
    return { count: aborted ? -1 : solutions.length, solutions, nodes };
  }

  function countSolutions(puzzle, limit = 2, maxNodes = 200000) {
    return solve(puzzle, limit, maxNodes).count;
  }

  function randomWalls(n) {
    const cells = Array(n * n).fill(WHITE);
    const density = 0.17 + Math.random() * 0.08;
    const target = Math.round(n * n * density);
    let walls = 0;
    for (let guard = 0; walls < target && guard < n * n * 4; guard++) {
      const i = Math.floor(Math.random() * n * n);
      const mirror = n * n - 1 - i;
      if (cells[i] === WALL) continue;
      cells[i] = WALL;
      walls++;
      if (cells[mirror] !== WALL) { cells[mirror] = WALL; walls++; }
    }
    return cells;
  }

  function randomLamps(n, cells) {
    const sees = sightLines(n, cells);
    const lit = new Uint8Array(n * n);
    const lamps = new Uint8Array(n * n);
    for (const i of shuffle([...Array(n * n).keys()])) {
      if (cells[i] !== WHITE || lit[i]) continue;
      lamps[i] = 1;
      lit[i] = 1;
      for (const j of sees[i]) lit[j] = 1;
    }
    return lamps;
  }

  function makePuzzle(n, budget = 3000) {
    const deadline = Date.now() + budget;
    const maxNodes = n >= 10 ? 60000 : 20000;
    while (Date.now() < deadline) {
      const layout = randomWalls(n);
      const lamps = randomLamps(n, layout);
      const numbers = layout.map((value, i) => {
        if (value !== WALL) return value;
        return orthogonal(n, i).reduce((sum, j) => sum + lamps[j], 0);
      });
      const walls = [];
      for (let i = 0; i < n * n; i++) if (layout[i] === WALL) walls.push(i);
      if (countSolutions({ n, cells: numbers }, 2, maxNodes) !== 1) continue;
      const cells = layout.slice();
      const order = shuffle(walls.slice());
      let unique = countSolutions({ n, cells }, 2, maxNodes) === 1;
      let failed = false;
      for (let a = 0; a < order.length && !unique; a++) {
        if (Date.now() > deadline) { failed = true; break; }
        cells[order[a]] = numbers[order[a]];
        const count = countSolutions({ n, cells }, 2, maxNodes);
        if (count < 0) { failed = true; break; }
        unique = count === 1;
      }
      if (failed || !unique) continue;
      for (const i of shuffle(walls.filter((w) => cells[w] >= 0))) {
        if (Date.now() > deadline) break;
        const keep = cells[i];
        cells[i] = WALL;
        if (countSolutions({ n, cells }, 2, maxNodes) !== 1) cells[i] = keep;
      }
      if (countSolutions({ n, cells }, 2, maxNodes * 4) === 1) return { n, cells };
    }
    return null;
  }

  function inspect(puzzle, lamps) {
    const { n, cells } = puzzle;
    const sees = sightLines(n, cells);
    const lit = new Uint8Array(n * n);
    const badLamps = new Set();
    const badWalls = new Set();
    const metWalls = new Set();
    let whites = 0;
    let litCount = 0;
    let lampCount = 0;
    for (let i = 0; i < n * n; i++) {
      if (cells[i] !== WHITE || !lamps[i]) continue;
      lampCount++;
      lit[i] = 1;
      for (const j of sees[i]) {
        lit[j] = 1;
        if (lamps[j]) badLamps.add(i);
      }
    }
    let cluesOk = true;
    for (let i = 0; i < n * n; i++) {
      if (cells[i] === WHITE) {
        whites++;
        if (lit[i]) litCount++;
        continue;
      }
      if (cells[i] < 0) continue;
      const around = orthogonal(n, i).reduce((sum, j) => sum + (cells[j] === WHITE && lamps[j] ? 1 : 0), 0);
      if (around > cells[i]) badWalls.add(i);
      if (around === cells[i]) metWalls.add(i);
      else cluesOk = false;
    }
    return {
      lit,
      whites,
      litCount,
      lampCount,
      badLamps,
      badWalls,
      metWalls,
      solved: litCount === whites && badLamps.size === 0 && cluesOk,
    };
  }

  function sizeOf(value) {
    return Number(value) === 10 ? 10 : 7;
  }

  if (typeof document === "undefined") {
    globalThis.__akari = { makePuzzle, countSolutions, solve, inspect, WHITE, WALL };
    return;
  }

  const settings = GameSettings.mount({
    id: "akari",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board.",
        type: "choice",
        default: "7",
        options: [
          { value: "7", label: "7×7" },
          { value: "10", label: "10×10" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark lamps that shine on each other and numbers with too many lamps.",
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
    lit: document.getElementById("lit"),
    lamps: document.getElementById("lamps"),
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
    n: 7,
    puzzle: null,
    marks: new Uint8Array(0),
    focus: -1,
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

  function lampGrid() {
    return state.marks.map((mark) => (mark === 1 ? 1 : 0));
  }

  function paint() {
    if (!state.puzzle) return false;
    const { n, cells } = state.puzzle;
    const report = inspect(state.puzzle, lampGrid());
    const show = settings.values.conflicts !== false;
    for (const node of els.board.children) {
      const i = Number(node.dataset.index);
      const where = `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
      if (cells[i] !== WHITE) {
        const bad = show && report.badWalls.has(i);
        node.classList.toggle("is-bad", bad);
        node.classList.toggle("is-met", cells[i] >= 0 && report.metWalls.has(i));
        node.setAttribute("aria-label", cells[i] >= 0 ? `${where}, wall ${cells[i]}${bad ? ", too many lamps" : ""}` : `${where}, wall`);
        continue;
      }
      const mark = state.marks[i];
      const bad = show && mark === 1 && report.badLamps.has(i);
      node.classList.toggle("is-lit", Boolean(report.lit[i]));
      node.classList.toggle("is-lamp", mark === 1);
      node.classList.toggle("is-dot", mark === 2);
      node.classList.toggle("is-bad", bad);
      const what = mark === 1 ? (bad ? "lamp, lit by another lamp" : "lamp") : mark === 2 ? "marked no lamp" : "empty";
      node.setAttribute("aria-label", `${where}, ${what}, ${report.lit[i] ? "lit" : "dark"}`);
    }
    els.lit.textContent = `${report.litCount}/${report.whites}`;
    els.lamps.textContent = String(report.lampCount);
    return report.solved;
  }

  function render() {
    const { n, cells } = state.puzzle;
    els.board.style.setProperty("--n", String(n));
    els.board.setAttribute("aria-label", `Akari board, ${n} by ${n}`);
    els.board.replaceChildren();
    state.focus = cells.indexOf(WHITE);
    for (let i = 0; i < n * n; i++) {
      let node;
      if (cells[i] === WHITE) {
        node = document.createElement("button");
        node.type = "button";
        node.className = "ak-cell";
        node.tabIndex = i === state.focus ? 0 : -1;
        node.addEventListener("click", () => cycle(i));
      } else {
        node = document.createElement("div");
        node.className = "ak-wall";
        node.setAttribute("role", "img");
        node.textContent = cells[i] >= 0 ? String(cells[i]) : "";
      }
      node.dataset.index = String(i);
      els.board.append(node);
    }
    paint();
  }

  function focusCell(next) {
    const nodes = els.board.children;
    if (!nodes[next] || state.puzzle.cells[next] !== WHITE) return;
    if (nodes[state.focus]) nodes[state.focus].tabIndex = -1;
    state.focus = next;
    nodes[next].tabIndex = 0;
    nodes[next].focus();
  }

  function onKey(event) {
    if (state.phase !== "play" || state.focus < 0) return;
    const steps = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const { n, cells } = state.puzzle;
    let r = Math.floor(state.focus / n) + step[0];
    let c = (state.focus % n) + step[1];
    while (r >= 0 && c >= 0 && r < n && c < n) {
      if (cells[r * n + c] === WHITE) { focusCell(r * n + c); return; }
      r += step[0];
      c += step[1];
    }
  }

  function cycle(i) {
    if (state.phase !== "play") return;
    const nodes = els.board.children;
    if (nodes[state.focus] && state.focus !== i) nodes[state.focus].tabIndex = -1;
    state.focus = i;
    nodes[i].tabIndex = 0;
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
    state.puzzle = null;
    state.marks = new Uint8Array(0);
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.lit.textContent = "0";
    els.lamps.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.board.replaceChildren();
    els.board.hidden = true;
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Light every white cell. Next board: ${state.n}×${state.n}.`);
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
    state.puzzle = null;
    state.record = false;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.lit.textContent = "0";
    els.lamps.textContent = "0";
    els.summary.hidden = true;
    els.board.replaceChildren();
    els.board.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${n}×${n} board…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n, n >= 10 ? 3000 : 1500);
      if (token !== state.token) return;
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
      setStatus("Tap a white cell: lamp, then dot for no lamp, then clear.");
      render();
      tick();
    }, 30);
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
      ? `Lit the ${state.n}×${state.n} board in ${clock}. New best.`
      : `Lit the ${state.n}×${state.n} board in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Every cell is lit and every number matches.", "ok");
    els.again.focus();
  }

  showIdle();
  els.board.addEventListener("keydown", onKey);
  els.start.addEventListener("click", begin);
  els.clear.addEventListener("click", clearBoard);
  els.again.addEventListener("click", begin);
})();
