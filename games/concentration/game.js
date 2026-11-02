(() => {
  "use strict";

  const FACES = ["Sun", "Moon", "Star", "Leaf", "Drop", "Bolt", "Heart", "Key", "Fish", "Book", "Bell", "Gem"];

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const held = copy[i];
      copy[i] = copy[j];
      copy[j] = held;
    }
    return copy;
  }

  function deal(pairs) {
    return shuffle(FACES.slice(0, pairs).flatMap((face) => [face, face]));
  }

  if (typeof document === "undefined") {
    globalThis.__concentration = { deal };
    return;
  }

  const BEST_PREFIX = "mental-game.concentration.best";
  const settings = GameSettings.mount({
    id: "concentration",
    fields: [
      {
        id: "pairs",
        label: "Pairs",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "8",
        options: [
          { value: "6", label: "6 pairs" },
          { value: "8", label: "8 pairs" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next board: ${pairCount()} pairs.`);
    },
  });

  const els = {
    moves: document.getElementById("moves"),
    pairs: document.getElementById("pairs"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", cards: [], open: [], matched: 0, moves: 0, lock: false, started: 0, elapsed: 0, clock: 0, record: false };

  function pairCount() { return Number(settings.values.pairs) === 6 ? 6 : 8; }
  function readBest() {
    const value = Number(localStorage.getItem(`${BEST_PREFIX}.${pairCount()}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(`${BEST_PREFIX}.${pairCount()}`, String(value)); } catch { /* storage blocked */ }
  }
  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
  }
  function paintHud() {
    const total = state.cards.length ? state.cards.length / 2 : pairCount();
    els.moves.textContent = String(state.moves);
    els.pairs.textContent = `${state.matched}/${total}`;
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest();
    els.best.textContent = best ? formatTime(best) : "—";
  }
  function render() {
    els.grid.replaceChildren();
    state.cards.forEach((card, index) => {
      const up = card.matched || state.open.includes(index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `card${up ? " is-up" : " is-down"}${card.matched ? " is-matched" : ""}`;
      button.textContent = up ? card.face : "";
      button.disabled = state.phase !== "play" || card.matched;
      button.setAttribute("aria-label", up ? card.face : `Card ${index + 1}, face down`);
      button.addEventListener("click", () => flip(index));
      els.grid.append(button);
    });
    paintHud();
  }
  function tick() {
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }
  function begin() {
    clearInterval(state.clock);
    state.cards = deal(pairCount()).map((face) => ({ face, matched: false }));
    state.open = [];
    state.matched = 0;
    state.moves = 0;
    state.lock = false;
    state.record = false;
    state.phase = "play";
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 200);
    els.summary.hidden = true;
    els.start.hidden = true;
    setStatus("Flip two cards.");
    render();
  }
  function finish() {
    clearInterval(state.clock);
    state.phase = "over";
    state.elapsed = Date.now() - state.started;
    const previous = readBest();
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.elapsed);
    }
    setStatus("Every pair is open.", "ok");
    els.summaryText.textContent = state.record
      ? `Cleared ${state.cards.length / 2} pairs in ${formatTime(state.elapsed)}, ${state.moves} moves. New best.`
      : `Cleared ${state.cards.length / 2} pairs in ${formatTime(state.elapsed)}, ${state.moves} moves.`;
    els.summary.hidden = false;
    render();
  }
  function flip(index) {
    if (state.phase !== "play" || state.lock || state.cards[index].matched || state.open.includes(index)) return;
    state.open.push(index);
    render();
    if (state.open.length < 2) return;
    state.moves += 1;
    const [first, second] = state.open;
    if (state.cards[first].face === state.cards[second].face) {
      state.cards[first].matched = true;
      state.cards[second].matched = true;
      state.open = [];
      state.matched += 1;
      paintHud();
      render();
      if (state.matched === state.cards.length / 2) finish();
      else setStatus("Pair found.", "ok");
      return;
    }
    state.lock = true;
    setStatus("Not a pair.");
    setTimeout(() => {
      state.open = [];
      state.lock = false;
      if (state.phase === "play") render();
    }, 700);
  }

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(`Press Start. Next board: ${pairCount()} pairs.`);
  paintHud();
})();
