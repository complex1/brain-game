(() => {
  "use strict";

  const LEVELS = {
    beginner: { rows: 9, cols: 9, mines: 10, name: "Beginner" },
    intermediate: { rows: 16, cols: 16, mines: 40, name: "Intermediate" },
    expert: { rows: 16, cols: 24, mines: 99, name: "Expert" },
  };

  function neighbours(index, rows, cols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const list = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) list.push(r * cols + c);
      }
    }
    return list;
  }

  /* Returns an array of 0/1 (1 = mine). The safe cell and its neighbours never
     hold a mine when the board has room for that; otherwise only the safe cell is spared. */
  function makeField(rows, cols, mines, safeIndex, random) {
    const rnd = typeof random === "function" ? random : Math.random;
    const total = rows * cols;
    const hasSafe = Number.isInteger(safeIndex) && safeIndex >= 0 && safeIndex < total;
    let blocked = new Set();
    if (hasSafe) {
      blocked = new Set(neighbours(safeIndex, rows, cols));
      blocked.add(safeIndex);
      if (total - blocked.size < mines) blocked = new Set([safeIndex]);
    }
    const pool = [];
    for (let i = 0; i < total; i += 1) {
      if (!blocked.has(i)) pool.push(i);
    }
    const count = Math.min(mines, pool.length);
    const field = new Array(total).fill(0);
    for (let placed = 0; placed < count; placed += 1) {
      const pick = placed + Math.floor(rnd() * (pool.length - placed));
      const held = pool[pick];
      pool[pick] = pool[placed];
      pool[placed] = held;
      field[held] = 1;
    }
    return field;
  }

  function countAdjacent(field, rows, cols, index) {
    let count = 0;
    for (const n of neighbours(index, rows, cols)) count += field[n];
    return count;
  }

  /* Reveals `start` and, through empty (0) cells, everything connected to it.
     Flagged cells and mines are never revealed. Mutates `revealed`, returns the new indices. */
  function floodReveal(field, rows, cols, start, revealed, flagged) {
    const opened = [];
    if (revealed[start] || (flagged && flagged[start]) || field[start]) return opened;
    revealed[start] = true;
    opened.push(start);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      if (countAdjacent(field, rows, cols, current) !== 0) continue;
      for (const n of neighbours(current, rows, cols)) {
        if (revealed[n] || (flagged && flagged[n]) || field[n]) continue;
        revealed[n] = true;
        opened.push(n);
        stack.push(n);
      }
    }
    return opened;
  }

  if (typeof document === "undefined") {
    globalThis.__minesweeper = { LEVELS, neighbours, makeField, countAdjacent, floodReveal };
    return;
  }

  const BEST_PREFIX = "mental-game.minesweeper.best";
  const LONG_PRESS_MS = 500;
  const FLAG = "⚑";
  const MINE = "✸";

  const settings = GameSettings.mount({
    id: "minesweeper",
    fields: [
      {
        id: "level",
        label: "Level",
        hint: "Board size and mine count. Applies to the next game.",
        type: "choice",
        default: "beginner",
        options: [
          { value: "beginner", label: "Beginner 9×9, 10 mines" },
          { value: "intermediate", label: "Intermediate 16×16, 40 mines" },
          { value: "expert", label: "Expert 24×16, 99 mines" },
        ],
      },
      {
        id: "chording",
        label: "Chording",
        hint: "Tap a number whose flags match it to reveal the other neighbours.",
        type: "toggle",
        default: true,
      },
      {
        id: "flagButton",
        label: "Flag mode button",
        hint: "Show a button that switches taps between reveal and flag. Useful on touch screens.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      applyFlagButton();
      if (state.phase === "ready") begin();
    },
  });

  const els = {
    mines: document.getElementById("mines"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    summaryTitle: document.getElementById("summary-title"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    board: document.getElementById("board"),
    flagBtn: document.getElementById("flag-btn"),
    newBtn: document.getElementById("new-btn"),
  };

  const state = {
    phase: "ready",
    level: "beginner",
    rows: 9,
    cols: 9,
    mines: 10,
    field: null,
    revealed: [],
    flagged: [],
    revealedCount: 0,
    flags: 0,
    hit: -1,
    cells: [],
    focusIndex: 0,
    flagMode: false,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  const press = { timer: 0, index: -1, x: 0, y: 0, long: false };
  let lastPointer = "mouse";

  function levelFromSettings() {
    const value = settings.values.level;
    return Object.prototype.hasOwnProperty.call(LEVELS, value) ? value : "beginner";
  }

  function chordingOn() {
    return settings.values.chording !== false;
  }

  function flagButtonOn() {
    return settings.values.flagButton !== false;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function readBest(level) {
    try {
      const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${level}`));
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(level, ms) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${level}`, String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function paintHud() {
    els.mines.textContent = String(state.mines - state.flags);
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.level);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function active() {
    return state.phase === "ready" || state.phase === "play";
  }

  function cellLabel(index) {
    const row = Math.floor(index / state.cols) + 1;
    const col = (index % state.cols) + 1;
    const where = `Row ${row}, column ${col}`;
    const over = state.phase === "won" || state.phase === "lost";
    if (over && state.field) {
      if (state.flagged[index] && !state.field[index]) return `${where}, wrong flag`;
      if (state.field[index] && !state.flagged[index]) {
        return index === state.hit ? `${where}, mine, exploded` : `${where}, mine`;
      }
    }
    if (state.flagged[index]) return `${where}, flagged`;
    if (!state.revealed[index]) return `${where}, hidden`;
    const count = countAdjacent(state.field, state.rows, state.cols, index);
    return count === 0 ? `${where}, empty` : `${where}, ${count} adjacent ${count === 1 ? "mine" : "mines"}`;
  }

  function paintCell(index) {
    const cell = state.cells[index];
    const over = state.phase === "won" || state.phase === "lost";
    let className = "cell";
    let text = "";

    if (state.revealed[index]) {
      className += " is-open";
      const count = countAdjacent(state.field, state.rows, state.cols, index);
      if (count > 0) {
        className += ` n${count}`;
        text = String(count);
      }
    } else if (over && state.field && state.flagged[index] && !state.field[index]) {
      className += " is-flag is-wrong";
      text = FLAG;
    } else if (over && state.field && state.field[index] && !state.flagged[index]) {
      className += index === state.hit ? " is-mine is-hit" : " is-mine";
      text = MINE;
    } else if (state.flagged[index]) {
      className += " is-flag";
      text = FLAG;
    }

    cell.className = className;
    cell.textContent = text;
    cell.setAttribute("aria-label", cellLabel(index));
  }

  function paintAll() {
    for (let i = 0; i < state.cells.length; i += 1) paintCell(i);
  }

  function applyFlagButton() {
    const visible = flagButtonOn();
    els.flagBtn.hidden = !visible;
    if (!visible && state.flagMode) setFlagMode(false);
  }

  function setFlagMode(on) {
    state.flagMode = on;
    els.flagBtn.textContent = on ? "Mode: Flag" : "Mode: Reveal";
    els.flagBtn.classList.toggle("is-on", on);
    els.flagBtn.setAttribute("aria-label", `Tap mode: ${on ? "flag" : "reveal"}. Activate to switch.`);
  }

  function buildBoard() {
    els.board.style.setProperty("--cols", String(state.cols));
    els.board.replaceChildren();
    state.cells = [];
    const total = state.rows * state.cols;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(i);
      cell.tabIndex = i === state.focusIndex ? 0 : -1;
      state.cells.push(cell);
      fragment.append(cell);
    }
    els.board.append(fragment);
  }

  function begin() {
    clearInterval(state.clock);
    clearTimeout(press.timer);
    press.long = false;
    const level = levelFromSettings();
    const config = LEVELS[level];
    state.level = level;
    state.rows = config.rows;
    state.cols = config.cols;
    state.mines = config.mines;
    state.phase = "ready";
    state.field = null;
    state.revealed = new Array(config.rows * config.cols).fill(false);
    state.flagged = new Array(config.rows * config.cols).fill(false);
    state.revealedCount = 0;
    state.flags = 0;
    state.hit = -1;
    state.focusIndex = 0;
    state.started = 0;
    state.elapsed = 0;
    state.record = false;
    els.summary.hidden = true;
    buildBoard();
    paintAll();
    paintHud();
    setStatus(
      `${config.name}: ${config.cols}×${config.rows}, ${config.mines} mines. Your first reveal is always safe.`
    );
  }

  function tick() {
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }

  function startRun(safeIndex) {
    state.field = makeField(state.rows, state.cols, state.mines, safeIndex);
    state.phase = "play";
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 250);
    setStatus("Flag mines you are sure about. Clear every other cell.");
  }

  function lose(index) {
    clearInterval(state.clock);
    state.elapsed = Date.now() - state.started;
    state.phase = "lost";
    state.hit = index;
    paintAll();
    paintHud();
    els.summaryTitle.textContent = "Boom";
    els.summaryText.textContent = `You hit a mine after ${formatTime(state.elapsed)}. Mines and wrong flags are marked on the board.`;
    els.summary.hidden = false;
    setStatus("You hit a mine.", "bad");
    els.again.focus();
  }

  function win() {
    clearInterval(state.clock);
    state.elapsed = Date.now() - state.started;
    state.phase = "won";
    for (let i = 0; i < state.field.length; i += 1) {
      if (state.field[i]) state.flagged[i] = true;
    }
    state.flags = state.mines;
    const previous = readBest(state.level);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.level, state.elapsed);
    }
    paintAll();
    paintHud();
    const time = formatTime(state.elapsed);
    els.summaryTitle.textContent = "Field cleared";
    els.summaryText.textContent = state.record
      ? `${LEVELS[state.level].name} cleared in ${time}. New best.`
      : `${LEVELS[state.level].name} cleared in ${time}.`;
    els.summary.hidden = false;
    setStatus("Every safe cell is open.", "ok");
    els.again.focus();
  }

  function checkWin() {
    if (state.revealedCount === state.rows * state.cols - state.mines) {
      win();
      return true;
    }
    return false;
  }

  function openFrom(index) {
    const opened = floodReveal(state.field, state.rows, state.cols, index, state.revealed, state.flagged);
    state.revealedCount += opened.length;
    for (const i of opened) paintCell(i);
  }

  function reveal(index) {
    if (!active() || state.flagged[index] || state.revealed[index]) return;
    if (state.phase === "ready") startRun(index);
    if (state.field[index]) {
      lose(index);
      return;
    }
    openFrom(index);
    if (!checkWin()) paintHud();
  }

  function chord(index) {
    if (state.phase !== "play" || !state.revealed[index] || !chordingOn()) return;
    const around = neighbours(index, state.rows, state.cols);
    const count = countAdjacent(state.field, state.rows, state.cols, index);
    let flagged = 0;
    for (const n of around) if (state.flagged[n]) flagged += 1;
    if (count === 0 || flagged !== count) return;
    let exploded = -1;
    for (const n of around) {
      if (state.flagged[n] || state.revealed[n]) continue;
      if (state.field[n]) {
        if (exploded < 0) exploded = n;
        continue;
      }
      openFrom(n);
    }
    if (exploded >= 0) {
      lose(exploded);
      return;
    }
    if (!checkWin()) paintHud();
  }

  function toggleFlag(index) {
    if (!active() || state.revealed[index]) return;
    state.flagged[index] = !state.flagged[index];
    state.flags += state.flagged[index] ? 1 : -1;
    paintCell(index);
    paintHud();
  }

  function tap(index) {
    if (!active()) return;
    if (state.revealed[index]) {
      chord(index);
    } else if (state.flagMode) {
      toggleFlag(index);
    } else {
      reveal(index);
    }
  }

  function cellOf(event) {
    const cell = event.target.closest(".cell");
    return cell ? Number(cell.dataset.index) : -1;
  }

  function focusCell(index) {
    const previous = state.cells[state.focusIndex];
    if (previous) previous.tabIndex = -1;
    state.focusIndex = index;
    const next = state.cells[index];
    next.tabIndex = 0;
    next.focus();
  }

  els.board.addEventListener("pointerdown", (event) => {
    lastPointer = event.pointerType || "mouse";
    press.long = false;
    clearTimeout(press.timer);
    if (lastPointer === "mouse" || !active()) return;
    const index = cellOf(event);
    if (index < 0) return;
    press.index = index;
    press.x = event.clientX;
    press.y = event.clientY;
    press.timer = setTimeout(() => {
      press.long = true;
      toggleFlag(press.index);
    }, LONG_PRESS_MS);
  });

  els.board.addEventListener("pointermove", (event) => {
    if (!press.timer) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (dx * dx + dy * dy > 100) clearTimeout(press.timer);
  });

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    els.board.addEventListener(type, () => clearTimeout(press.timer));
  }

  els.board.addEventListener("click", (event) => {
    const index = cellOf(event);
    if (index < 0) return;
    if (press.long) {
      press.long = false;
      return;
    }
    state.focusIndex = index;
    for (let i = 0; i < state.cells.length; i += 1) state.cells[i].tabIndex = i === index ? 0 : -1;
    tap(index);
  });

  els.board.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (lastPointer !== "mouse") return;
    const index = cellOf(event);
    if (index >= 0) toggleFlag(index);
  });

  els.board.addEventListener("keydown", (event) => {
    const index = cellOf(event);
    if (index < 0) return;
    press.long = false;
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    let target = -1;
    if (event.key === "ArrowLeft" && col > 0) target = index - 1;
    else if (event.key === "ArrowRight" && col < state.cols - 1) target = index + 1;
    else if (event.key === "ArrowUp" && row > 0) target = index - state.cols;
    else if (event.key === "ArrowDown" && row < state.rows - 1) target = index + state.cols;
    else if (event.key === "Home") target = row * state.cols;
    else if (event.key === "End") target = row * state.cols + state.cols - 1;
    else if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      toggleFlag(index);
      return;
    }
    if (target >= 0) {
      event.preventDefault();
      focusCell(target);
    }
  });

  els.flagBtn.addEventListener("click", () => {
    setFlagMode(!state.flagMode);
    if (active()) setStatus(state.flagMode ? "Flag mode: tap a cell to flag it." : "Reveal mode: tap a cell to open it.");
  });

  els.newBtn.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  setFlagMode(false);
  applyFlagButton();
  begin();
})();
