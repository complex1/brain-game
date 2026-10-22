(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.nurikabe.best";

  function neighbors(n, r, c) {
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < n && cc < n);
  }

  function pack(n) {
    const grid = Array.from({ length: n }, () => Array(n).fill(0));
    const sizes = [];
    let id = 0;
    let filled = 0;
    let misses = 0;
    const target = Math.floor(n * n * 0.48);
    while (filled < target && id < n * 2 && misses < 60) {
      const size = Math.min(target - filled, 1 + Math.floor(Math.random() * 4));
      const seeds = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (grid[r][c]) continue;
        if (neighbors(n, r, c).some(([rr, cc]) => grid[rr][cc] > 0)) continue;
        seeds.push([r, c]);
      }
      if (!seeds.length) break;
      const [sr, sc] = seeds[Math.floor(Math.random() * seeds.length)];
      const cells = [[sr, sc]];
      grid[sr][sc] = id + 1;
      while (cells.length < size) {
        const options = [];
        for (const [r, c] of cells) {
          for (const [rr, cc] of neighbors(n, r, c)) {
            if (grid[rr][cc]) continue;
            if (neighbors(n, rr, cc).some(([ar, ac]) => grid[ar][ac] > 0 && grid[ar][ac] !== id + 1)) continue;
            if (!options.some(([or, oc]) => or === rr && oc === cc)) options.push([rr, cc]);
          }
        }
        if (!options.length) break;
        const pick = options[Math.floor(Math.random() * options.length)];
        grid[pick[0]][pick[1]] = id + 1;
        cells.push(pick);
      }
      if (cells.length !== size) {
        for (const [r, c] of cells) grid[r][c] = 0;
        misses++;
        continue;
      }
      misses = 0;
      id++;
      sizes.push(size);
      filled += size;
    }
    if (sizes.length < 3) return null;
    let sea = 0;
    let start = null;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!grid[r][c]) { sea++; start = [r, c]; }
    if (!start) return null;
    const seen = Array.from({ length: n }, () => Array(n).fill(false));
    const stack = [start];
    seen[start[0]][start[1]] = true;
    let reach = 0;
    while (stack.length) {
      const [r, c] = stack.pop();
      reach++;
      for (const [rr, cc] of neighbors(n, r, c)) if (!grid[rr][cc] && !seen[rr][cc]) {
        seen[rr][cc] = true;
        stack.push([rr, cc]);
      }
    }
    if (reach !== sea) return null;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      if (!grid[r][c] && !grid[r][c + 1] && !grid[r + 1][c] && !grid[r + 1][c + 1]) return null;
    }
    const numbers = Array.from({ length: n }, () => Array(n).fill(0));
    for (let k = 1; k <= sizes.length; k++) {
      const cells = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === k) cells.push([r, c]);
      const [r, c] = cells[Math.floor(Math.random() * cells.length)];
      numbers[r][c] = cells.length;
    }
    return numbers;
  }

  function countSolutions(numbers, limit, deadline) {
    const n = numbers.length;
    const state = numbers.map((row) => row.map((cell) => (cell ? 1 : -1)));
    const cells = [];
    const given = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (numbers[r][c]) given.push([r, c, numbers[r][c]]);
      else cells.push([r, c]);
    }
    let found = 0;
    let aborted = false;
    function island(sr, sc) {
      const seen = Array.from({ length: n }, () => Array(n).fill(false));
      const stack = [[sr, sc]];
      seen[sr][sc] = true;
      let count = 0;
      while (stack.length) {
        const [r, c] = stack.pop();
        count++;
        for (const [rr, cc] of neighbors(n, r, c)) if (state[rr][cc] === 1 && !seen[rr][cc]) {
          seen[rr][cc] = true;
          stack.push([rr, cc]);
        }
      }
      return count;
    }
    function blocked() {
      for (const [r, c, size] of given) if (island(r, c) > size) return true;
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        if (state[r][c] === 0 && state[r][c + 1] === 0 && state[r + 1][c] === 0 && state[r + 1][c + 1] === 0) return true;
      }
      return false;
    }
    function complete() {
      for (const [r, c, size] of given) if (island(r, c) !== size) return false;
      const whites = Array.from({ length: n }, () => Array(n).fill(false));
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (state[r][c] !== 1 || whites[r][c]) continue;
        const stack = [[r, c]];
        whites[r][c] = true;
        let nums = 0;
        while (stack.length) {
          const [rr, cc] = stack.pop();
          if (numbers[rr][cc]) nums++;
          for (const [ar, ac] of neighbors(n, rr, cc)) if (state[ar][ac] === 1 && !whites[ar][ac]) {
            whites[ar][ac] = true;
            stack.push([ar, ac]);
          }
        }
        if (nums !== 1) return false;
      }
      let sea = 0;
      let start = null;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!state[r][c]) { sea++; start = [r, c]; }
      if (!start) return false;
      const seen = Array.from({ length: n }, () => Array(n).fill(false));
      const stack = [start];
      seen[start[0]][start[1]] = true;
      let reach = 0;
      while (stack.length) {
        const [r, c] = stack.pop();
        reach++;
        for (const [rr, cc] of neighbors(n, r, c)) if (!state[rr][cc] && !seen[rr][cc]) {
          seen[rr][cc] = true;
          stack.push([rr, cc]);
        }
      }
      return reach === sea;
    }
    function search(i) {
      if (found >= limit) return;
      if (Date.now() > deadline) { aborted = true; return; }
      if (blocked()) return;
      if (i === cells.length) { if (complete()) found++; return; }
      const [r, c] = cells[i];
      for (const value of [0, 1]) {
        state[r][c] = value;
        search(i + 1);
        if (found >= limit || aborted) break;
      }
      state[r][c] = -1;
    }
    search(0);
    return aborted ? -1 : found;
  }

  function makePuzzle(n, budget) {
    const deadline = Date.now() + budget;
    while (Date.now() < deadline) {
      const numbers = pack(n);
      if (!numbers) continue;
      if (countSolutions(numbers, 2, Math.min(deadline, Date.now() + 400)) === 1) return numbers;
    }
    return null;
  }

  function sizeOf(value) { return Number(value) === 6 ? 6 : 5; }

  if (typeof document === "undefined") {
    globalThis.__nurikabe = { makePuzzle, countSolutions, pack };
    return;
  }

  const settings = GameSettings.mount({
    id: "nurikabe",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board. 6×6 takes longer to build.",
        type: "choice",
        default: "5",
        options: [
          { value: "5", label: "5×5" },
          { value: "6", label: "6×6" },
        ],
      },
    ],
    onChange() { if (state.phase === "idle") showIdle(); },
  });

  const els = {
    shaded: document.getElementById("shaded"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = { phase: "idle", token: 0, n: 5, numbers: [], marks: [], started: 0, elapsed: 0, record: false, clock: 0 };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function readBest() {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${state.n}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  function writeBest(ms) { try { localStorage.setItem(`${BEST_PREFIX}.${state.n}`, String(ms)); } catch { /* still finishes */ } }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function white(r, c) { return !state.numbers[r][c] ? state.marks[r][c] !== 1 : true; }

  function rulesHold() {
    const n = state.n;
    const seen = Array.from({ length: n }, () => Array(n).fill(false));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!white(r, c) || seen[r][c]) continue;
      const stack = [[r, c]];
      seen[r][c] = true;
      let count = 0;
      let nums = 0;
      let size = 0;
      while (stack.length) {
        const [rr, cc] = stack.pop();
        count++;
        if (state.numbers[rr][cc]) { nums++; size = state.numbers[rr][cc]; }
        for (const [ar, ac] of neighbors(n, rr, cc)) if (white(ar, ac) && !seen[ar][ac]) {
          seen[ar][ac] = true;
          stack.push([ar, ac]);
        }
      }
      if (nums !== 1 || count !== size) return false;
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (state.numbers[r][c] && !seen[r][c]) return false;
    let sea = 0;
    let start = null;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!white(r, c)) { sea++; start = [r, c]; }
    if (!start) return false;
    const seaSeen = Array.from({ length: n }, () => Array(n).fill(false));
    const stack = [start];
    seaSeen[start[0]][start[1]] = true;
    let reach = 0;
    while (stack.length) {
      const [r, c] = stack.pop();
      reach++;
      for (const [rr, cc] of neighbors(n, r, c)) if (!white(rr, cc) && !seaSeen[rr][cc]) {
        seaSeen[rr][cc] = true;
        stack.push([rr, cc]);
      }
    }
    if (reach !== sea) return false;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      if (!white(r, c) && !white(r, c + 1) && !white(r + 1, c) && !white(r + 1, c + 1)) return false;
    }
    return true;
  }

  function paint() {
    const n = state.n;
    const bad = new Set();
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      if (!white(r, c) && !white(r, c + 1) && !white(r + 1, c) && !white(r + 1, c + 1)) {
        bad.add(`${r},${c}`); bad.add(`${r},${c + 1}`); bad.add(`${r + 1},${c}`); bad.add(`${r + 1},${c + 1}`);
      }
    }
    let shaded = 0;
    for (const button of els.grid.querySelectorAll(".cell")) {
      const r = Number(button.dataset.r);
      const c = Number(button.dataset.c);
      const mark = state.marks[r][c];
      if (mark === 1) shaded++;
      button.classList.toggle("is-sea", mark === 1);
      button.classList.toggle("is-dot", mark === 2);
      button.classList.toggle("is-bad", bad.has(`${r},${c}`));
      if (!state.numbers[r][c]) button.textContent = mark === 2 ? "·" : "";
    }
    els.shaded.textContent = String(shaded);
    return rulesHold();
  }

  function render() {
    const n = state.n;
    els.grid.style.setProperty("--n", String(n));
    els.grid.replaceChildren();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.r = String(r);
        button.dataset.c = String(c);
        if (state.numbers[r][c]) {
          button.classList.add("is-given");
          button.textContent = String(state.numbers[r][c]);
          button.disabled = true;
          button.setAttribute("aria-label", `Island ${state.numbers[r][c]}`);
        } else {
          button.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
          button.addEventListener("click", () => toggle(r, c));
        }
        els.grid.append(button);
      }
    }
    paint();
  }

  function toggle(r, c) {
    if (state.phase !== "play") return;
    state.marks[r][c] = (state.marks[r][c] + 1) % 3;
    if (paint()) finish();
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.shaded.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.grid.replaceChildren();
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Shade the sea. Next board: ${state.n}×${state.n}.`);
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
    els.summary.hidden = true;
    els.grid.replaceChildren();
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${n}×${n} board…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const numbers = makePuzzle(n, n === 6 ? 4500 : 2000);
      if (token !== state.token) return;
      if (!numbers) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair board. Try again.", "bad");
        return;
      }
      state.numbers = numbers;
      state.marks = Array.from({ length: n }, () => Array(n).fill(0));
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New board";
      setStatus("Click to shade the sea. Click again to dot a cell you want to keep white.");
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
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Finished the ${state.n}×${state.n} board in ${clock}. New best.`
      : `Finished the ${state.n}×${state.n} board in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("The sea is one piece.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
