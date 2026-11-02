(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.reaction-tap.best";
  const settings = GameSettings.mount({
    id: "reaction-tap",
    fields: [
      {
        id: "rounds",
        label: "Taps",
        hint: "How many good taps make a run. Applies the next time you press Start.",
        type: "choice",
        default: "5",
        options: [
          { value: "5", label: "5" },
          { value: "8", label: "8" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next run: ${rounds()} taps.`);
    },
  });

  const els = {
    round: document.getElementById("round"),
    last: document.getElementById("last"),
    average: document.getElementById("average"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    pad: document.getElementById("pad"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", times: [], shownAt: 0, timer: 0, record: false };

  function rounds() { return Number(settings.values.rounds) === 8 ? 8 : 5; }
  function readBest() {
    const value = Number(localStorage.getItem(`${BEST_PREFIX}.${rounds()}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(`${BEST_PREFIX}.${rounds()}`, String(value)); } catch { /* storage blocked */ }
  }
  function average() {
    if (!state.times.length) return 0;
    return Math.round(state.times.reduce((sum, time) => sum + time, 0) / state.times.length);
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud() {
    els.round.textContent = `${state.times.length}/${rounds()}`;
    els.last.textContent = state.times.length ? `${state.times[state.times.length - 1]} ms` : "—";
    els.average.textContent = state.times.length ? `${average()} ms` : "—";
    const best = readBest();
    els.best.textContent = best ? `${best} ms` : "—";
  }
  function paintPad(mode, label) {
    els.pad.classList.toggle("is-go", mode === "go");
    els.pad.classList.toggle("is-soon", mode === "soon");
    els.pad.textContent = label;
    els.pad.disabled = state.phase === "idle" || state.phase === "over" || state.phase === "gap";
  }
  function wait() {
    clearTimeout(state.timer);
    state.phase = "wait";
    paintPad("wait", "Wait");
    setStatus("Wait for green.");
    const delay = 1200 + Math.random() * 2800;
    state.timer = setTimeout(() => {
      state.phase = "go";
      state.shownAt = performance.now();
      paintPad("go", "Tap");
      setStatus("Tap now.");
    }, delay);
  }
  function begin() {
    clearTimeout(state.timer);
    state.times = [];
    state.record = false;
    els.summary.hidden = true;
    els.start.hidden = true;
    paintHud();
    wait();
  }
  function finish() {
    clearTimeout(state.timer);
    state.phase = "over";
    const mean = average();
    const previous = readBest();
    if (!previous || mean < previous) {
      state.record = true;
      writeBest(mean);
    }
    paintHud();
    paintPad("", "Done");
    setStatus(`Average ${mean} ms.`, "ok");
    els.summaryText.textContent = state.record
      ? `Average ${mean} ms over ${state.times.length} taps. New best.`
      : `Average ${mean} ms over ${state.times.length} taps.`;
    els.summary.hidden = false;
  }
  function tap() {
    if (state.phase === "wait") {
      clearTimeout(state.timer);
      state.phase = "soon";
      paintPad("soon", "Too soon");
      setStatus("Too soon. Wait for green.", "bad");
      state.timer = setTimeout(wait, 700);
      return;
    }
    if (state.phase !== "go") return;
    const elapsed = Math.max(1, Math.round(performance.now() - state.shownAt));
    state.times.push(elapsed);
    paintHud();
    if (state.times.length >= rounds()) {
      finish();
      return;
    }
    state.phase = "gap";
    paintPad("", `${elapsed} ms`);
    setStatus(`${elapsed} ms.`, "ok");
    state.timer = setTimeout(wait, 600);
  }

  els.pad.addEventListener("click", tap);
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  document.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (document.activeElement === els.start || document.activeElement === els.again) return;
    if (state.phase === "wait" || state.phase === "go") {
      event.preventDefault();
      tap();
    }
  });
  setStatus(`Press Start. Next run: ${rounds()} taps.`);
  paintHud();
})();
