(() => {
  "use strict";

  const PALETTE = [
    { id: "red", label: "Red", letter: "R" },
    { id: "yellow", label: "Yellow", letter: "Y" },
    { id: "green", label: "Green", letter: "G" },
    { id: "cyan", label: "Cyan", letter: "C" },
    { id: "violet", label: "Violet", letter: "V" },
    { id: "white", label: "White", letter: "W" },
    { id: "orange", label: "Orange", letter: "O" },
    { id: "pink", label: "Pink", letter: "P" },
  ];

  /* Feedback for one guess: exact = right color in the right place,
     partial = right color in the wrong place. Duplicates are matched one-to-one. */
  function scoreGuess(secret, guess) {
    let exact = 0;
    const secretLeft = new Map();
    const guessLeft = new Map();
    for (let i = 0; i < secret.length; i += 1) {
      if (guess[i] === secret[i]) {
        exact += 1;
      } else {
        secretLeft.set(secret[i], (secretLeft.get(secret[i]) || 0) + 1);
        guessLeft.set(guess[i], (guessLeft.get(guess[i]) || 0) + 1);
      }
    }
    let partial = 0;
    for (const [color, count] of guessLeft) {
      partial += Math.min(count, secretLeft.get(color) || 0);
    }
    return { exact, partial };
  }

  function makeSecret(pegs, colors, repeats, random) {
    const rnd = typeof random === "function" ? random : Math.random;
    if (!repeats && colors < pegs) throw new Error("Not enough colors for a code without repeats");
    const pool = [];
    for (let i = 0; i < colors; i += 1) pool.push(i);
    const code = [];
    for (let i = 0; i < pegs; i += 1) {
      if (repeats) {
        code.push(Math.floor(rnd() * colors));
      } else {
        const pick = Math.floor(rnd() * pool.length);
        code.push(pool[pick]);
        pool.splice(pick, 1);
      }
    }
    return code;
  }

  if (typeof document === "undefined") {
    globalThis.__mastermind = { scoreGuess, makeSecret };
    return;
  }

  const BEST_PREFIX = "mental-game.mastermind.best";

  const settings = GameSettings.mount({
    id: "mastermind",
    fields: [
      {
        id: "pegs",
        label: "Pegs",
        hint: "How many pegs are in the code. Applies to the next game.",
        type: "choice",
        default: "4",
        options: [
          { value: "4", label: "4" },
          { value: "5", label: "5" },
        ],
      },
      {
        id: "colors",
        label: "Colors",
        hint: "How many colors the code can use. Applies to the next game.",
        type: "choice",
        default: "6",
        options: [
          { value: "6", label: "6" },
          { value: "8", label: "8" },
        ],
      },
      {
        id: "attempts",
        label: "Attempts",
        hint: "How many guesses you get. Applies to the next game.",
        type: "choice",
        default: "10",
        options: [
          { value: "8", label: "8" },
          { value: "10", label: "10" },
          { value: "12", label: "12" },
        ],
      },
      {
        id: "repeats",
        label: "Allow repeated colors",
        hint: "When off, each color appears at most once in the code. Applies to the next game.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") {
        setStatus(idleText());
        render();
      }
    },
  });

  const els = {
    attempt: document.getElementById("attempt"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    summaryTitle: document.getElementById("summary-title"),
    summaryText: document.getElementById("summary-text"),
    code: document.getElementById("code"),
    again: document.getElementById("again-btn"),
    board: document.getElementById("board"),
    guess: document.getElementById("guess"),
    palette: document.getElementById("palette"),
    history: document.getElementById("history"),
    historyLabel: document.getElementById("history-label"),
    submit: document.getElementById("submit-btn"),
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
  };

  const state = {
    phase: "idle",
    config: null,
    secret: [],
    rows: [],
    current: [],
    selColor: null,
    selSlot: null,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  function pick(value, allowed, fallback) {
    const numeric = Number(value);
    return allowed.includes(numeric) ? numeric : fallback;
  }

  function readConfig() {
    const values = settings.values;
    return {
      pegs: pick(values.pegs, [4, 5], 4),
      colors: pick(values.colors, [6, 8], 6),
      attempts: pick(values.attempts, [8, 10, 12], 10),
      repeats: values.repeats !== false,
    };
  }

  function activeConfig() {
    return state.config && state.phase !== "idle" ? state.config : readConfig();
  }

  function bestKey(config) {
    return `${BEST_PREFIX}.${config.pegs}p-${config.colors}c-${config.repeats ? "rep" : "uniq"}`;
  }

  function readBest(config) {
    try {
      const stored = Number(localStorage.getItem(bestKey(config)));
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(config, attempts) {
    try {
      localStorage.setItem(bestKey(config), String(attempts));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function idleText() {
    const config = readConfig();
    const repeats = config.repeats ? "repeats allowed" : "no repeats";
    return `Press Start. Next code: ${config.pegs} pegs, ${config.colors} colors, ${config.attempts} attempts, ${repeats}.`;
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function makePeg(index, tag) {
    const color = PALETTE[index];
    const peg = document.createElement(tag || "span");
    peg.className = "peg";
    peg.dataset.color = color.id;
    const letter = document.createElement("span");
    letter.className = "peg__letter";
    letter.setAttribute("aria-hidden", "true");
    letter.textContent = color.letter;
    peg.append(letter);
    return peg;
  }

  function paintHud() {
    const config = activeConfig();
    els.attempt.textContent = `${state.phase === "idle" ? 0 : state.rows.length} / ${config.attempts}`;
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(config);
    els.best.textContent = best ? `${best}` : "—";
  }

  function describeFeedback(exact, partial) {
    return `${exact} right color and place, ${partial} right color in the wrong place`;
  }

  function renderGuess(config, playing) {
    els.guess.style.setProperty("--n", String(config.pegs));
    els.guess.replaceChildren();
    for (let i = 0; i < config.pegs; i += 1) {
      const value = playing ? state.current[i] : null;
      const filled = typeof value === "number";
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.dataset.key = `slot-${i}`;
      slot.dataset.index = String(i);
      slot.disabled = !playing;
      if (playing && state.selSlot === i) slot.classList.add("is-selected");
      slot.setAttribute("aria-pressed", playing && state.selSlot === i ? "true" : "false");
      if (filled) {
        slot.append(makePeg(value));
        slot.setAttribute("aria-label", `Position ${i + 1}, ${PALETTE[value].label}. Activate to clear.`);
      } else {
        const hole = document.createElement("span");
        hole.className = "peg peg--empty";
        hole.setAttribute("aria-hidden", "true");
        slot.append(hole);
        slot.setAttribute("aria-label", `Position ${i + 1}, empty`);
      }
      els.guess.append(slot);
    }
  }

  function renderPalette(config, playing) {
    els.palette.style.setProperty("--c", String(config.colors));
    els.palette.replaceChildren();
    for (let i = 0; i < config.colors; i += 1) {
      const button = makePeg(i, "button");
      button.type = "button";
      button.classList.add("peg--button");
      button.dataset.key = `color-${i}`;
      button.dataset.index = String(i);
      button.disabled = !playing;
      const selected = playing && state.selColor === i;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.setAttribute("aria-label", PALETTE[i].label);
      els.palette.append(button);
    }
  }

  function renderHistory(config) {
    els.history.replaceChildren();
    els.historyLabel.hidden = state.rows.length === 0;
    for (let r = state.rows.length - 1; r >= 0; r -= 1) {
      const row = state.rows[r];
      const item = document.createElement("li");
      item.className = "row";
      item.style.setProperty("--n", String(config.pegs));
      if (row.exact === config.pegs) item.classList.add("is-win");

      const number = document.createElement("span");
      number.className = "row__number";
      number.textContent = String(r + 1);

      const pegs = document.createElement("span");
      pegs.className = "row__pegs";
      const names = row.guess.map((value) => PALETTE[value].label).join(", ");
      pegs.setAttribute("role", "img");
      pegs.setAttribute("aria-label", `Guess ${r + 1}: ${names}`);
      for (const value of row.guess) pegs.append(makePeg(value));

      const feedback = document.createElement("span");
      feedback.className = "feedback";
      feedback.setAttribute("role", "img");
      feedback.setAttribute("aria-label", describeFeedback(row.exact, row.partial));
      const exact = document.createElement("span");
      exact.className = "feedback__exact";
      exact.setAttribute("aria-hidden", "true");
      exact.textContent = `● ${row.exact}`;
      const partial = document.createElement("span");
      partial.className = "feedback__partial";
      partial.setAttribute("aria-hidden", "true");
      partial.textContent = `○ ${row.partial}`;
      feedback.append(exact, partial);

      item.append(number, pegs, feedback);
      els.history.append(item);
    }
  }

  function render() {
    const focusKey = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.key
      : "";
    const config = activeConfig();
    const playing = state.phase === "play";
    renderGuess(config, playing);
    renderPalette(config, playing);
    renderHistory(config);
    const full = playing && state.current.length === config.pegs && state.current.every((v) => typeof v === "number");
    els.submit.disabled = !full;
    els.clear.disabled = !playing || !state.current.some((v) => typeof v === "number");
    els.start.textContent = state.phase === "idle" ? "Start" : "New game";
    els.summary.hidden = state.phase !== "over";
    paintHud();
    if (focusKey) {
      const target = els.board.querySelector(`[data-key="${focusKey}"]`);
      if (target && !target.disabled) target.focus();
    }
  }

  function tick() {
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }

  function begin() {
    const config = readConfig();
    clearInterval(state.clock);
    state.config = config;
    state.phase = "play";
    state.secret = makeSecret(config.pegs, config.colors, config.repeats);
    state.rows = [];
    state.current = Array(config.pegs).fill(null);
    state.selColor = null;
    state.selSlot = null;
    state.record = false;
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 500);
    els.code.replaceChildren();
    els.code.setAttribute("aria-label", "The hidden code");
    setStatus("Tap a color, then a position. Or tap a position, then a color.");
    render();
  }

  function finish(won) {
    clearInterval(state.clock);
    state.phase = "over";
    state.selColor = null;
    state.selSlot = null;
    state.elapsed = Date.now() - state.started;
    const config = state.config;
    const used = state.rows.length;

    if (won) {
      const previous = readBest(config);
      if (!previous || used < previous) {
        state.record = true;
        writeBest(config, used);
      }
    }

    els.code.replaceChildren();
    els.code.style.setProperty("--n", String(config.pegs));
    for (const value of state.secret) els.code.append(makePeg(value));
    els.code.setAttribute("aria-label", `The code: ${state.secret.map((value) => PALETTE[value].label).join(", ")}`);

    const attempts = used === 1 ? "1 attempt" : `${used} attempts`;
    if (won) {
      els.summaryTitle.textContent = "Code cracked";
      els.summaryText.textContent = state.record
        ? `You cracked it in ${attempts} and ${formatTime(state.elapsed)}. New best.`
        : `You cracked it in ${attempts} and ${formatTime(state.elapsed)}.`;
      setStatus("Code cracked.", "ok");
    } else {
      els.summaryTitle.textContent = "Out of attempts";
      els.summaryText.textContent = `You used all ${config.attempts} attempts. Here is the code.`;
      setStatus("Out of attempts. The code is shown below.", "bad");
    }
    render();
    els.again.focus();
  }

  function place(slot, color) {
    state.current[slot] = color;
    state.selColor = null;
    state.selSlot = null;
  }

  function onPalette(index) {
    if (state.phase !== "play") return;
    if (state.selSlot !== null) {
      place(state.selSlot, index);
    } else {
      state.selColor = state.selColor === index ? null : index;
    }
    render();
  }

  function onSlot(index) {
    if (state.phase !== "play") return;
    const filled = typeof state.current[index] === "number";
    if (state.selColor !== null) {
      place(index, state.selColor);
    } else if (filled) {
      state.current[index] = null;
      state.selSlot = null;
    } else {
      state.selSlot = state.selSlot === index ? null : index;
    }
    render();
  }

  function submit() {
    const config = state.config;
    if (state.phase !== "play") return;
    if (state.current.length !== config.pegs || state.current.some((v) => typeof v !== "number")) return;
    const guess = state.current.slice();
    const { exact, partial } = scoreGuess(state.secret, guess);
    state.rows.push({ guess, exact, partial });
    state.current = Array(config.pegs).fill(null);
    state.selColor = null;
    state.selSlot = null;

    if (exact === config.pegs) {
      finish(true);
      return;
    }
    if (state.rows.length >= config.attempts) {
      finish(false);
      return;
    }
    const left = config.attempts - state.rows.length;
    setStatus(
      `Guess ${state.rows.length}: ${exact} right place, ${partial} wrong place. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
    );
    render();
  }

  function clearRow() {
    if (state.phase !== "play") return;
    state.current = Array(state.config.pegs).fill(null);
    state.selColor = null;
    state.selSlot = null;
    render();
  }

  els.palette.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) onPalette(Number(button.dataset.index));
  });

  els.guess.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) onSlot(Number(button.dataset.index));
  });

  els.submit.addEventListener("click", submit);
  els.clear.addEventListener("click", clearRow);
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  setStatus(idleText());
  render();
})();
