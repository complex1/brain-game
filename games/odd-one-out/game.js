(() => {
  "use strict";

  const SHAPES = ["circle", "square", "diamond", "triangle"];
  const COLORS = ["red", "yellow", "green", "cyan", "violet"];

  function pick(list, except) {
    let value = list[Math.floor(Math.random() * list.length)];
    while (value === except) value = list[Math.floor(Math.random() * list.length)];
    return value;
  }

  function makeBoard(size) {
    const shape = pick(SHAPES);
    const color = pick(COLORS);
    const changeColor = Math.random() < 0.5;
    const odd = {
      shape: changeColor ? shape : pick(SHAPES, shape),
      color: changeColor ? pick(COLORS, color) : color,
    };
    const index = Math.floor(Math.random() * size * size);
    const cells = Array.from({ length: size * size }, (_, cell) => (cell === index ? odd : { shape, color }));
    return { cells, index };
  }

  if (typeof document === "undefined") {
    globalThis.__oddOneOut = { makeBoard };
    return;
  }

  const BEST_PREFIX = "mental-game.odd-one-out.best";
  const settings = GameSettings.mount({
    id: "odd-one-out",
    fields: [
      {
        id: "length",
        label: "Round length",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "60",
        options: [
          { value: "45", label: "45s" },
          { value: "60", label: "60s" },
          { value: "90", label: "90s" },
        ],
      },
      {
        id: "size",
        label: "Grid",
        hint: "A smaller grid is a quicker scan.",
        type: "choice",
        default: "4",
        options: [
          { value: "3", label: "3×3" },
          { value: "4", label: "4×4" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next round: ${roundLength()}s, ${size()}×${size()}.`);
    },
  });

  const els = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", score: 0, streak: 0, found: 0, misses: 0, board: null, deadline: 0, clock: 0, record: false };

  function roundLength() {
    const value = Number(settings.values.length);
    return value === 45 || value === 90 ? value : 60;
  }
  function size() {
    return Number(settings.values.size) === 3 ? 3 : 4;
  }
  function bestKey() {
    return `${BEST_PREFIX}.${roundLength()}.${size()}`;
  }
  function readBest() {
    const value = Number(localStorage.getItem(bestKey()));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(bestKey(), String(value)); } catch { /* storage blocked */ }
  }
  function formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud(seconds) {
    const left = seconds === undefined ? Math.max(0, (state.deadline - Date.now()) / 1000) : seconds;
    els.time.textContent = formatTime(left);
    els.time.classList.toggle("is-low", state.phase === "play" && left <= 10);
    els.score.textContent = String(state.score);
    els.streak.textContent = String(state.streak);
    els.best.textContent = String(readBest());
  }
  function renderBoard() {
    const boardSize = state.board ? Math.sqrt(state.board.cells.length) : size();
    els.grid.style.setProperty("--n", String(boardSize));
    els.grid.replaceChildren();
    if (!state.board) return;
    state.board.cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.disabled = state.phase !== "play";
      button.setAttribute("aria-label", `${cell.shape}, ${cell.color}`);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.dataset.shape = cell.shape;
      mark.dataset.color = cell.color;
      button.append(mark);
      button.addEventListener("click", () => choose(index, button));
      els.grid.append(button);
    });
  }
  function nextBoard() {
    state.board = makeBoard(size());
    state.phase = "play";
    renderBoard();
    setStatus("Find the one that does not match.");
  }
  function tick() {
    const left = (state.deadline - Date.now()) / 1000;
    if (left <= 0) { finish(); return; }
    paintHud(left);
    state.clock = setTimeout(tick, 200);
  }
  function begin() {
    clearTimeout(state.clock);
    state.score = 0;
    state.streak = 0;
    state.found = 0;
    state.misses = 0;
    state.record = false;
    state.deadline = Date.now() + roundLength() * 1000;
    els.summary.hidden = true;
    els.start.hidden = true;
    paintHud(roundLength());
    nextBoard();
    tick();
  }
  function finish() {
    clearTimeout(state.clock);
    if (state.phase === "over") return;
    state.phase = "over";
    const previous = readBest();
    if (state.score > previous) {
      state.record = true;
      writeBest(state.score);
    }
    paintHud(0);
    renderBoard();
    setStatus(state.found ? `Found ${state.found}.` : "Time's up.", state.found ? "ok" : "");
    els.summaryText.textContent = state.record
      ? `Score ${state.score}. ${state.found} found, ${state.misses} misses. New best.`
      : `Score ${state.score}. ${state.found} found, ${state.misses} misses.`;
    els.summary.hidden = false;
  }
  function choose(index, button) {
    if (state.phase !== "play") return;
    if (index === state.board.index) {
      state.found += 1;
      state.streak += 1;
      state.score += 1 + Math.min(state.streak, 5);
      paintHud();
      nextBoard();
      return;
    }
    state.misses += 1;
    state.streak = 0;
    button.classList.add("is-wrong");
    paintHud();
    setStatus("Not that one.", "bad");
  }

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(`Press Start. Next round: ${roundLength()}s, ${size()}×${size()}.`);
  paintHud(roundLength());
})();
