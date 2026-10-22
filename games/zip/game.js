(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.zip.best";
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
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

  function sizeOf(value) {
    const n = Number(value);
    return n === 5 || n === 7 ? n : 6;
  }

  function clueCount(n) {
    if (n === 5) return 8;
    if (n === 7) return 5;
    return 6;
  }

  function findPath(n) {
    const total = n * n;

    function neighbors(index, used) {
      const row = (index / n) | 0;
      const col = index % n;
      const list = [];
      for (const [dr, dc] of DIRS) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= n || nextCol >= n) continue;
        const next = nextRow * n + nextCol;
        if (!used[next]) list.push(next);
      }
      return list;
    }

    for (let attempt = 0; attempt < 16; attempt++) {
      const used = new Array(total).fill(false);
      const path = [];
      let nodes = 0;
      const start = Math.floor(Math.random() * total);
      used[start] = true;
      path.push(start);

      function search() {
        if (path.length === total) return true;
        if (++nodes > 12000) return false;
        const options = neighbors(path[path.length - 1], used);
        shuffle(options);
        options.sort((a, b) => neighbors(a, used).length - neighbors(b, used).length);
        for (const next of options) {
          used[next] = true;
          path.push(next);
          if (search()) return true;
          path.pop();
          used[next] = false;
        }
        return false;
      }

      if (search()) return path;
    }
    return null;
  }

  function clueIndexes(length, clues) {
    const indexes = [0];
    const gaps = clues - 1;
    for (let i = 1; i < gaps; i++) {
      const base = Math.round(((length - 1) * i) / gaps);
      const jitter = Math.floor(Math.random() * 3) - 1;
      const min = indexes[i - 1] + 1;
      const max = length - 1 - (gaps - i);
      indexes.push(Math.max(min, Math.min(max, base + jitter)));
    }
    indexes.push(length - 1);
    return indexes;
  }

  function makePuzzle(level) {
    const n = sizeOf(level);
    const clues = clueCount(n);
    for (let attempt = 0; attempt < 8; attempt++) {
      const path = findPath(n);
      if (!path) continue;
      const numbers = new Array(n * n).fill(0);
      clueIndexes(path.length, clues).forEach((at, index) => {
        numbers[path[at]] = index + 1;
      });
      return { n, numbers, clues, path };
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__zip = { makePuzzle, findPath };
    return;
  }

  const settings = GameSettings.mount({
    id: "zip",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "How wide the next board is. Bigger boards have fewer numbered stops.",
        type: "choice",
        default: "6",
        options: [
          { value: "5", label: "5×5" },
          { value: "6", label: "6×6" },
          { value: "7", label: "7×7" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
    },
  });

  const els = {
    next: document.getElementById("next"),
    filled: document.getElementById("filled"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    line: document.getElementById("line"),
    dot: document.getElementById("dot"),
    tools: document.getElementById("tools"),
    undo: document.getElementById("undo-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    n: 6,
    numbers: [],
    clues: 0,
    path: [],
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
    token: 0,
    drawing: false,
  };

  const cells = [];

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function readBest(size) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${size}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(size, ms) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${size}`, String(ms));
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

  function adjacent(a, b) {
    const n = state.n;
    const row = Math.abs(((a / n) | 0) - ((b / n) | 0));
    const col = Math.abs((a % n) - (b % n));
    return row + col === 1;
  }

  function seenNumber() {
    let seen = 0;
    for (const index of state.path) {
      const value = state.numbers[index];
      if (value > seen) seen = value;
    }
    return seen;
  }

  function nextNumber() {
    return seenNumber() + 1;
  }

  function canStep(index) {
    const value = state.numbers[index];
    return !value || value === nextNumber();
  }

  function progressText() {
    const next = nextNumber();
    if (next > state.clues) return "Fill every remaining cell.";
    return `Next number is ${next}.`;
  }

  function buildBoard(n) {
    els.grid.replaceChildren();
    els.board.style.setProperty("--n", String(n));
    cells.length = 0;
    for (let row = 0; row < n; row++) {
      const line = document.createElement("div");
      line.className = "grid__row";
      line.setAttribute("role", "row");
      for (let col = 0; col < n; col++) {
        const index = row * n + col;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.setAttribute("role", "gridcell");
        cells.push(button);
        line.append(button);
      }
      els.grid.append(line);
    }
  }

  function render() {
    const n = state.n;
    const head = state.path[state.path.length - 1];
    const onPath = new Set(state.path);
    const next = nextNumber();
    const playing = state.phase === "play";

    for (let i = 0; i < cells.length; i++) {
      const button = cells[i];
      const value = state.numbers[i] || 0;
      const selected = i === head;
      button.classList.toggle("is-path", onPath.has(i));
      button.classList.toggle("is-head", selected);
      button.classList.toggle("is-next", value > 0 && value === next && next <= state.clues);
      button.disabled = !playing;
      button.tabIndex = selected && playing ? 0 : -1;
      button.dataset.number = value ? String(value) : "";

      const where = `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}`;
      const bits = [where];
      if (value) bits.push(`number ${value}`);
      if (onPath.has(i)) bits.push("on the path");
      else bits.push("empty");
      button.setAttribute("aria-label", bits.join(", "));

      button.replaceChildren();
      if (value) {
        const badge = document.createElement("span");
        badge.className = "num";
        badge.textContent = String(value);
        badge.setAttribute("aria-hidden", "true");
        button.append(badge);
      }
    }

    const placed = state.path.length;
    const total = n * n || 0;
    els.filled.textContent = total ? `${placed}/${total}` : "0";
    els.next.textContent = state.phase === "idle" || next > state.clues ? "—" : String(next);
    els.undo.disabled = state.path.length <= 1;
    layout();
  }

  function layout() {
    if (!cells.length || !state.path.length) {
      els.line.setAttribute("points", "");
      els.dot.setAttribute("r", "0");
      return;
    }
    const board = els.board.getBoundingClientRect();
    els.trail.setAttribute("viewBox", `0 0 ${board.width} ${board.height}`);
    const points = state.path.map((index) => {
      const rect = cells[index].getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - board.left,
        y: rect.top + rect.height / 2 - board.top,
      };
    });
    const width = cells[state.path[0]].getBoundingClientRect().width;
    els.line.style.strokeWidth = String(Math.max(8, width * 0.34));
    els.line.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    const end = points[points.length - 1];
    els.dot.setAttribute("cx", String(end.x));
    els.dot.setAttribute("cy", String(end.y));
    els.dot.setAttribute("r", points.length === 1 ? String(width * 0.17) : "0");
  }

  function visit(index) {
    if (state.phase !== "play" || index < 0) return;
    const at = state.path.indexOf(index);
    if (at !== -1) {
      if (at < state.path.length - 1) {
        state.path.length = at + 1;
        setStatus(progressText());
        render();
      }
      return;
    }
    const head = state.path[state.path.length - 1];
    if (!adjacent(head, index)) return;
    if (!canStep(index)) {
      setStatus(`Reach ${nextNumber()} next.`, "bad");
      return;
    }
    state.path.push(index);
    if (state.path.length === state.n * state.n) finish();
    else {
      setStatus(progressText());
      render();
    }
  }

  function undo() {
    if (state.phase !== "play" || state.path.length <= 1) return;
    state.path.pop();
    setStatus(progressText());
    render();
  }

  function indexAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const cell = hit && hit.closest ? hit.closest(".cell") : null;
    if (!cell || !els.board.contains(cell)) return -1;
    return cells.indexOf(cell);
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
    state.numbers = [];
    state.clues = 0;
    state.path = [];
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.filled.textContent = "0";
    els.next.textContent = "—";
    els.tools.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    els.grid.replaceChildren();
    cells.length = 0;
    els.line.setAttribute("points", "");
    els.dot.setAttribute("r", "0");
    showBest(state.n);
    setStatus(`Draw through every cell in order. Next board: ${state.n}×${state.n}.`);
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
    setStatus(`Building a ${n}×${n} path…`);

    window.setTimeout(() => {
      if (token !== state.token) return;
      const made = makePuzzle(n);
      if (!made) {
        state.phase = "idle";
        els.start.disabled = false;
        setStatus("Could not build a path. Try again.", "bad");
        return;
      }
      state.phase = "play";
      state.n = made.n;
      state.numbers = made.numbers;
      state.clues = made.clues;
      state.record = false;
      state.path = [made.numbers.indexOf(1)];
      state.started = Date.now();
      state.elapsed = 0;
      els.tools.hidden = false;
      els.start.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New board";
      els.time.textContent = "0:00";
      showBest(made.n);
      buildBoard(made.n);
      setStatus(progressText());
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    state.drawing = false;
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
      ? `Connected the ${state.n}×${state.n} board in ${clock}. New best.`
      : `Connected the ${state.n}×${state.n} board in ${clock}. Best is ${best}.`;
    setStatus("Connected.", "ok");
    render();
    els.again.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (state.phase !== "play" || !state.path.length) return;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      const head = state.path[state.path.length - 1];
      const row = ((head / state.n) | 0) + moves[event.key][0];
      const col = (head % state.n) + moves[event.key][1];
      if (row < 0 || col < 0 || row >= state.n || col >= state.n) return;
      visit(row * state.n + col);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      undo();
    }
  }

  function onPointerDown(event) {
    if (state.phase !== "play" || event.button !== 0) return;
    const index = indexAt(event.clientX, event.clientY);
    if (index < 0) return;
    state.drawing = true;
    els.board.setPointerCapture(event.pointerId);
    event.preventDefault();
    visit(index);
  }

  function onPointerMove(event) {
    if (!state.drawing) return;
    visit(indexAt(event.clientX, event.clientY));
  }

  function onPointerUp() {
    state.drawing = false;
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.undo.addEventListener("click", undo);
  els.board.addEventListener("pointerdown", onPointerDown);
  els.board.addEventListener("pointermove", onPointerMove);
  els.board.addEventListener("pointerup", onPointerUp);
  els.board.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("keydown", onKey);
  new ResizeObserver(() => layout()).observe(els.board);
})();
