(() => {
  "use strict";

  const BEST_KEY = "mental-game.memory-grid.best";
  const MAX_SIZE = 6;
  const SPEED = { slow: 1.6, normal: 1, fast: 0.65 };

  const settings = GameSettings.mount({
    id: "memory-grid",
    fields: [
      {
        id: "speed",
        label: "Flash speed",
        hint: "How long the pattern stays visible. Applies on the next flash.",
        type: "choice",
        default: "normal",
        options: [
          { value: "slow", label: "Slow" },
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
        ],
      },
      {
        id: "startSize",
        label: "Starting grid",
        hint: "Used the next time you press Start.",
        type: "choice",
        default: "3",
        options: [
          { value: "3", label: "3×3" },
          { value: "4", label: "4×4" },
        ],
      },
      {
        id: "grow",
        label: "Grow the grid",
        hint: "Adds a row and column every two rounds.",
        type: "toggle",
        default: true,
      },
    ],
    onChange(values) {
      if (state.phase !== "idle") return;
      state.size = Number(values.startSize) || 3;
      renderGrid();
      updateHud();
    },
  });

  const els = {
    grid: document.getElementById("grid"),
    status: document.getElementById("status"),
    round: document.getElementById("round"),
    size: document.getElementById("size"),
    tiles: document.getElementById("tile-count"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    start: document.getElementById("start-btn"),
    confirm: document.getElementById("confirm-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    round: 0,
    size: Number(settings.values.startSize) || 3,
    count: 0,
    pattern: new Set(),
    selected: new Set(),
    score: 0,
    best: readBest(),
    record: false,
    timer: 0,
    startSize: Number(settings.values.startSize) || 3,
    grow: settings.values.grow !== false,
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
      /* private mode or blocked storage — best still shows this session */
    }
  }

  function later(fn, ms) {
    clearTimeout(state.timer);
    state.timer = setTimeout(fn, ms);
  }

  function clearTimer() {
    clearTimeout(state.timer);
    state.timer = 0;
  }

  /** Grid grows every two rounds from the chosen start size, up to 6×6. */
  function configFor(round) {
    const start = state.startSize;
    const size = state.grow ? Math.min(start + Math.floor((round - 1) / 2), MAX_SIZE) : start;
    const count = Math.min(start - 1 + round, size * size - 1);
    return { size, count };
  }

  function showDuration(count) {
    const scale = SPEED[settings.values.speed] || 1;
    return Math.round(Math.min(3200, 1100 + count * 160) * scale);
  }

  function sameSet(a, b) {
    if (a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
  }

  function sample(total, count, previous) {
    const cells = Array.from({ length: total }, (_, i) => i);
    let picked = new Set();
    for (let attempt = 0; attempt < 8; attempt++) {
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      picked = new Set(cells.slice(0, count));
      if (!previous || !sameSet(picked, previous)) break;
    }
    return picked;
  }

  function tileButtons() {
    return [...els.grid.querySelectorAll(".tile")];
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = tone ? `status status--${tone}` : "status";
  }

  function updateHud() {
    els.round.textContent = state.round ? String(state.round) : "—";
    els.size.textContent = `${state.size}×${state.size}`;
    els.tiles.textContent = state.count ? String(state.count) : "—";
    els.score.textContent = String(state.score);
    els.best.textContent = String(state.best);
  }

  function renderGrid() {
    els.grid.style.gridTemplateColumns = `repeat(${state.size}, minmax(0, 1fr))`;
    els.grid.replaceChildren();
    const total = state.size * state.size;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / state.size) + 1;
      const col = (i % state.size) + 1;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.index = String(i);
      btn.setAttribute("aria-label", `Row ${row}, column ${col}`);
      btn.setAttribute("aria-pressed", "false");
      btn.disabled = state.phase !== "recall";
      btn.tabIndex = i === 0 ? 0 : -1;
      els.grid.append(btn);
    }
  }

  function paint(kind) {
    for (const btn of tileButtons()) {
      btn.classList.remove("tile--lit", "tile--selected", "tile--correct", "tile--wrong");
      const index = Number(btn.dataset.index);
      const inPattern = state.pattern.has(index);
      const picked = state.selected.has(index);
      if (kind === "lit" && inPattern) btn.classList.add("tile--lit");
      if (kind === "selected" && picked) {
        btn.classList.add("tile--selected");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.setAttribute("aria-pressed", "false");
      }
      if (kind === "result") {
        if (inPattern) btn.classList.add("tile--correct");
        else if (picked) btn.classList.add("tile--wrong");
      }
    }
  }

  function lockTiles(locked) {
    for (const btn of tileButtons()) btn.disabled = locked;
  }

  function beginRecall() {
    state.phase = "recall";
    paint("selected");
    lockTiles(false);
    els.confirm.hidden = false;
    els.confirm.disabled = true;
    setStatus(`Your turn. Select ${state.count} tiles.`);
    const first = els.grid.querySelector(".tile");
    if (first) first.focus();
  }

  function playRound() {
    const previousSize = state.size;
    state.round += 1;
    const next = configFor(state.round);
    const grew = state.round > 1 && next.size !== previousSize;
    state.size = next.size;
    state.count = next.count;
    state.pattern = sample(state.size * state.size, state.count, state.pattern);
    state.selected = new Set();
    state.phase = "watch";
    updateHud();
    renderGrid();
    els.confirm.hidden = true;
    els.summary.hidden = true;
    setStatus(grew ? `Grid is now ${state.size}×${state.size}. Watch.` : "Watch the pattern.");

    later(() => {
      paint("lit");
      later(() => {
        paint("selected");
        beginRecall();
      }, showDuration(state.count));
    }, grew ? 700 : 400);
  }

  function toggle(index) {
    if (state.phase !== "recall") return;
    if (state.selected.has(index)) state.selected.delete(index);
    else state.selected.add(index);
    paint("selected");
    const chosen = state.selected.size;
    els.confirm.disabled = chosen !== state.count;
    setStatus(
      chosen === state.count
        ? `${state.count} tiles selected. Confirm.`
        : `Your turn. Select ${state.count} tiles · ${chosen} chosen.`
    );
  }

  function finish(won) {
    clearTimer();
    lockTiles(true);
    els.confirm.hidden = true;
    paint("result");

    if (won) {
      state.phase = "reveal";
      state.score = state.round;
      const isBest = state.score > state.best;
      if (isBest) {
        state.best = state.score;
        state.record = true;
        writeBest(state.best);
      }
      updateHud();
      setStatus(isBest ? "Correct. New best." : "Correct.", "ok");
      later(playRound, 700);
      return;
    }

    state.phase = "over";
    setStatus("Not a match. Checks are the pattern, crosses are extra.", "bad");
    const cleared =
      state.score === 0
        ? "No rounds cleared yet."
        : `You cleared ${state.score} ${state.score === 1 ? "round" : "rounds"}.`;
    const bestLine = state.record ? " New best." : state.best > 0 ? ` Best is ${state.best}.` : "";
    els.summaryText.textContent = cleared + bestLine;
    els.summary.hidden = false;
    els.again.focus();
  }

  function submit() {
    if (state.phase !== "recall") return;
    if (state.selected.size !== state.count) {
      setStatus(`Select ${state.count} tiles · ${state.selected.size} chosen.`);
      return;
    }
    finish(sameSet(state.selected, state.pattern));
  }

  function begin() {
    clearTimer();
    state.score = 0;
    state.round = 0;
    state.record = false;
    state.pattern = new Set();
    state.startSize = Number(settings.values.startSize) || 3;
    state.grow = settings.values.grow !== false;
    els.start.hidden = true;
    els.summary.hidden = true;
    updateHud();
    playRound();
  }

  els.grid.addEventListener("click", (event) => {
    const btn = event.target.closest(".tile");
    if (!btn) return;
    toggle(Number(btn.dataset.index));
  });

  els.grid.addEventListener("keydown", (event) => {
    const buttons = tileButtons();
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    const size = state.size;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
    if (!delta) return;
    event.preventDefault();
    if (event.key === "ArrowLeft" && current % size === 0) return;
    if (event.key === "ArrowRight" && (current + 1) % size === 0) return;
    const next = current + delta;
    if (next < 0 || next >= buttons.length) return;
    event.preventDefault();
    buttons[current].tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  });

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.confirm.addEventListener("click", submit);

  renderGrid();
  updateHud();
})();
