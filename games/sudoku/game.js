(() => {
  "use strict";

  const SIZE = 9;
  const CLUES = { easy: 42, medium: 34, hard: 28 };
  const BEST_PREFIX = "mental-game.sudoku.best";

  /* A valid seed. Band, stack, and digit shuffles keep it a solution. */
  const BASE = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 4, 5, 6, 7, 8, 9, 1, 2, 3, 7, 8, 9, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7, 8, 9, 1, 5, 6,
    7, 8, 9, 1, 2, 3, 4, 8, 9, 1, 2, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 8, 9, 1, 2, 6, 7, 8, 9, 1, 2, 3, 4, 5, 9, 1, 2, 3, 4,
    5, 6, 7, 8,
  ];

  function row(index) {
    return (index / SIZE) | 0;
  }

  function col(index) {
    return index % SIZE;
  }

  function boxOf(index) {
    return ((row(index) / 3) | 0) * 3 + ((col(index) / 3) | 0);
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function bandOrder() {
    const bands = shuffle([0, 1, 2]);
    const order = [];
    for (const band of bands) {
      for (const offset of shuffle([0, 1, 2])) order.push(band * 3 + offset);
    }
    return order;
  }

  function solvedBoard() {
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const rows = bandOrder();
    const cols = bandOrder();
    const board = new Array(81);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        board[r * SIZE + c] = digits[BASE[rows[r] * SIZE + cols[c]] - 1];
      }
    }
    if (Math.random() < 0.5) {
      const transposed = new Array(81);
      for (let i = 0; i < 81; i++) transposed[col(i) * SIZE + row(i)] = board[i];
      return transposed;
    }
    return board;
  }

  function bitCount(mask) {
    let count = 0;
    let bits = mask;
    while (bits) {
      bits &= bits - 1;
      count++;
    }
    return count;
  }

  function masksOf(board) {
    const rows = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const cols = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const boxes = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 81; i++) {
      if (!board[i]) continue;
      const bit = 1 << (board[i] - 1);
      rows[row(i)] |= bit;
      cols[col(i)] |= bit;
      boxes[boxOf(i)] |= bit;
    }
    return { rows, cols, boxes };
  }

  function countSolutions(puzzle, limit) {
    const board = puzzle.slice();
    const { rows, cols, boxes } = masksOf(board);
    let found = 0;

    function search() {
      if (found >= limit) return;
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (board[i]) continue;
        const mask = (~(rows[row(i)] | cols[col(i)] | boxes[boxOf(i)])) & 0x1ff;
        const count = bitCount(mask);
        if (count === 0) return;
        if (count < bestCount) {
          best = i;
          bestMask = mask;
          bestCount = count;
          if (count === 1) break;
        }
      }
      if (best === -1) {
        found++;
        return;
      }
      const r = row(best);
      const c = col(best);
      const b = boxOf(best);
      let mask = bestMask;
      while (mask) {
        const bit = mask & -mask;
        mask ^= bit;
        board[best] = 32 - Math.clz32(bit);
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        search();
        rows[r] ^= bit;
        cols[c] ^= bit;
        boxes[b] ^= bit;
        board[best] = 0;
        if (found >= limit) return;
      }
    }

    search();
    return found;
  }

  function makePuzzle(level) {
    const solved = solvedBoard();
    const puzzle = solved.slice();
    const masks = masksOf(puzzle);
    const target = CLUES[level] || CLUES.medium;
    let filled = 81;

    for (const index of shuffle([...Array(81).keys()])) {
      if (filled <= target) break;
      const value = puzzle[index];
      const bit = 1 << (value - 1);
      const r = row(index);
      const c = col(index);
      const b = boxOf(index);
      puzzle[index] = 0;
      masks.rows[r] ^= bit;
      masks.cols[c] ^= bit;
      masks.boxes[b] ^= bit;
      const options = (~(masks.rows[r] | masks.cols[c] | masks.boxes[b])) & 0x1ff;
      const unique = bitCount(options) === 1 || countSolutions(puzzle, 2) === 1;
      if (unique) {
        filled--;
      } else {
        puzzle[index] = value;
        masks.rows[r] |= bit;
        masks.cols[c] |= bit;
        masks.boxes[b] |= bit;
      }
    }

    return { puzzle, solved, level };
  }

  if (typeof document === "undefined") {
    globalThis.__sudoku = { makePuzzle, countSolutions, BASE };
    return;
  }

  const settings = GameSettings.mount({
    id: "sudoku",
    fields: [
      {
        id: "level",
        label: "Difficulty",
        hint: "How full the next grid starts. Easy keeps more digits.",
        type: "choice",
        default: "medium",
        options: [
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ],
      },
      {
        id: "conflicts",
        label: "Show conflicts",
        hint: "Mark digits that repeat in a row, column, or box.",
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
    filled: document.getElementById("filled"),
    mistakes: document.getElementById("mistakes"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    pad: document.getElementById("pad"),
    padNums: document.getElementById("pad-nums"),
    notes: document.getElementById("notes-btn"),
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    level: settings.values.level,
    puzzle: new Array(81).fill(0),
    values: new Array(81).fill(0),
    notes: new Array(81).fill(0),
    selected: -1,
    notesMode: false,
    mistakes: 0,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
    token: 0,
  };

  const cells = [];

  function levelName(level) {
    if (level === "easy") return "Easy";
    if (level === "hard") return "Hard";
    return "Medium";
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function bestKey(level) {
    return `${BEST_PREFIX}.${level}`;
  }

  function readBest(level) {
    const stored = Number(localStorage.getItem(bestKey(level)));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(level, ms) {
    try {
      localStorage.setItem(bestKey(level), String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest(level) {
    const best = readBest(level);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
  }

  function conflictSet() {
    const bad = new Set();
    for (let i = 0; i < 81; i++) {
      const value = state.values[i];
      if (!value) continue;
      for (let j = i + 1; j < 81; j++) {
        if (state.values[j] !== value) continue;
        if (row(i) === row(j) || col(i) === col(j) || boxOf(i) === boxOf(j)) {
          bad.add(i);
          bad.add(j);
        }
      }
    }
    return bad;
  }

  function cellConflicts(index) {
    const value = state.values[index];
    if (!value) return false;
    for (let j = 0; j < 81; j++) {
      if (j === index || state.values[j] !== value) continue;
      if (row(index) === row(j) || col(index) === col(j) || boxOf(index) === boxOf(j)) return true;
    }
    return false;
  }

  function filledCount() {
    let count = 0;
    for (const value of state.values) if (value) count++;
    return count;
  }

  function isSolved() {
    return filledCount() === 81 && conflictSet().size === 0;
  }

  function buildBoard() {
    els.board.replaceChildren();
    cells.length = 0;
    for (let r = 0; r < SIZE; r++) {
      const line = document.createElement("div");
      line.className = "board__row";
      line.setAttribute("role", "row");
      for (let c = 0; c < SIZE; c++) {
        const index = r * SIZE + c;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.r = String(r);
        button.dataset.c = String(c);
        button.setAttribute("role", "gridcell");
        button.addEventListener("click", () => select(index));
        cells.push(button);
        line.append(button);
      }
      els.board.append(line);
    }

    for (let digit = 1; digit <= 9; digit++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--ghost";
      button.textContent = String(digit);
      button.setAttribute("aria-label", `Enter ${digit}`);
      button.addEventListener("click", () => enterDigit(digit));
      els.padNums.append(button);
    }
  }

  function render() {
    const bad = settings.values.conflicts ? conflictSet() : new Set();
    const selectedValue = state.selected >= 0 ? state.values[state.selected] : 0;
    const playing = state.phase === "play";

    for (let i = 0; i < 81; i++) {
      const button = cells[i];
      const value = state.values[i];
      const given = state.puzzle[i] !== 0;
      const selected = i === state.selected;
      const peer =
        selectedValue &&
        !selected &&
        value === selectedValue;
      const near =
        state.selected >= 0 &&
        !selected &&
        (row(i) === row(state.selected) || col(i) === col(state.selected) || boxOf(i) === boxOf(state.selected));

      button.classList.toggle("is-given", given);
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-same", Boolean(peer));
      button.classList.toggle("is-peer", Boolean(near && !peer));
      button.classList.toggle("is-bad", bad.has(i));
      button.disabled = !playing;
      button.tabIndex = selected && playing ? 0 : -1;
      button.setAttribute("aria-selected", selected ? "true" : "false");

      const where = `Row ${row(i) + 1}, column ${col(i) + 1}`;
      if (value) {
        button.textContent = String(value);
        button.setAttribute("aria-label", `${where}, ${given ? "given" : "entered"} ${value}${bad.has(i) ? ", conflicts" : ""}`);
      } else if (state.notes[i]) {
        button.replaceChildren(notesElement(state.notes[i]));
        const marks = [];
        for (let digit = 1; digit <= 9; digit++) if (state.notes[i] & (1 << (digit - 1))) marks.push(digit);
        button.setAttribute("aria-label", `${where}, notes ${marks.join(" ")}`);
      } else {
        button.textContent = "";
        button.setAttribute("aria-label", `${where}, empty`);
      }
    }

    const filled = filledCount();
    els.filled.textContent = String(filled);
    els.mistakes.textContent = String(state.mistakes);
    els.mistakes.classList.toggle("is-low", state.mistakes > 0);
  }

  function notesElement(mask) {
    const grid = document.createElement("span");
    grid.className = "cell__notes";
    grid.setAttribute("aria-hidden", "true");
    for (let digit = 1; digit <= 9; digit++) {
      const mark = document.createElement("i");
      if (mask & (1 << (digit - 1))) mark.textContent = String(digit);
      grid.append(mark);
    }
    return grid;
  }

  function select(index) {
    if (state.phase !== "play" && state.phase !== "done") return;
    state.selected = index;
    render();
    if (state.phase === "play") cells[index].focus();
  }

  function clearPeerNote(index, digit) {
    const bit = 1 << (digit - 1);
    for (let j = 0; j < 81; j++) {
      if (j === index) continue;
      if (row(j) === row(index) || col(j) === col(index) || boxOf(j) === boxOf(index)) {
        state.notes[j] &= ~bit;
      }
    }
  }

  function enterDigit(digit) {
    if (state.phase !== "play" || state.selected < 0) return;
    const index = state.selected;
    if (state.puzzle[index]) return;

    if (state.notesMode) {
      state.notes[index] ^= 1 << (digit - 1);
      render();
      return;
    }

    if (state.values[index] === digit) {
      state.values[index] = 0;
      render();
      return;
    }

    state.values[index] = digit;
    state.notes[index] = 0;
    clearPeerNote(index, digit);
    if (cellConflicts(index)) state.mistakes++;
    render();
    if (isSolved()) finish();
  }

  function clearCell() {
    if (state.phase !== "play" || state.selected < 0) return;
    const index = state.selected;
    if (state.puzzle[index]) return;
    state.values[index] = 0;
    state.notes[index] = 0;
    render();
  }

  function move(dr, dc) {
    if (state.phase !== "play" || state.selected < 0) return;
    const r = (row(state.selected) + dr + SIZE) % SIZE;
    const c = (col(state.selected) + dc + SIZE) % SIZE;
    select(r * SIZE + c);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function showIdle() {
    state.phase = "idle";
    state.level = settings.values.level;
    state.puzzle = new Array(81).fill(0);
    state.values = new Array(81).fill(0);
    state.notes = new Array(81).fill(0);
    state.selected = -1;
    state.mistakes = 0;
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.pad.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest(settings.values.level);
    setStatus(`Each row, column, and box uses 1–9 once. Next puzzle: ${levelName(settings.values.level)}.`);
    render();
  }

  function begin() {
    if (state.phase === "building") return;
    const level = settings.values.level;
    const token = ++state.token;
    state.phase = "building";
    window.clearTimeout(state.clock);
    els.start.disabled = true;
    els.summary.hidden = true;
    els.pad.hidden = true;
    const name = levelName(level).toLowerCase();
    setStatus(`Building ${name === "easy" ? "an" : "a"} ${name} puzzle…`);

    window.setTimeout(() => {
      if (token !== state.token) return;
      const made = makePuzzle(level);
      state.phase = "play";
      state.level = level;
      state.puzzle = made.puzzle;
      state.values = made.puzzle.slice();
      state.notes = new Array(81).fill(0);
      state.mistakes = 0;
      state.record = false;
      state.notesMode = false;
      els.notes.setAttribute("aria-pressed", "false");
      state.started = Date.now();
      state.elapsed = 0;
      state.selected = made.puzzle.findIndex((value) => value === 0);
      els.pad.hidden = false;
      els.start.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New puzzle";
      els.time.textContent = "0:00";
      showBest(level);
      setStatus("Pick a cell, then enter a digit. Notes keeps candidates.");
      render();
      if (state.selected >= 0) cells[state.selected].focus();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.level);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.level, state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    const best = formatTime(readBest(state.level));
    els.time.textContent = clock;
    showBest(state.level);
    els.pad.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    const mistakes = state.mistakes === 1 ? "1 mistake" : `${state.mistakes} mistakes`;
    els.summaryText.textContent = state.record
      ? `Solved in ${clock} with ${mistakes}. New best.`
      : `Solved in ${clock} with ${mistakes}. Best is ${best}.`;
    setStatus("Solved.", "ok");
    render();
    els.again.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (state.phase !== "play") return;

    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      enterDigit(Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      clearCell();
      return;
    }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      move(moves[event.key][0], moves[event.key][1]);
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      toggleNotes();
    }
  }

  function toggleNotes() {
    state.notesMode = !state.notesMode;
    els.notes.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    setStatus(state.notesMode ? "Notes on. Digits toggle candidates." : "Notes off. Digits fill the cell.");
  }

  buildBoard();
  showIdle();

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearCell);
  els.notes.addEventListener("click", toggleNotes);
  document.addEventListener("keydown", onKey);
})();
