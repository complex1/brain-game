(() => {
  "use strict";

  const LETTERS = ["C", "H", "K", "L", "Q", "R", "S", "T"];
  const POSITION_COUNT = 8; // the 3x3 grid minus the center, which shows the letter
  const MATCH_SHARE = 0.3;
  const BASE_TRIALS = 20;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** Which of the `count` scored trials are matches: about 30%, never fewer than 0 or more than all. */
  function planFlags(count) {
    const wobble = Math.floor(Math.random() * 3) - 1;
    const target = Math.min(count, Math.max(0, Math.round(count * MATCH_SHARE) + wobble));
    const flags = new Array(count).fill(false);
    for (let i = 0; i < target; i += 1) flags[i] = true;
    return shuffle(flags);
  }

  /** A random value from 0..size-1 that differs from `avoid`. */
  function otherThan(size, avoid) {
    const pick = Math.floor(Math.random() * (size - 1));
    return pick >= avoid ? pick + 1 : pick;
  }

  /**
   * A session of `trials` trials for an n-back task. The first n trials can never be matches.
   * Each later trial is planned as a match or a non-match per modality; the stimulus is built
   * to equal (match) or differ from (non-match) the one n trials back, so the flags are exact.
   */
  function makeSession(n, trials) {
    const back = Math.max(1, Math.floor(n));
    const total = Math.max(back + 1, Math.floor(trials));
    const positionPlan = planFlags(total - back);
    const letterPlan = planFlags(total - back);
    const list = [];
    for (let i = 0; i < total; i += 1) {
      const trial = { position: 0, letter: "", positionMatch: false, letterMatch: false };
      if (i < back) {
        trial.position = Math.floor(Math.random() * POSITION_COUNT);
        trial.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      } else {
        const earlier = list[i - back];
        trial.positionMatch = positionPlan[i - back];
        trial.letterMatch = letterPlan[i - back];
        trial.position = trial.positionMatch ? earlier.position : otherThan(POSITION_COUNT, earlier.position);
        if (trial.letterMatch) {
          trial.letter = earlier.letter;
        } else {
          const index = otherThan(LETTERS.length, LETTERS.indexOf(earlier.letter));
          trial.letter = LETTERS[index];
        }
      }
      list.push(trial);
    }
    return { n: back, trials: list };
  }

  /** Matches recomputed from the stimuli alone (used to verify the planned flags). */
  function matchesOf(session) {
    return session.trials.map((trial, i) => {
      const earlier = i >= session.n ? session.trials[i - session.n] : null;
      return {
        position: Boolean(earlier) && earlier.position === trial.position,
        letter: Boolean(earlier) && earlier.letter === trial.letter,
      };
    });
  }

  function emptyTally() {
    return { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };
  }

  /**
   * Score presses ([{position: bool, letter: bool}, ...], one entry per trial) over the first
   * `count` trials (default all). Only trials from index n on are scored: the first n trials
   * have nothing to match against. accuracy is the percent of correct decisions over both
   * modalities, or null when nothing was scored.
   */
  function scoreSession(session, presses, count) {
    const limit = Math.min(session.trials.length, count === undefined ? session.trials.length : count);
    const position = emptyTally();
    const letter = emptyTally();
    const tally = (tallies, expected, pressed) => {
      if (expected && pressed) tallies.hits += 1;
      else if (expected) tallies.misses += 1;
      else if (pressed) tallies.falseAlarms += 1;
      else tallies.correctRejections += 1;
    };
    for (let i = session.n; i < limit; i += 1) {
      const trial = session.trials[i];
      const pressed = (presses && presses[i]) || {};
      tally(position, trial.positionMatch, Boolean(pressed.position));
      tally(letter, trial.letterMatch, Boolean(pressed.letter));
    }
    const decisions = 2 * Math.max(0, limit - session.n);
    const correct = position.hits + position.correctRejections + letter.hits + letter.correctRejections;
    return { position, letter, decisions, correct, accuracy: decisions ? (correct / decisions) * 100 : null };
  }

  if (typeof document === "undefined") {
    globalThis.__dualNBack = { LETTERS, POSITION_COUNT, makeSession, matchesOf, scoreSession };
    return;
  }

  const PACE = { relaxed: 3000, normal: 2500, fast: 2000 };
  const GAP_MS = 300; // blank pause at the end of every trial; presses are ignored in it
  const BEST_PREFIX = "mental-game.dual-n-back.best";
  const CELL_OF_POSITION = [0, 1, 2, 3, 5, 6, 7, 8]; // position index -> grid cell (4 is the center)
  const POSITION_NAMES = ["top left", "top", "top right", "left", "right", "bottom left", "bottom", "bottom right"];

  const settings = GameSettings.mount({
    id: "dual-n-back",
    fields: [
      {
        id: "n",
        label: "N (rounds back)",
        hint: "Compare with this many trials ago. Applies the next time you press Start.",
        type: "choice",
        default: "2",
        options: [
          { value: "1", label: "1-back" },
          { value: "2", label: "2-back" },
          { value: "3", label: "3-back" },
        ],
      },
      {
        id: "pace",
        label: "Pace",
        hint: "Time per trial. Applies the next time you press Start.",
        type: "choice",
        default: "normal",
        options: [
          { value: "relaxed", label: "Relaxed" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
      {
        id: "feedback",
        label: "Show feedback",
        hint: "Tints the match buttons green or red after each trial.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase !== "idle") return;
      paintHud();
      setStatus(idleText());
    },
  });

  const els = {
    trial: document.getElementById("trial"),
    accuracy: document.getElementById("accuracy"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    stimulus: document.getElementById("stimulus"),
    posBtn: document.getElementById("pos-btn"),
    letterBtn: document.getElementById("letter-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    results: document.getElementById("results").tBodies[0],
    again: document.getElementById("again-btn"),
  };
  const modes = {
    position: { button: els.posBtn },
    letter: { button: els.letterBtn },
  };

  const state = {
    phase: "idle", // idle | stimulus | gap | over
    run: 0,
    index: -1,
    config: readConfig(),
    session: null,
    presses: [],
    record: false,
    timers: new Set(),
  };
  const cells = [];
  let letterEl = null;

  function readConfig() {
    const n = Number(settings.values.n);
    return {
      n: n === 1 || n === 2 || n === 3 ? n : 2,
      pace: PACE[settings.values.pace] ? settings.values.pace : "normal",
    };
  }
  function idleText() {
    const config = readConfig();
    return `Press Start. ${config.n}-back, ${config.pace} pace, ${BASE_TRIALS + config.n} trials.`;
  }
  function bestKey(config) {
    return `${BEST_PREFIX}.${config.n}.${config.pace}`;
  }
  function readBest(config) {
    try {
      const value = Number(localStorage.getItem(bestKey(config)));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }
  function writeBest(config, value) {
    try { localStorage.setItem(bestKey(config), String(value)); } catch { /* storage blocked */ }
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud() {
    const running = state.phase === "stimulus" || state.phase === "gap";
    const config = state.phase === "idle" ? readConfig() : state.config;
    const total = BASE_TRIALS + config.n;
    els.trial.textContent = `${running ? state.index + 1 : state.phase === "over" ? total : 0} / ${total}`;
    const best = readBest(config);
    els.best.textContent = best ? `${best}%` : "—";
  }
  function paintAccuracy(count) {
    const score = scoreSession(state.session, state.presses, count);
    els.accuracy.textContent = score.accuracy === null ? "—" : `${Math.round(score.accuracy)}%`;
  }

  /** Run a callback after `ms`, unless a newer run has started since. */
  function later(run, fn, ms) {
    const id = setTimeout(() => {
      state.timers.delete(id);
      if (run === state.run) fn();
    }, ms);
    state.timers.add(id);
  }
  function clearTimers() {
    for (const id of state.timers) clearTimeout(id);
    state.timers.clear();
  }

  function buildStimulus() {
    els.stimulus.replaceChildren();
    for (let i = 0; i < 9; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("aria-hidden", "true");
      if (i === 4) {
        cell.classList.add("cell--center");
        letterEl = document.createElement("span");
        letterEl.className = "letter";
        cell.append(letterEl);
      }
      els.stimulus.append(cell);
      cells.push(cell);
    }
  }
  function clearStimulus() {
    for (const cell of cells) cell.classList.remove("is-lit");
    letterEl.textContent = "";
    els.stimulus.setAttribute("aria-label", "No stimulus");
  }
  function showStimulus(trial) {
    clearStimulus();
    cells[CELL_OF_POSITION[trial.position]].classList.add("is-lit");
    letterEl.textContent = trial.letter;
    els.stimulus.setAttribute("aria-label", `Square ${POSITION_NAMES[trial.position]}, letter ${trial.letter}`);
  }

  function resetButtons() {
    for (const mode of Object.values(modes)) {
      mode.button.classList.remove("is-pressed", "is-correct", "is-wrong");
      mode.button.setAttribute("aria-pressed", "false");
    }
  }
  function setButtonsDisabled(disabled) {
    for (const mode of Object.values(modes)) mode.button.disabled = disabled;
  }

  function runTrial(run, index) {
    const trial = state.session.trials[index];
    state.index = index;
    state.phase = "stimulus";
    state.presses[index] = { position: false, letter: false };
    resetButtons();
    showStimulus(trial);
    const scored = index >= state.config.n;
    setButtonsDisabled(!scored);
    paintHud();
    setStatus(scored ? `Same as ${state.config.n} back?` : `Warm-up: remember this (${state.config.n}-back)`);
    later(run, () => endTrial(run, index), PACE[state.config.pace] - GAP_MS);
  }

  function endTrial(run, index) {
    state.phase = "gap";
    clearStimulus();
    if (index >= state.config.n) {
      const trial = state.session.trials[index];
      const pressed = state.presses[index];
      if (settings.values.feedback !== false) {
        for (const [name, mode] of Object.entries(modes)) {
          const expected = name === "position" ? trial.positionMatch : trial.letterMatch;
          mode.button.classList.remove("is-pressed");
          if (expected && pressed[name]) mode.button.classList.add("is-correct");
          else if (expected !== pressed[name]) mode.button.classList.add("is-wrong");
        }
      }
      paintAccuracy(index + 1);
    }
    later(run, () => {
      if (index + 1 < state.session.trials.length) runTrial(run, index + 1);
      else finish();
    }, GAP_MS);
  }

  function press(name) {
    if (state.phase !== "stimulus" || state.index < state.config.n) return;
    const pressed = state.presses[state.index];
    if (pressed[name]) return;
    pressed[name] = true;
    modes[name].button.classList.add("is-pressed");
    modes[name].button.setAttribute("aria-pressed", "true");
  }

  function begin() {
    state.run += 1;
    clearTimers();
    state.config = readConfig();
    state.session = makeSession(state.config.n, BASE_TRIALS + state.config.n);
    state.presses = [];
    state.index = -1;
    state.record = false;
    state.phase = "gap";
    els.summary.hidden = true;
    els.start.hidden = true;
    els.accuracy.textContent = "—";
    resetButtons();
    setButtonsDisabled(true);
    clearStimulus();
    paintHud();
    setStatus("Get ready");
    const run = state.run;
    later(run, () => runTrial(run, 0), 1000);
  }

  function addRow(label, position, letter) {
    const row = document.createElement("tr");
    const head = document.createElement("th");
    head.scope = "row";
    head.textContent = label;
    row.append(head);
    for (const value of [position, letter]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    els.results.append(row);
  }

  function finish() {
    clearTimers();
    state.phase = "over";
    setButtonsDisabled(true);
    resetButtons();
    clearStimulus();
    const score = scoreSession(state.session, state.presses);
    const percent = Math.round(score.accuracy);
    const previous = readBest(state.config);
    if (percent > previous) {
      state.record = true;
      writeBest(state.config, percent);
    }
    paintHud();
    els.accuracy.textContent = `${percent}%`;
    els.results.replaceChildren();
    addRow("Hits", score.position.hits, score.letter.hits);
    addRow("Misses", score.position.misses, score.letter.misses);
    addRow("False alarms", score.position.falseAlarms, score.letter.falseAlarms);
    addRow("Correct rejections", score.position.correctRejections, score.letter.correctRejections);
    setStatus(`Accuracy ${percent}%`, percent >= 80 ? "ok" : undefined);
    els.summaryText.textContent = `Overall accuracy ${percent}% (${score.correct} of ${score.decisions} decisions, ${state.config.n}-back, ${state.config.pace} pace).${state.record ? " New best." : ""}`;
    els.summary.hidden = false;
  }

  buildStimulus();
  els.posBtn.addEventListener("click", () => press("position"));
  els.letterBtn.addEventListener("click", () => press("letter"));
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (document.querySelector(".settings:not([hidden])")) return;
    const key = event.key.toLowerCase();
    if (key === "a") press("position");
    else if (key === "l") press("letter");
  });
  setStatus(idleText());
  paintHud();
  clearStimulus();
})();
