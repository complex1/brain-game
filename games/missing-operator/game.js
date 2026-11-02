(() => {
  "use strict";

  const OPS = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => (b !== 0 && a % b === 0 ? a / b : null),
  };
  const LABELS = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  function matches(a, b, result) {
    return Object.keys(OPS).filter((op) => OPS[op](a, b) === result);
  }

  function makeProblem(level) {
    const max = level === "hard" ? 12 : 9;
    for (let guard = 0; guard < 80; guard += 1) {
      const op = Object.keys(OPS)[Math.floor(Math.random() * 4)];
      let a = 1 + Math.floor(Math.random() * max);
      let b = 1 + Math.floor(Math.random() * max);
      if (op === "/") {
        b = 1 + Math.floor(Math.random() * max);
        a = b * (1 + Math.floor(Math.random() * max));
      }
      const result = OPS[op](a, b);
      if (result === null || !Number.isInteger(result)) continue;
      if (matches(a, b, result).length === 1) return { a, b, result, op };
    }
    return { a: 7, b: 3, result: 21, op: "*" };
  }

  if (typeof document === "undefined") {
    globalThis.__missingOperator = { makeProblem, matches };
    return;
  }

  const BEST_PREFIX = "mental-game.missing-operator.best";
  const settings = GameSettings.mount({
    id: "missing-operator",
    fields: [
      {
        id: "level",
        label: "Numbers",
        hint: "Hard uses slightly larger numbers. Applies the next time you press Start.",
        type: "choice",
        default: "easy",
        options: [
          { value: "easy", label: "Easy" },
          { value: "hard", label: "Hard" },
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
      if (state.phase === "idle") setStatus(`Press Start. Next round: ${level()}, ${roundLength()}s.`);
    },
  });

  const els = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    equation: document.getElementById("equation"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    ops: [...document.querySelectorAll(".op")],
  };
  const state = { phase: "idle", score: 0, streak: 0, correct: 0, attempts: 0, problem: null, deadline: 0, clock: 0, record: false };

  function level() { return settings.values.level === "hard" ? "hard" : "easy"; }
  function roundLength() {
    const value = Number(settings.values.length);
    return value === 45 || value === 90 ? value : 60;
  }
  function bestKey() { return `${BEST_PREFIX}.${level()}.${roundLength()}`; }
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
  function lockOps(locked) {
    els.ops.forEach((button) => {
      button.disabled = locked;
      button.classList.remove("is-wrong");
    });
  }
  function nextProblem() {
    state.problem = makeProblem(level());
    state.phase = "play";
    const problem = state.problem;
    els.equation.textContent = `${problem.a} ? ${problem.b} = ${problem.result}`;
    lockOps(false);
    setStatus("Pick the operation.");
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
    nextProblem();
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
    lockOps(true);
    setStatus(state.correct ? `${state.correct} correct.` : "Time's up.", state.correct ? "ok" : "");
    els.summaryText.textContent = state.record
      ? `Score ${state.score}. ${state.correct} of ${state.attempts} correct. New best.`
      : `Score ${state.score}. ${state.correct} of ${state.attempts} correct.`;
    els.summary.hidden = false;
  }
  function choose(op, button) {
    if (state.phase !== "play") return;
    state.attempts += 1;
    if (op === state.problem.op) {
      state.correct += 1;
      state.streak += 1;
      state.score += 1 + Math.min(state.streak, 5);
      paintHud();
      nextProblem();
      return;
    }
    state.streak = 0;
    button.classList.add("is-wrong");
    paintHud();
    setStatus("Not that operation.", "bad");
  }

  els.ops.forEach((button) => button.addEventListener("click", () => choose(button.dataset.op, button)));
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(`Press Start. Next round: ${level()}, ${roundLength()}s.`);
  paintHud(roundLength());
})();
