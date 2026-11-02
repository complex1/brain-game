(() => {
  "use strict";

  function keyOf(cells) {
    const minR = Math.min(...cells.map((cell) => cell[0]));
    const minC = Math.min(...cells.map((cell) => cell[1]));
    return cells
      .map(([row, col]) => `${row - minR},${col - minC}`)
      .sort()
      .join("|");
  }

  function rotate(cells) {
    return cells.map(([row, col]) => [col, -row]);
  }

  function mirror(cells) {
    return cells.map(([row, col]) => [row, -col]);
  }

  function turns(cells) {
    const keys = new Set();
    let current = cells;
    for (let i = 0; i < 4; i += 1) {
      keys.add(keyOf(current));
      current = rotate(current);
    }
    return keys;
  }

  function grow(size) {
    const cells = [[0, 0]];
    const seen = new Set(["0,0"]);
    let guard = 0;
    while (cells.length < size && guard < 40) {
      guard += 1;
      const [row, col] = cells[Math.floor(Math.random() * cells.length)];
      const open = [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]]
        .filter(([nextRow, nextCol]) => !seen.has(`${nextRow},${nextCol}`));
      if (!open.length) continue;
      const next = open[Math.floor(Math.random() * open.length)];
      cells.push(next);
      seen.add(next.join(","));
    }
    return cells;
  }

  function rotateTimes(cells, count) {
    let current = cells;
    for (let i = 0; i < count; i += 1) current = rotate(current);
    return current;
  }

  function makeRound(mode) {
    for (let guard = 0; guard < 40; guard += 1) {
      const target = grow(4);
      if (keyOf(target).split("|").length < 4) continue;
      const targetTurns = turns(target);
      const flipped = mirror(target);
      const chiral = !targetTurns.has(keyOf(flipped));
      if (mode === "flip" && !chiral) continue;
      const correct = mode === "flip" ? flipped : rotateTimes(target, 1 + Math.floor(Math.random() * 3));
      const banned = new Set([...targetTurns, ...turns(correct)]);
      const options = [correct];
      let tries = 0;
      while (options.length < 4 && tries < 80) {
        tries += 1;
        const other = grow(4);
        const otherKey = keyOf(other);
        if (otherKey.split("|").length < 4 || banned.has(otherKey)) continue;
        if (options.some((option) => keyOf(option) === otherKey)) continue;
        options.push(other);
      }
      if (options.length < 4) continue;
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const held = options[i];
        options[i] = options[j];
        options[j] = held;
      }
      return { target, options, answer: options.findIndex((option) => keyOf(option) === keyOf(correct)) };
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__mirrorMatch = { makeRound, keyOf, turns };
    return;
  }

  const BEST_PREFIX = "mental-game.mirror-match.best";
  const settings = GameSettings.mount({
    id: "mirror-match",
    fields: [
      {
        id: "mode",
        label: "Match",
        hint: "Turns keeps the same face. Flips uses a mirror image.",
        type: "choice",
        default: "turns",
        options: [
          { value: "turns", label: "Turns" },
          { value: "flip", label: "Flips" },
        ],
      },
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
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next round: ${mode() === "flip" ? "flips" : "turns"}, ${roundLength()}s.`);
    },
  });

  const els = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    target: document.getElementById("target"),
    choices: document.getElementById("choices"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", score: 0, streak: 0, correct: 0, attempts: 0, round: null, deadline: 0, clock: 0, record: false };

  function mode() { return settings.values.mode === "flip" ? "flip" : "turns"; }
  function roundLength() {
    const value = Number(settings.values.length);
    return value === 45 || value === 90 ? value : 60;
  }
  function bestKey() { return `${BEST_PREFIX}.${mode()}.${roundLength()}`; }
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
  function draw(cells, className) {
    const box = document.createElement("div");
    box.className = className;
    const minR = Math.min(...cells.map((cell) => cell[0]));
    const minC = Math.min(...cells.map((cell) => cell[1]));
    const placed = new Set(cells.map(([row, col]) => `${row - minR},${col - minC}`));
    const height = Math.max(...cells.map((cell) => cell[0])) - minR;
    const width = Math.max(...cells.map((cell) => cell[1])) - minC;
    const offR = Math.floor((3 - height) / 2);
    const offC = Math.floor((3 - width) / 2);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const dot = document.createElement("span");
        dot.className = "dot";
        if (placed.has(`${row - offR},${col - offC}`)) dot.classList.add("is-on");
        box.append(dot);
      }
    }
    return box;
  }
  function render() {
    els.target.replaceChildren();
    els.choices.replaceChildren();
    if (!state.round) return;
    els.target.append(draw(state.round.target, "shape"));
    state.round.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.disabled = state.phase !== "play";
      button.setAttribute("aria-label", `Choice ${index + 1}`);
      button.append(draw(option, "shape"));
      button.addEventListener("click", () => choose(index, button));
      els.choices.append(button);
    });
  }
  function nextRound() {
    state.round = makeRound(mode());
    state.phase = "play";
    if (!state.round) {
      setStatus("Couldn't build a shape. Try again.", "bad");
      return;
    }
    render();
    setStatus(mode() === "flip" ? "Pick the mirror image." : "Pick the turned copy.");
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
    state.correct = 0;
    state.attempts = 0;
    state.record = false;
    state.deadline = Date.now() + roundLength() * 1000;
    els.summary.hidden = true;
    els.start.hidden = true;
    paintHud(roundLength());
    nextRound();
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
    render();
    setStatus(state.correct ? `${state.correct} correct.` : "Time's up.", state.correct ? "ok" : "");
    els.summaryText.textContent = state.record
      ? `Score ${state.score}. ${state.correct} of ${state.attempts} correct. New best.`
      : `Score ${state.score}. ${state.correct} of ${state.attempts} correct.`;
    els.summary.hidden = false;
  }
  function choose(index, button) {
    if (state.phase !== "play" || !state.round) return;
    state.attempts += 1;
    if (index === state.round.answer) {
      state.correct += 1;
      state.streak += 1;
      state.score += 1 + Math.min(state.streak, 5);
      paintHud();
      nextRound();
      return;
    }
    state.streak = 0;
    button.classList.add("is-wrong");
    button.disabled = true;
    paintHud();
    setStatus("Not that shape.", "bad");
  }

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(`Press Start. Next round: ${mode() === "flip" ? "flips" : "turns"}, ${roundLength()}s.`);
  paintHud(roundLength());
})();
