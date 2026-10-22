(() => {
  "use strict";

  const BEST_KEY = "mental-game.sequence-recall.best";
  const TONES = {
    cyan: { label: "Cyan", key: "q", freq: 329.63 },
    yellow: { label: "Yellow", key: "w", freq: 392 },
    green: { label: "Green", key: "a", freq: 493.88 },
    red: { label: "Red", key: "s", freq: 587.33 },
  };
  const IDS = Object.keys(TONES);
  const PACE = {
    slow: { note: 640, gap: 280 },
    normal: { note: 420, gap: 180 },
    fast: { note: 240, gap: 90 },
  };

  const settings = GameSettings.mount({
    id: "sequence-recall",
    fields: [
      {
        id: "speed",
        label: "Playback",
        hint: "How fast the signals flash. Applies on the next sequence.",
        type: "choice",
        default: "normal",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
      {
        id: "sound",
        label: "Sound",
        hint: "Each signal plays its own tone.",
        type: "toggle",
        default: true,
      },
    ],
  });

  const els = {
    round: document.getElementById("round"),
    step: document.getElementById("step"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    pads: document.getElementById("pads"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    sequence: [],
    step: 0,
    cleared: 0,
    record: false,
    timer: 0,
    audio: null,
  };

  function readBest() {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      /* storage blocked — best still shows this session */
    }
  }

  function pace() {
    return PACE[settings.values.speed] || PACE.normal;
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = tone ? `status status--${tone}` : "status";
  }

  function updateHud() {
    const length = state.sequence.length;
    els.round.textContent = length ? String(length) : "—";
    els.step.textContent = state.phase === "input" ? `${state.step}/${length}` : "—";
    els.best.textContent = String(readBest());
  }

  function padButtons() {
    return [...els.pads.querySelectorAll(".pad")];
  }

  function padFor(id) {
    return els.pads.querySelector(`[data-tone="${id}"]`);
  }

  function setLocked(locked) {
    for (const button of padButtons()) button.disabled = locked;
  }

  function clearMarks() {
    for (const button of padButtons()) button.classList.remove("is-lit", "is-wrong", "is-correct");
  }

  function light(id, on) {
    const pad = padFor(id);
    if (!pad) return;
    pad.classList.toggle("is-lit", on);
  }

  function playTone(id, ms) {
    if (settings.values.sound === false) return;
    const spec = TONES[id];
    if (!spec) return;
    try {
      if (!state.audio) state.audio = new AudioContext();
      if (state.audio.state === "suspended") state.audio.resume();
      const now = state.audio.currentTime;
      const osc = state.audio.createOscillator();
      const gain = state.audio.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
      osc.connect(gain);
      gain.connect(state.audio.destination);
      osc.start(now);
      osc.stop(now + ms / 1000);
    } catch {
      /* audio unavailable — the flash still shows the signal */
    }
  }

  function wait(ms) {
    return new Promise((resolve) => {
      state.timer = setTimeout(resolve, ms);
    });
  }

  async function playSequence() {
    const token = state.token;
    const timing = pace();
    state.phase = "watch";
    state.step = 0;
    setLocked(true);
    clearMarks();
    updateHud();
    setStatus("Watch the sequence.");

    for (const id of state.sequence) {
      await wait(timing.gap);
      if (token !== state.token) return;
      light(id, true);
      playTone(id, timing.note);
      await wait(timing.note);
      if (token !== state.token) return;
      light(id, false);
    }

    await wait(timing.gap);
    if (token !== state.token) return;
    state.phase = "input";
    setLocked(false);
    updateHud();
    setStatus("Your turn. Repeat the order.");
  }

  function finish(expectedId, pressedId) {
    state.token += 1;
    clearTimeout(state.timer);
    state.phase = "over";
    setLocked(true);
    clearMarks();
    if (pressedId) {
      const pressed = padFor(pressedId);
      if (pressed) pressed.classList.add("is-wrong");
    }
    if (expectedId) light(expectedId, true);

    const best = readBest();
    if (state.cleared > best) {
      writeBest(state.cleared);
      state.record = true;
    }
    updateHud();

    const cleared =
      state.cleared === 0
        ? "No rounds cleared."
        : `You cleared ${state.cleared} ${state.cleared === 1 ? "round" : "rounds"}.`;
    const bestLine = state.record ? " New best." : best > 0 ? ` Best is ${readBest()}.` : "";
    const expected = expectedId ? ` Next was ${TONES[expectedId].label}.` : "";
    setStatus(`Sequence missed.${expected}`, "bad");
    els.summaryText.textContent = cleared + bestLine;
    els.summary.hidden = false;
    els.again.focus();
  }

  function press(id) {
    if (state.phase !== "input") return;
    const expected = state.sequence[state.step];
    light(id, true);
    playTone(id, 180);
    setTimeout(() => {
      if (state.phase === "input") light(id, false);
    }, 160);

    if (id !== expected) {
      finish(expected, id);
      return;
    }

    state.step += 1;
    updateHud();
    if (state.step < state.sequence.length) return;

    state.cleared = state.sequence.length;
    if (state.cleared > readBest()) {
      state.record = true;
      writeBest(state.cleared);
    }
    state.sequence.push(IDS[Math.floor(Math.random() * IDS.length)]);
    state.phase = "watch";
    setLocked(true);
    updateHud();
    setStatus("Correct.", "ok");
    const token = state.token;
    state.timer = setTimeout(() => {
      if (token === state.token) playSequence();
    }, 450);
  }

  function begin() {
    clearTimeout(state.timer);
    state.token += 1;
    state.sequence = [IDS[Math.floor(Math.random() * IDS.length)]];
    state.step = 0;
    state.cleared = 0;
    state.record = false;
    els.start.hidden = true;
    els.summary.hidden = true;
    clearMarks();
    updateHud();
    playSequence();
  }

  els.pads.addEventListener("click", (event) => {
    const pad = event.target.closest(".pad");
    if (!pad) return;
    press(pad.dataset.tone);
  });

  document.addEventListener("keydown", (event) => {
    if (state.phase !== "input") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    const id = IDS.find((tone) => TONES[tone].key === event.key.toLowerCase());
    if (!id) return;
    event.preventDefault();
    press(id);
  });

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  updateHud();
})();
