(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.quick-math.best";

  const settings = GameSettings.mount({
    id: "quick-math",
    fields: [
      {
        id: "length",
        label: "Round length",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "60",
        options: [
          { value: "30", label: "30s" },
          { value: "60", label: "60s" },
          { value: "120", label: "2 min" },
        ],
      },
      {
        id: "level",
        label: "Difficulty",
        hint: "Easy is add and subtract. Medium adds multiply. Hard adds division.",
        type: "choice",
        default: "easy",
        options: [
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") updateHud(roundLength());
    },
  });

  const els = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
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
    score: 0,
    streak: 0,
    correct: 0,
    attempts: 0,
    record: false,
    problem: null,
    shownAt: 0,
    deadline: 0,
    clock: 0,
    pause: 0,
    level: "easy",
  };

  function roundLength() {
    const value = Number(settings.values.length);
    return value === 30 || value === 120 ? value : 60;
  }

  function level() {
    const value = settings.values.level;
    return value === "medium" || value === "hard" ? value : "easy";
  }

  function bestKey() {
    return `${BEST_PREFIX}.${level()}`;
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
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = tone ? `status status--${tone}` : "status";
  }

  function updateHud(seconds) {
    const left = seconds === undefined ? Math.max(0, (state.deadline - Date.now()) / 1000) : seconds;
    els.time.textContent = formatTime(left);
    els.time.classList.toggle("is-low", state.phase === "play" && left <= 10);
    els.score.textContent = String(state.score);
    els.streak.textContent = String(state.streak);
    els.best.textContent = String(readBest());
  }

  function rand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function makeProblem(difficulty) {
    const ops = difficulty === "easy" ? ["+", "−"] : difficulty === "hard" ? ["+", "−", "×", "÷"] : ["+", "−", "×"];
    const op = ops[rand(0, ops.length - 1)];
    let a;
    let b;
    let answer;

    if (op === "+") {
      const max = difficulty === "hard" ? 40 : difficulty === "medium" ? 20 : 10;
      a = rand(1, max);
      b = rand(1, max);
      answer = a + b;
    } else if (op === "−") {
      const max = difficulty === "hard" ? 40 : difficulty === "medium" ? 20 : 12;
      a = rand(2, max);
      b = rand(1, a);
      answer = a - b;
    } else if (op === "×") {
      const max = difficulty === "hard" ? 12 : 9;
      a = rand(2, max);
      b = rand(2, max);
      answer = a * b;
    } else {
      b = rand(2, 12);
      answer = rand(2, 12);
      a = b * answer;
    }

    return { text: `${a} ${op} ${b}`, answer };
  }

  function nextProblem() {
    const previous = state.problem && state.problem.text;
    let created = makeProblem(state.level);
    for (let attempt = 0; attempt < 6 && created.text === previous; attempt += 1) {
      created = makeProblem(state.level);
    }
    state.problem = created;
    state.shownAt = Date.now();
    state.phase = "play";
    els.problem.classList.remove("is-bad");
    els.problem.textContent = created.text;
    els.answer.value = "";
    els.answer.disabled = false;
    els.form.hidden = false;
    els.answer.focus();
    setStatus("Type the answer.");
  }

  function pointsFor(elapsedMs) {
    const speed = elapsedMs < 1500 ? 5 : elapsedMs < 3000 ? 2 : 0;
    const streakBonus = Math.min(Math.max(0, state.streak - 1), 5) * 2;
    return 10 + speed + streakBonus;
  }

  function finishRound() {
    clearTimeout(state.clock);
    clearTimeout(state.pause);
    if (state.phase === "over") return;
    state.phase = "over";
    els.form.hidden = true;
    els.answer.disabled = true;
    els.problem.classList.remove("is-bad");
    els.time.textContent = "0:00";
    els.time.classList.remove("is-low");

    const best = readBest();
    const isBest = state.score > best;
    if (isBest) {
      writeBest(state.score);
      state.record = true;
    }
    updateHud(0);

    const accuracy = state.attempts === 0 ? 0 : Math.round((state.correct / state.attempts) * 100);
    const tally =
      state.attempts === 0
        ? "No answers this round."
        : `${state.correct} of ${state.attempts} correct (${accuracy}%).`;
    const bestLine = state.record ? " New best." : best > 0 || state.score > 0 ? ` Best is ${readBest()}.` : "";
    const perfect = state.attempts > 0 && state.correct === state.attempts;
    setStatus(state.attempts === 0 ? "No answers this round." : `${state.correct} of ${state.attempts} correct.`, perfect ? "ok" : "bad");
    els.summaryText.textContent = `Score ${state.score}. ${tally}${bestLine}`;
    els.summary.hidden = false;
    els.again.focus();
  }

  function tick() {
    const left = (state.deadline - Date.now()) / 1000;
    if (left <= 0) {
      finishRound();
      return;
    }
    updateHud(left);
    state.clock = setTimeout(tick, 200);
  }

  function grade(event) {
    event.preventDefault();
    if (state.phase !== "play") return;
    const raw = els.answer.value.trim();
    if (!/^\d+$/.test(raw)) {
      setStatus("Type a whole number.");
      els.answer.focus();
      return;
    }

    const guess = Number(raw);
    state.attempts += 1;
    if (guess === state.problem.answer) {
      state.correct += 1;
      state.streak += 1;
      state.score += pointsFor(Date.now() - state.shownAt);
      updateHud();
      nextProblem();
      return;
    }

    state.streak = 0;
    state.phase = "pause";
    els.problem.classList.add("is-bad");
    els.answer.disabled = true;
    updateHud();
    setStatus(`Answer was ${state.problem.answer}.`, "bad");
    state.pause = setTimeout(() => {
      if (state.phase === "over") return;
      nextProblem();
    }, 700);
  }

  function begin() {
    clearTimeout(state.clock);
    clearTimeout(state.pause);
    state.phase = "play";
    state.score = 0;
    state.streak = 0;
    state.correct = 0;
    state.attempts = 0;
    state.record = false;
    state.level = level();
    state.problem = null;
    state.deadline = Date.now() + roundLength() * 1000;
    els.start.hidden = true;
    els.summary.hidden = true;
    updateHud(roundLength());
    nextProblem();
    tick();
  }

  els.form.addEventListener("submit", grade);
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  updateHud(roundLength());
})();
