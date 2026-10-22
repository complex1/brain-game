(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.kakuro.best";
  const MASKS = {
    6: ["######", "#...##", "#...##", "##...#", "##...#", "######"],
    8: ["########", "#..#..##", "#..#..##", "##..#..#", "##..#..#", "#..##..#", "#..##..#", "########"],
  };

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function layoutOf(mask) {
    const n = mask.length;
    const white = [];
    const across = [];
    const down = [];
    for (let r = 0; r < n; r++) {
      let run = [];
      for (let c = 0; c < n; c++) {
        if (mask[r][c] === ".") { white.push([r, c]); run.push([r, c]); }
        else if (run.length) { across.push(run); run = []; }
      }
      if (run.length) across.push(run);
    }
    for (let c = 0; c < n; c++) {
      let run = [];
      for (let r = 0; r < n; r++) {
        if (mask[r][c] === ".") run.push([r, c]);
        else if (run.length) { down.push(run); run = []; }
      }
      if (run.length) down.push(run);
    }
    return { n, mask, white, across, down };
  }

  function combos(length, total, cache) {
    const key = `${length},${total}`;
    if (cache.has(key)) return cache.get(key);
    const out = [];
    function rec(start, left, sum, acc) {
      if (!left) { if (sum === total) out.push(acc.slice()); return; }
      for (let digit = start; digit <= 9; digit++) {
        if (sum + digit > total) break;
        acc.push(digit);
        rec(digit + 1, left - 1, sum + digit, acc);
        acc.pop();
      }
    }
    rec(1, length, 0, []);
    cache.set(key, out);
    return out;
  }

  function countSolutions(layout, sums, limit, deadline) {
    const values = new Map();
    const cache = new Map();
    let found = 0;
    let aborted = false;
    function ok(run, total) {
      const used = [];
      let empty = 0;
      let sum = 0;
      for (const [r, c] of run) {
        const value = values.get(`${r},${c}`);
        if (!value) { empty++; continue; }
        if (used.includes(value)) return false;
        used.push(value);
        sum += value;
      }
      if (sum > total || (!empty && sum !== total)) return false;
      if (!empty) return true;
      return combos(run.length, total, cache).some((combo) => used.every((digit) => combo.includes(digit)));
    }
    function search(i) {
      if (found >= limit) return;
      if (Date.now() > deadline) { aborted = true; return; }
      if (i === layout.white.length) { found++; return; }
      const [r, c] = layout.white[i];
      for (let digit = 1; digit <= 9; digit++) {
        values.set(`${r},${c}`, digit);
        const good = layout.across.every((run) => !run.some(([rr, cc]) => rr === r && cc === c) || ok(run, sums.get(`a,${run[0][0]},${run[0][1] - 1}`)))
          && layout.down.every((run) => !run.some(([rr, cc]) => rr === r && cc === c) || ok(run, sums.get(`d,${run[0][0] - 1},${run[0][1]}`)));
        if (good) search(i + 1);
        if (found >= limit || aborted) break;
      }
      values.delete(`${r},${c}`);
    }
    search(0);
    return aborted ? -1 : found;
  }

  function fill(layout) {
    const values = new Map();
    function taken(run, r, c, digit) {
      return run.some(([rr, cc]) => (rr !== r || cc !== c) && values.get(`${rr},${cc}`) === digit);
    }
    function search(i) {
      if (i === layout.white.length) return true;
      const [r, c] = layout.white[i];
      for (const digit of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if ([...layout.across, ...layout.down].some((run) => run.some(([rr, cc]) => rr === r && cc === c) && taken(run, r, c, digit))) continue;
        values.set(`${r},${c}`, digit);
        if (search(i + 1)) return true;
        values.delete(`${r},${c}`);
      }
      return false;
    }
    if (!search(0)) return null;
    const sums = new Map();
    for (const run of layout.across) sums.set(`a,${run[0][0]},${run[0][1] - 1}`, run.reduce((sum, [r, c]) => sum + values.get(`${r},${c}`), 0));
    for (const run of layout.down) sums.set(`d,${run[0][0] - 1},${run[0][1]}`, run.reduce((sum, [r, c]) => sum + values.get(`${r},${c}`), 0));
    return sums;
  }

  function makePuzzle(size, budget) {
    const deadline = Date.now() + budget;
    const layout = layoutOf(MASKS[size]);
    while (Date.now() < deadline) {
      const sums = fill(layout);
      if (!sums) continue;
      if (countSolutions(layout, sums, 2, deadline) === 1) {
        return { mask: layout.mask, sums: Object.fromEntries(sums) };
      }
    }
    return null;
  }

  function sizeOf(value) { return Number(value) === 8 ? 8 : 6; }

  if (typeof document === "undefined") {
    globalThis.__kakuro = { makePuzzle, countSolutions, layoutOf };
    return;
  }

  const settings = GameSettings.mount({
    id: "kakuro",
    fields: [
      {
        id: "size",
        label: "Board",
        hint: "Applies to the next puzzle.",
        type: "choice",
        default: "6",
        options: [
          { value: "6", label: "6×6" },
          { value: "8", label: "8×8" },
        ],
      },
    ],
    onChange() { if (state.phase === "idle") showIdle(); },
  });

  const els = {
    filled: document.getElementById("filled"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    pad: document.getElementById("pad"),
    padNums: document.getElementById("pad-nums"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = { phase: "idle", token: 0, size: 6, layout: null, sums: new Map(), values: new Map(), selected: null, started: 0, elapsed: 0, record: false, clock: 0 };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function readBest() {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${state.size}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  function writeBest(ms) { try { localStorage.setItem(`${BEST_PREFIX}.${state.size}`, String(ms)); } catch { /* still finishes */ } }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function runState(run, total) {
    const used = [];
    let sum = 0;
    let empty = 0;
    for (const [r, c] of run) {
      const value = state.values.get(`${r},${c}`) || 0;
      if (!value) { empty++; continue; }
      if (used.includes(value)) return "bad";
      used.push(value);
      sum += value;
    }
    if (sum > total || (!empty && sum !== total)) return "bad";
    return empty ? "open" : "met";
  }

  function solved() {
    if (!state.layout) return false;
    const runs = [...state.layout.across.map((run) => [run, state.sums.get(`a,${run[0][0]},${run[0][1] - 1}`)]), ...state.layout.down.map((run) => [run, state.sums.get(`d,${run[0][0] - 1},${run[0][1]}`)])];
    return runs.every(([run, total]) => runState(run, total) === "met");
  }

  function paint() {
    const badCells = new Set();
    if (state.layout) {
      for (const run of [...state.layout.across, ...state.layout.down]) {
        const total = state.layout.across.includes(run)
          ? state.sums.get(`a,${run[0][0]},${run[0][1] - 1}`)
          : state.sums.get(`d,${run[0][0] - 1},${run[0][1]}`);
        if (runState(run, total) !== "bad") continue;
        for (const [r, c] of run) if (state.values.get(`${r},${c}`)) badCells.add(`${r},${c}`);
      }
    }
    for (const button of els.grid.querySelectorAll(".play")) {
      const key = `${button.dataset.r},${button.dataset.c}`;
      button.textContent = state.values.get(key) ? String(state.values.get(key)) : "";
      button.classList.toggle("is-selected", state.selected === key);
      button.classList.toggle("is-bad", badCells.has(key));
    }
    const total = state.layout ? state.layout.white.length : 0;
    els.filled.textContent = total ? `${state.values.size}/${total}` : "0";
    return solved();
  }

  function render() {
    const { mask } = state.layout;
    const n = mask.length;
    els.grid.style.setProperty("--n", String(n));
    els.grid.replaceChildren();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mask[r][c] !== ".") {
          const wall = document.createElement("div");
          wall.className = "wall";
          const down = state.sums.get(`d,${r},${c}`);
          const across = state.sums.get(`a,${r},${c}`);
          if (down) {
            const span = document.createElement("span");
            span.className = "down";
            span.textContent = String(down);
            wall.append(span);
          }
          if (across) {
            const span = document.createElement("span");
            span.className = "across";
            span.textContent = String(across);
            wall.append(span);
          }
          els.grid.append(wall);
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "play";
          button.dataset.r = String(r);
          button.dataset.c = String(c);
          button.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
          button.addEventListener("click", () => {
            if (state.phase !== "play") return;
            state.selected = `${r},${c}`;
            paint();
          });
          els.grid.append(button);
        }
      }
    }
    paint();
  }

  function place(digit) {
    if (state.phase !== "play" || !state.selected) return;
    if (digit) state.values.set(state.selected, digit);
    else state.values.delete(state.selected);
    if (paint()) finish();
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.size = sizeOf(settings.values.size);
    state.layout = null;
    state.values = new Map();
    state.selected = null;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.filled.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.grid.replaceChildren();
    els.pad.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Distinct digits, exact sums. Next board: ${state.size}×${state.size}.`);
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
    const size = sizeOf(settings.values.size);
    state.phase = "building";
    state.size = size;
    state.values = new Map();
    state.selected = null;
    state.record = false;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.pad.hidden = true;
    els.grid.replaceChildren();
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${size}×${size} kakuro…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(size, size === 8 ? 2500 : 2000);
      if (token !== state.token) return;
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair board. Try again.", "bad");
        return;
      }
      state.layout = layoutOf(puzzle.mask);
      state.sums = new Map(Object.entries(puzzle.sums));
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New board";
      els.pad.hidden = false;
      setStatus("Select a cell, then enter 1–9.");
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    if (!readBest() || state.elapsed < readBest()) { state.record = true; writeBest(state.elapsed); }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    els.best.textContent = formatTime(readBest());
    els.pad.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Finished the ${state.size}×${state.size} board in ${clock}. New best.`
      : `Finished the ${state.size}×${state.size} board in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Every run adds up.", "ok");
    els.again.focus();
  }

  for (let digit = 1; digit <= 9; digit++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--ghost";
    button.textContent = String(digit);
    button.addEventListener("click", () => place(digit));
    els.padNums.append(button);
  }
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn btn--ghost";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => place(0));
  els.padNums.append(clear);

  document.addEventListener("keydown", (event) => {
    if (state.phase !== "play") return;
    if (event.key >= "1" && event.key <= "9") place(Number(event.key));
    else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") place(0);
  });

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
