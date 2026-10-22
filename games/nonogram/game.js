(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.nonogram.best";

  function cluesOf(line) {
    const clue = [];
    let run = 0;
    for (const cell of line) {
      if (cell) run++;
      else if (run) {
        clue.push(run);
        run = 0;
      }
    }
    if (run) clue.push(run);
    return clue.length ? clue : [0];
  }

  function placements(clue, length) {
    const blocks = clue[0] === 0 ? [] : clue;
    const rows = [];
    const row = Array(length).fill(0);
    function place(block, start) {
      if (block === blocks.length) {
        for (let i = start; i < length; i++) row[i] = 0;
        rows.push(row.join(""));
        return;
      }
      const rest = blocks.slice(block).reduce((sum, n) => sum + n, 0) + (blocks.length - block - 1);
      for (let at = start; at <= length - rest; at++) {
        for (let i = start; i < at; i++) row[i] = 0;
        for (let i = 0; i < blocks[block]; i++) row[at + i] = 1;
        if (block < blocks.length - 1) {
          row[at + blocks[block]] = 0;
          place(block + 1, at + blocks[block] + 1);
        } else place(block + 1, at + blocks[block]);
      }
    }
    place(0, 0);
    return rows;
  }

  function fits(options, line) {
    return options.some((option) => option.split("").every((bit, i) => line[i] === 0 || line[i] === (bit === "1" ? 1 : 2)));
  }

  function countSolutions(rows, cols, limit, deadline) {
    const h = rows.length;
    const w = cols.length;
    const rowOpts = rows.map((clue) => placements(clue, w));
    const colOpts = cols.map((clue) => placements(clue, h));
    const grid = Array.from({ length: h }, () => Array(w).fill(0));
    let found = 0;
    let aborted = false;
    function search(cell) {
      if (found >= limit) return;
      if (Date.now() > deadline) { aborted = true; return; }
      if (cell === h * w) { found++; return; }
      const r = Math.floor(cell / w);
      const c = cell % w;
      for (const value of [1, 2]) {
        grid[r][c] = value;
        if (fits(rowOpts[r], grid[r]) && fits(colOpts[c], grid.map((line) => line[c]))) search(cell + 1);
        if (found >= limit || aborted) break;
      }
      grid[r][c] = 0;
    }
    search(0);
    return aborted ? -1 : found;
  }

  function makePuzzle(n, budget) {
    const deadline = Date.now() + budget;
    let tries = 0;
    while (Date.now() < deadline && tries < 30) {
      tries++;
      const grid = Array.from({ length: n }, () => Array(n).fill(0));
      const blobs = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < blobs; i++) {
        const h = 1 + Math.floor(Math.random() * Math.max(2, Math.floor(n / 2)));
        const w = 1 + Math.floor(Math.random() * Math.max(2, Math.floor(n / 2)));
        const r = Math.floor(Math.random() * (n - h + 1));
        const c = Math.floor(Math.random() * (n - w + 1));
        for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) if (Math.random() < 0.82) grid[rr][cc] = 1;
      }
      if (!grid.some((row) => row.some(Boolean))) continue;
      const rowClues = grid.map(cluesOf);
      const colClues = grid[0].map((_, c) => cluesOf(grid.map((row) => row[c])));
      if (countSolutions(rowClues, colClues, 2, deadline) === 1) return { rows: rowClues, cols: colClues };
    }
    return null;
  }

  function sizeOf(value) {
    const n = Number(value);
    return n === 5 || n === 10 ? n : 8;
  }

  if (typeof document === "undefined") {
    globalThis.__nonogram = { makePuzzle, countSolutions, cluesOf };
    return;
  }

  const settings = GameSettings.mount({
    id: "nonogram",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next picture.",
        type: "choice",
        default: "8",
        options: [
          { value: "5", label: "5×5" },
          { value: "8", label: "8×8" },
          { value: "10", label: "10×10" },
        ],
      },
    ],
    onChange() { if (state.phase === "idle") showIdle(); },
  });

  const els = {
    rowsMet: document.getElementById("rows-met"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    sheet: document.getElementById("sheet"),
    cols: document.getElementById("cols"),
    rowClues: document.getElementById("row-clues"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = { phase: "idle", token: 0, n: 8, rows: [], cols: [], marks: [], started: 0, elapsed: 0, record: false, clock: 0 };

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
  function sameClue(line, clue) {
    return cluesOf(line.map((cell) => cell === 1)).join() === clue.join();
  }
  function tooFull(line, clue) {
    const filled = line.filter((cell) => cell === 1).length;
    const need = clue[0] === 0 ? 0 : clue.reduce((sum, n) => sum + n, 0);
    return filled > need;
  }

  function paint() {
    const n = state.n;
    let rowsMet = 0;
    let colsMet = 0;
    for (let r = 0; r < n; r++) {
      const met = sameClue(state.marks[r], state.rows[r]);
      if (met) rowsMet++;
      const rowClue = els.rowClues.children[r];
      rowClue.classList.toggle("is-met", met);
      rowClue.classList.toggle("is-bad", !met && tooFull(state.marks[r], state.rows[r]));
    }
    for (let c = 0; c < n; c++) {
      const line = state.marks.map((row) => row[c]);
      const met = sameClue(line, state.cols[c]);
      if (met) colsMet++;
      const colClue = els.cols.children[c];
      colClue.classList.toggle("is-met", met);
      colClue.classList.toggle("is-bad", !met && tooFull(line, state.cols[c]));
    }
    for (const button of els.grid.querySelectorAll(".cell")) {
      const mark = state.marks[button.dataset.r][button.dataset.c];
      button.classList.toggle("is-on", mark === 1);
      button.classList.toggle("is-mark", mark === 2);
      button.textContent = mark === 2 ? "×" : "";
    }
    els.rowsMet.textContent = `${rowsMet}/${n}`;
    return rowsMet === n && colsMet === n;
  }

  function render() {
    const n = state.n;
    els.sheet.style.setProperty("--n", String(n));
    els.cols.replaceChildren();
    els.rowClues.replaceChildren();
    els.grid.replaceChildren();
    for (let c = 0; c < n; c++) {
      const item = document.createElement("div");
      item.className = "clue-col";
      item.textContent = "";
      for (const number of state.cols[c]) {
        const span = document.createElement("span");
        span.textContent = String(number);
        item.append(span);
      }
      els.cols.append(item);
    }
    for (let r = 0; r < n; r++) {
      const item = document.createElement("div");
      item.className = "clue-row";
      item.textContent = state.rows[r].join(" ");
      els.rowClues.append(item);
      for (let c = 0; c < n; c++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.r = String(r);
        button.dataset.c = String(c);
        button.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
        button.addEventListener("click", () => toggle(r, c));
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
    els.rowsMet.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.cols.replaceChildren();
    els.rowClues.replaceChildren();
    els.grid.replaceChildren();
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Match the block lengths. Next picture: ${state.n}×${state.n}.`);
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
    setStatus(`Building the ${n}×${n} picture…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n, n >= 10 ? 2500 : 1500);
      if (token !== state.token) return;
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair picture. Try again.", "bad");
        return;
      }
      state.rows = puzzle.rows;
      state.cols = puzzle.cols;
      state.marks = Array.from({ length: n }, () => Array(n).fill(0));
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New picture";
      setStatus("Click a cell to fill it. Click again to mark it empty.");
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    if (!readBest() || state.elapsed < readBest()) {
      state.record = true;
      writeBest(state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    els.best.textContent = formatTime(readBest());
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Finished the ${state.n}×${state.n} picture in ${clock}. New best.`
      : `Finished the ${state.n}×${state.n} picture in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Picture complete.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
