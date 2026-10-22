(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.quick-sum.best";
  const BLANK_MS = 180;

  const settings = GameSettings.mount({
    id: "quick-sum",
    fields: [
      {
        id: "digits",
        label: "Digits",
        hint: "How many digits each number has.",
        type: "choice",
        default: "1",
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
        ],
      },
      {
        id: "count",
        label: "How many",
        hint: "How many numbers flash in each round.",
        type: "choice",
        default: "5",
        options: [
          { value: "3", label: "3" },
          { value: "5", label: "5" },
          { value: "7", label: "7" },
          { value: "10", label: "10" },
        ],
      },
      {
        id: "show",
        label: "Show time",
        hint: "How long each number stays on screen.",
        type: "choice",
        default: "1000",
        options: [
          { value: "500", label: "0.5s" },
          { value: "1000", label: "1s" },
          { value: "1500", label: "1.5s" },
          { value: "2000", label: "2s" },
        ],
      },
      {
        id: "limit",
        label: "Answer time",
        hint: "Optional limit for typing the sum. Off means no limit.",
        type: "choice",
        default: "0",
        options: [
          { value: "0", label: "Off" },
          { value: "5", label: "5s" },
          { value: "10", label: "10s" },
          { value: "15", label: "15s" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") describe();
    },
  });

  const els = {
    round: document.getElementById("round"),
    score: document.getElementById("score"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    problem: document.getElementById("problem"),
    form: document.getElementById("answer-form"),
    answer: document.getElementById("answer"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    round: 0,
    score: 0,
    record: false,
    numbers: [],
    sum: 0,
    digits: 1,
    count: 5,
    showMs: 1000,
    limit: 0,
    deadline: 0,
    timer: 0,
    clock: 0,
  };

  function choice(name, allowed, fallback) {
    const value = String(settings.values[name]);
    return allowed.includes(value) ? value : fallback;
  }

  function digits() {
    return Number(choice("digits", ["1", "2", "3"], "1"));
  }

  function count() {
    return Number(choice("count", ["3", "5", "7", "10"], "5"));
  }

  function showMs() {
    return Number(choice("show", ["500", "1000", "1500", "2000"], "1000"));
  }

  function answerLimit() {
    return Number(choice("limit", ["0", "5", "10", "15"], "0"));
  }

  function bestKey() {
    return `${BEST_PREFIX}.${state.digits}.${state.count}`;
  }

  function readBest() {
    try {
      const value = Number(localStorage.getItem(bestKey()));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem(bestKey(), String(value));
    } catch {
      /* storage blocked — best still shows this session */
    }
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${whole}s`;
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = tone ? `status status--${tone}` : "status";
  }

  function describe() {
    state.digits = digits();
    state.count = count();
    const show = showMs() / 1000;
    const limit = answerLimit();
    const limitText = limit ? `, ${limit}s to answer` : "";
    setStatus(`${state.count} numbers · ${state.digits} digit${state.digits === 1 ? "" : "s"} · ${show}s each${limitText}.`);
    updateHud();
  }

  function updateHud(seconds) {
    els.round.textContent = state.round ? String(state.round) : "—";
    els.score.textContent = String(state.score);
    els.best.textContent = String(readBest());
    if (seconds === undefined) {
      els.time.textContent = "—";
      els.time.classList.remove("is-low");
      return;
    }
    els.time.textContent = formatTime(seconds);
    els.time.classList.toggle("is-low", seconds <= 3);
  }

  function randomNumber(size) {
    const min = size === 1 ? 1 : 10 ** (size - 1);
    const max = 10 ** size - 1;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function wait(ms) {
    return new Promise((resolve) => {
      state.timer = setTimeout(resolve, ms);
    });
  }

  function clearClock() {
    clearTimeout(state.clock);
    state.clock = 0;
  }

  function tick() {
    const left = (state.deadline - Date.now()) / 1000;
    if (left <= 0) {
      miss("Time's up.");
      return;
    }
    updateHud(left);
    state.clock = setTimeout(tick, 200);
  }

  async function showSequence() {
    const token = state.token;
    els.form.hidden = true;
    els.answer.disabled = true;
    els.problem.classList.remove("is-ok", "is-bad");
    updateHud();

    for (let i = 0; i < state.numbers.length; i += 1) {
      if (token !== state.token) return;
      els.problem.textContent = String(state.numbers[i]);
      setStatus(`Watch ${i + 1} of ${state.numbers.length}.`);
      await wait(state.showMs);
      if (token !== state.token) return;
      els.problem.textContent = "";
      if (i < state.numbers.length - 1) await wait(BLANK_MS);
    }

    if (token !== state.token) return;
    ask();
  }

  function ask() {
    state.phase = "answer";
    els.problem.classList.remove("is-ok", "is-bad");
    els.problem.textContent = "?";
    els.form.hidden = false;
    els.answer.disabled = false;
    els.answer.value = "";
    els.answer.focus();
    if (state.limit > 0) {
      state.deadline = Date.now() + state.limit * 1000;
      setStatus("Enter the sum.");
      tick();
      return;
    }
    updateHud();
    setStatus("Enter the sum.");
  }

  function miss(reason) {
    if (state.phase === "over") return;
    state.token += 1;
    clearTimeout(state.timer);
    clearClock();
    state.phase = "over";
    els.form.hidden = true;
    els.answer.disabled = true;
    els.problem.textContent = String(state.sum);
    els.problem.classList.add("is-bad");
    updateHud();

    const best = readBest();
    if (state.score > best) {
      writeBest(state.score);
      state.record = true;
    }
    updateHud();

    const cleared =
      state.score === 0
        ? "No rounds cleared."
        : `You cleared ${state.score} ${state.score === 1 ? "round" : "rounds"}.`;
    const bestLine = state.record ? " New best." : best > 0 || state.score > 0 ? ` Best is ${readBest()}.` : "";
    setStatus(reason, "bad");
    els.summaryText.textContent = `${state.numbers.join(" + ")} = ${state.sum}. ${cleared}${bestLine}`;
    els.summary.hidden = false;
    els.again.focus();
  }

  function nextRound() {
    state.round += 1;
    state.numbers = Array.from({ length: state.count }, () => randomNumber(state.digits));
    state.sum = state.numbers.reduce((total, value) => total + value, 0);
    state.phase = "watch";
    updateHud();
    showSequence();
  }

  function grade(event) {
    event.preventDefault();
    if (state.phase !== "answer") return;
    const raw = els.answer.value.trim();
    if (!/^\d+$/.test(raw)) {
      setStatus("Type a whole number.");
      els.answer.focus();
      return;
    }
    if (Number(raw) !== state.sum) {
      miss(`Sum was ${state.sum}.`);
      return;
    }

    clearClock();
    state.score += 1;
    if (state.score > readBest()) {
      state.record = true;
      writeBest(state.score);
    }
    state.phase = "watch";
    els.form.hidden = true;
    els.problem.textContent = String(state.sum);
    els.problem.classList.add("is-ok");
    updateHud();
    setStatus("Correct.", "ok");
    const token = state.token;
    state.timer = setTimeout(() => {
      if (token === state.token) nextRound();
    }, 450);
  }

  function begin() {
    clearTimeout(state.timer);
    clearClock();
    state.token += 1;
    state.round = 0;
    state.score = 0;
    state.record = false;
    state.digits = digits();
    state.count = count();
    state.showMs = showMs();
    state.limit = answerLimit();
    els.start.hidden = true;
    els.summary.hidden = true;
    els.problem.classList.remove("is-ok", "is-bad");
    nextRound();
  }

  els.form.addEventListener("submit", grade);
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  describe();
})();
