(() => {
  "use strict";

  const BLOCK_COUNT = 9;
  const BLOCK_SIZE = 18; // percent of the board width (and height: the board is square)
  // Fixed hand-written layout: top-left corner of each block, in percent of the board.
  const LAYOUT = [
    { x: 6, y: 8 },
    { x: 40, y: 4 },
    { x: 74, y: 12 },
    { x: 22, y: 32 },
    { x: 58, y: 36 },
    { x: 4, y: 58 },
    { x: 38, y: 62 },
    { x: 72, y: 64 },
    { x: 46, y: 82 },
  ];

  /**
   * Random block sequence of `length` blocks out of `blocks`. The same block may
   * repeat but never twice in a row. When a previous sequence is given, the new one
   * starts on a different block so consecutive rounds do not open the same way.
   */
  function makeSequence(length, blocks, previous) {
    const count = Math.max(1, Math.floor(length));
    const total = Math.max(2, Math.floor(blocks));
    const before = Array.isArray(previous) ? previous : [];
    let sequence = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      sequence = [];
      for (let i = 0; i < count; i += 1) {
        let block = Math.floor(Math.random() * total);
        if (i > 0 && block === sequence[i - 1]) block = (block + 1 + Math.floor(Math.random() * (total - 1))) % total;
        sequence.push(block);
      }
      if (before.length === 0 || sequence[0] !== before[0]) break;
    }
    return sequence;
  }

  /** The order the player must tap. */
  function expectedOrder(sequence, direction) {
    const order = sequence.slice();
    return direction === "backward" ? order.reverse() : order;
  }

  /**
   * Judge the taps so far: "wrong" (first bad tap at `index`), "partial" or "complete".
   * For partial/complete, `index` is the number of correct taps.
   */
  function check(sequence, taps, direction) {
    const expected = expectedOrder(sequence, direction);
    for (let i = 0; i < taps.length; i += 1) {
      if (i >= expected.length || taps[i] !== expected[i]) return { status: "wrong", index: i };
    }
    return { status: taps.length === expected.length ? "complete" : "partial", index: taps.length };
  }

  if (typeof document === "undefined") {
    globalThis.__corsiBlocks = { LAYOUT, BLOCK_SIZE, BLOCK_COUNT, makeSequence, expectedOrder, check };
    return;
  }

  const SPEED = { slow: 900, normal: 650, fast: 420 };
  const LIT_SHARE = 0.7; // part of each step the block stays lit; the rest is the gap
  const START_LENGTH = 2;
  const BEST_PREFIX = "mental-game.corsi-blocks.best";

  const settings = GameSettings.mount({
    id: "corsi-blocks",
    fields: [
      {
        id: "direction",
        label: "Direction",
        hint: "Forward repeats the order you saw. Backward asks for it in reverse. Applies the next time you press Start.",
        type: "choice",
        default: "forward",
        options: [
          { value: "forward", label: "Forward" },
          { value: "backward", label: "Backward" },
        ],
      },
      {
        id: "speed",
        label: "Speed",
        hint: "How long each block step lasts. Applies the next time you press Start.",
        type: "choice",
        default: "normal",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
      {
        id: "showTaps",
        label: "Show where you tapped",
        hint: "Briefly tints each block you tap.",
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
    length: document.getElementById("length"),
    span: document.getElementById("span"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle", // idle | showing | answer | over
    run: 0,
    length: START_LENGTH,
    span: 0,
    record: false,
    config: readConfig(),
    sequence: [],
    taps: [],
    timers: new Set(),
  };
  const blocks = [];

  function readConfig() {
    const direction = settings.values.direction === "backward" ? "backward" : "forward";
    const speed = SPEED[settings.values.speed] ? settings.values.speed : "normal";
    return { direction, speed };
  }
  function idleText() {
    const config = readConfig();
    return `Press Start. ${config.direction === "backward" ? "Backward" : "Forward"} order, ${config.speed} speed.`;
  }
  function bestKey(config) {
    return `${BEST_PREFIX}.${config.direction}.${config.speed}`;
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
    els.length.textContent = String(state.length);
    els.span.textContent = String(state.span);
    const best = readBest(state.phase === "idle" ? readConfig() : state.config);
    els.best.textContent = best ? String(best) : "—";
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
  function setBlocksDisabled(disabled) {
    for (const block of blocks) block.disabled = disabled;
  }
  function clearBlockClasses() {
    for (const block of blocks) block.classList.remove("is-lit", "is-tapped", "is-wrong");
  }

  function buildBoard() {
    els.board.replaceChildren();
    LAYOUT.forEach((spot, index) => {
      const block = document.createElement("button");
      block.type = "button";
      block.className = "block";
      block.disabled = true;
      block.style.setProperty("--x", String(spot.x));
      block.style.setProperty("--y", String(spot.y));
      block.setAttribute("aria-label", `Block ${index + 1} of ${BLOCK_COUNT}`);
      block.addEventListener("click", () => tap(index));
      els.board.append(block);
      blocks.push(block);
    });
  }

  function startRound(run) {
    state.phase = "showing";
    state.taps = [];
    state.sequence = makeSequence(state.length, BLOCK_COUNT, state.sequence);
    setBlocksDisabled(true);
    clearBlockClasses();
    paintHud();
    setStatus("Watch");
    later(run, () => lightStep(run, 0), 600);
  }

  function lightStep(run, step) {
    if (step >= state.sequence.length) {
      startAnswer();
      return;
    }
    const total = SPEED[state.config.speed];
    const lit = Math.round(total * LIT_SHARE);
    const block = blocks[state.sequence[step]];
    block.classList.add("is-lit");
    later(run, () => {
      block.classList.remove("is-lit");
      later(run, () => lightStep(run, step + 1), total - lit);
    }, lit);
  }

  function startAnswer() {
    state.phase = "answer";
    setBlocksDisabled(false);
    setStatus(`Your turn — ${state.taps.length} of ${state.sequence.length}`);
  }

  function tap(index) {
    if (state.phase !== "answer") return;
    const run = state.run;
    state.taps.push(index);
    const block = blocks[index];
    if (settings.values.showTaps !== false) {
      block.classList.add("is-tapped");
      later(run, () => block.classList.remove("is-tapped"), 220);
    }
    const result = check(state.sequence, state.taps, state.config.direction);
    if (result.status === "wrong") {
      finish(index);
    } else if (result.status === "complete") {
      state.phase = "showing";
      setBlocksDisabled(true);
      state.span = state.sequence.length;
      state.length = state.sequence.length + 1;
      paintHud();
      setStatus(`Correct — next length ${state.length}`, "ok");
      later(run, () => startRound(run), 900);
    } else {
      setStatus(`Your turn — ${state.taps.length} of ${state.sequence.length}`);
    }
  }

  function begin() {
    state.run += 1;
    clearTimers();
    state.config = readConfig();
    state.length = START_LENGTH;
    state.span = 0;
    state.record = false;
    state.sequence = [];
    state.taps = [];
    els.summary.hidden = true;
    els.start.hidden = true;
    clearBlockClasses();
    startRound(state.run);
  }

  function finish(wrongIndex) {
    clearTimers();
    state.phase = "over";
    setBlocksDisabled(true);
    clearBlockClasses();
    blocks[wrongIndex].classList.add("is-wrong");
    const previous = readBest(state.config);
    if (state.span > previous) {
      state.record = true;
      writeBest(state.config, state.span);
    }
    paintHud();
    const order = state.config.direction === "backward" ? "backward" : "forward";
    setStatus(state.span ? `Wrong block. Span ${state.span}.` : "Wrong block on the first sequence.", "bad");
    els.summaryText.textContent = state.span
      ? `Longest sequence reproduced (${order}, ${state.config.speed}): ${state.span} blocks.${state.record ? " New best." : ""}`
      : `No sequence reproduced (${order}, ${state.config.speed}). Try again.`;
    els.summary.hidden = false;
  }

  buildBoard();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(idleText());
  paintHud();
})();
