(() => {
  "use strict";

  function randomDigits(length) {
    let value = "";
    for (let i = 0; i < length; i += 1) value += String(Math.floor(Math.random() * 10));
    return value;
  }

  function reversed(value) {
    return value.split("").reverse().join("");
  }

  if (typeof document === "undefined") {
    globalThis.__reverseDigits = { randomDigits, reversed };
    return;
  }

  const PACE = { slow: 800, normal: 500, fast: 320 };
  const BEST_PREFIX = "mental-game.reverse-digits.best";
  const settings = GameSettings.mount({
    id: "reverse-digits",
    fields: [
      {
        id: "pace",
        label: "Flash speed",
        hint: "How long each digit stays on screen. Applies the next time you press Start.",
        type: "choice",
        default: "normal",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next run begins at 3 digits, ${pace()} speed.`);
    },
  });

  const els = {
    length: document.getElementById("length"),
    cleared: document.getElementById("cleared"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    prompt: document.getElementById("prompt"),
    entry: document.getElementById("entry"),
    pad: document.getElementById("pad"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", length: 3, cleared: 0, number: "", guess: "", timer: 0, record: false };

  function pace() {
    return PACE[settings.values.pace] ? settings.values.pace : "normal";
  }
  function readBest() {
    const value = Number(localStorage.getItem(`${BEST_PREFIX}.${pace()}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(`${BEST_PREFIX}.${pace()}`, String(value)); } catch { /* storage blocked */ }
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud() {
    els.length.textContent = String(state.length);
    els.cleared.textContent = String(state.cleared);
    const best = readBest();
    els.best.textContent = best ? String(best) : "—";
  }
  function paintEntry() {
    els.entry.textContent = state.guess;
  }
  function buildPad() {
    els.pad.replaceChildren();
    for (const label of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--ghost";
      button.textContent = label;
      button.addEventListener("click", () => press(label === "Clear" ? "clear" : label));
      els.pad.append(button);
    }
  }
  function showNumber() {
    clearTimeout(state.timer);
    state.phase = "show";
    state.number = randomDigits(state.length);
    state.guess = "";
    els.prompt.textContent = state.number;
    els.pad.hidden = true;
    paintEntry();
    paintHud();
    setStatus("Remember it.");
    state.timer = setTimeout(ask, state.length * PACE[pace()]);
  }
  function ask() {
    state.phase = "answer";
    els.prompt.textContent = "";
    els.pad.hidden = false;
    setStatus("Type it backward.");
  }
  function press(key) {
    if (state.phase !== "answer") return;
    if (key === "clear") state.guess = "";
    else if (state.guess.length < state.number.length) state.guess += key;
    paintEntry();
    if (state.guess.length === state.number.length) grade();
  }
  function grade() {
    if (state.guess === reversed(state.number)) {
      state.cleared = state.length;
      state.length += 1;
      if (state.cleared > readBest()) state.record = true;
      paintHud();
      setStatus("Correct.", "ok");
      state.phase = "gap";
      state.timer = setTimeout(showNumber, 450);
      return;
    }
    finish();
  }
  function begin() {
    clearTimeout(state.timer);
    state.length = 3;
    state.cleared = 0;
    state.record = false;
    state.guess = "";
    els.summary.hidden = true;
    els.start.hidden = true;
    paintEntry();
    showNumber();
  }
  function finish() {
    clearTimeout(state.timer);
    state.phase = "over";
    if (state.record) writeBest(state.cleared);
    els.prompt.textContent = "";
    els.pad.hidden = true;
    paintHud();
    setStatus(state.cleared ? `Cleared ${state.cleared} digits.` : "Missed the first number.", state.cleared ? "ok" : "bad");
    els.summaryText.textContent = state.record
      ? `Longest number reversed: ${state.cleared} digits. New best.`
      : `Longest number reversed: ${state.cleared} digits.`;
    els.summary.hidden = false;
    paintHud();
  }

  buildPad();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  document.addEventListener("keydown", (event) => {
    if (state.phase !== "answer") return;
    if (/^\d$/.test(event.key)) press(event.key);
    if (event.key === "Backspace") {
      state.guess = state.guess.slice(0, -1);
      paintEntry();
    }
  });
  setStatus(`Press Start. Next run begins at 3 digits, ${pace()} speed.`);
  paintHud();
})();
