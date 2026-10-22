(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.color-clash.best";
  const COLORS = [
    { id: "red", label: "Red", key: "r" },
    { id: "yellow", label: "Yellow", key: "y" },
    { id: "green", label: "Green", key: "g" },
    { id: "cyan", label: "Cyan", key: "c" },
    { id: "violet", label: "Violet", key: "v" },
  ];

  const settings = GameSettings.mount({
    id: "color-clash",
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
        id: "mode",
        label: "Word match",
        hint: "Clash never matches the ink. Mixed sometimes does.",
        type: "choice",
        default: "clash",
        options: [
          { value: "clash", label: "Clash" },
          { value: "mixed", label: "Mixed" },
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
    stimulus: document.getElementById("stimulus"),
    choices: document.getElementById("choices"),
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
    trial: null,
    shownAt: 0,
    deadline: 0,
    clock: 0,
    pause: 0,
    mode: "clash",
  };

  function roundLength() {
    const value = Number(settings.values.length);
    return value === 30 || value === 120 ? value : 60;
  }

  function mode() {
    return settings.values.mode === "mixed" ? "mixed" : "clash";
  }

  function readBest() {
    try {
      const value = Number(localStorage.getItem(`${BEST_PREFIX}.${mode()}`));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${mode()}`, String(value));
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

  function rand(max) {
    return Math.floor(Math.random() * max);
  }

  function pick(exceptId) {
    let color = COLORS[rand(COLORS.length)];
    while (exceptId && color.id === exceptId) color = COLORS[rand(COLORS.length)];
    return color;
  }

  function makeTrial(rule) {
    const word = COLORS[rand(COLORS.length)];
    const match = rule === "mixed" && Math.random() < 0.25;
    const ink = match ? word : pick(word.id);
    return { word, ink };
  }

  function buttons() {
    return [...els.choices.querySelectorAll(".choice")];
  }

  function setLocked(locked) {
    for (const button of buttons()) button.disabled = locked;
  }

  function clearMarks() {
    for (const button of buttons()) button.classList.remove("is-correct", "is-wrong");
  }

  function showTrial() {
    const previous = state.trial;
    let trial = makeTrial(state.mode);
    for (let attempt = 0; attempt < 6 && previous && trial.word.id === previous.word.id && trial.ink.id === previous.ink.id; attempt += 1) {
      trial = makeTrial(state.mode);
    }
    state.trial = trial;
    state.shownAt = Date.now();
    state.phase = "play";
    clearMarks();
    els.stimulus.dataset.ink = trial.ink.id;
    els.stimulus.textContent = trial.word.label;
    setLocked(false);
    setStatus("Pick the ink color.");
  }

  function pointsFor(elapsedMs) {
    const speed = elapsedMs < 800 ? 5 : elapsedMs < 1500 ? 2 : 0;
    const streakBonus = Math.min(Math.max(0, state.streak - 1), 5) * 2;
    return 10 + speed + streakBonus;
  }

  function finishRound() {
    clearTimeout(state.clock);
    clearTimeout(state.pause);
    if (state.phase === "over") return;
    state.phase = "over";
    setLocked(true);
    clearMarks();
    els.time.textContent = "0:00";
    els.time.classList.remove("is-low");

    const best = readBest();
    if (state.score > best) {
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

  function choose(id) {
    if (state.phase !== "play" || !state.trial) return;
    state.attempts += 1;
    const ink = state.trial.ink;
    if (id === ink.id) {
      state.correct += 1;
      state.streak += 1;
      state.score += pointsFor(Date.now() - state.shownAt);
      updateHud();
      showTrial();
      return;
    }

    state.streak = 0;
    state.phase = "pause";
    setLocked(true);
    updateHud();
    const picked = buttons().find((button) => button.dataset.color === id);
    const right = buttons().find((button) => button.dataset.color === ink.id);
    if (picked) picked.classList.add("is-wrong");
    if (right) right.classList.add("is-correct");
    setStatus(`Ink was ${ink.label}.`, "bad");
    state.pause = setTimeout(() => {
      if (state.phase === "over") return;
      showTrial();
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
    state.mode = mode();
    state.trial = null;
    state.deadline = Date.now() + roundLength() * 1000;
    els.start.hidden = true;
    els.summary.hidden = true;
    updateHud(roundLength());
    showTrial();
    tick();
  }

  els.choices.addEventListener("click", (event) => {
    const button = event.target.closest(".choice");
    if (!button) return;
    choose(button.dataset.color);
  });

  document.addEventListener("keydown", (event) => {
    if (state.phase !== "play") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const settingsOpen = document.querySelector(".settings");
    if (settingsOpen && !settingsOpen.hidden) return;
    const color = COLORS.find((item) => item.key === event.key.toLowerCase());
    if (!color) return;
    event.preventDefault();
    choose(color.id);
  });

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  updateHud(roundLength());
})();
