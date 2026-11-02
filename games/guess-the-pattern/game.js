(() => {
  "use strict";

  const PALETTE = [
    { id: "red", label: "Red" },
    { id: "white", label: "White" },
    { id: "yellow", label: "Yellow" },
    { id: "green", label: "Green" },
    { id: "cyan", label: "Cyan" },
    { id: "violet", label: "Violet" },
  ];

  function colorsFor(size) {
    if (size === 4) return PALETTE.slice(0, 4);
    if (size === 6) return PALETTE.slice();
    return PALETTE.slice(0, 5);
  }

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

  function correctCount(guess, secret) {
    let count = 0;
    for (let i = 0; i < secret.length; i += 1) {
      if (guess[i] === secret[i]) count += 1;
    }
    return count;
  }

  function deal(colors) {
    const secret = shuffle(colors).map((color) => color.id);
    let tray = shuffle(secret);
    for (let guard = 0; tray.join() === secret.join() && guard < 12; guard += 1) {
      tray = shuffle(secret);
    }
    return { secret, tray };
  }

  function feedback(count) {
    if (count === 0) return "None are in the correct place.";
    if (count === 1) return "1 is in the correct place.";
    return `${count} are in the correct place.`;
  }

  if (typeof document === "undefined") {
    globalThis.__guessPattern = { colorsFor, correctCount, deal, feedback };
    return;
  }

  const BEST_PREFIX = "mental-game.guess-the-pattern.best";

  const settings = GameSettings.mount({
    id: "guess-the-pattern",
    fields: [
      {
        id: "size",
        label: "Colors",
        hint: "How many blocks are in the hidden order. Applies to the next pattern.",
        type: "choice",
        default: "5",
        options: [
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Drag the colors into the row. Next pattern: ${size()} colors.`);
    },
  });

  const els = {
    checks: document.getElementById("checks"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    table: document.getElementById("table"),
    tray: document.getElementById("tray"),
    check: document.getElementById("check-btn"),
    start: document.getElementById("start-btn"),
    result: document.getElementById("result"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    ghost: document.getElementById("ghost"),
  };

  const state = {
    phase: "idle",
    secret: [],
    slots: [],
    tray: [],
    placed: null,
    checks: 0,
    picked: null,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  const drag = { id: null, pointer: 0, x: 0, y: 0, moved: false };
  let suppressClick = false;

  function size() {
    const value = Number(settings.values.size);
    return value === 4 || value === 6 ? value : 5;
  }

  function colorOf(id) {
    return PALETTE.find((color) => color.id === id);
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function readBest(length) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${length}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(length, ms) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${length}`, String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function paintHud() {
    els.checks.textContent = String(state.checks);
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.secret.length || size());
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function locationOf(id) {
    const slot = state.slots.indexOf(id);
    if (slot >= 0) return { kind: "slot", index: slot };
    return { kind: "tray" };
  }

  function place(id, target) {
    const from = locationOf(id);
    if (from.kind === "slot") state.slots[from.index] = null;
    else state.tray = state.tray.filter((color) => color !== id);

    if (target.kind === "tray") {
      state.tray.push(id);
      return;
    }

    const occupant = state.slots[target.index];
    state.slots[target.index] = id;
    if (!occupant) return;
    if (from.kind === "slot") state.slots[from.index] = occupant;
    else state.tray.push(occupant);
  }

  function makeChip(id, where) {
    const color = colorOf(id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.draggable = state.phase === "play";
    if (state.picked === id) button.classList.add("is-picked");
    button.dataset.color = id;
    const placeName = where.kind === "slot" ? `Position ${where.index + 1}` : "the color list";
    button.setAttribute("aria-label", `${color.label}, ${placeName}`);
    button.setAttribute("aria-pressed", state.picked === id ? "true" : "false");

    const swatch = document.createElement("span");
    swatch.className = "chip__swatch";
    swatch.dataset.color = id;
    swatch.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "chip__name";
    name.textContent = color.label;
    button.append(swatch, name);
    return button;
  }

  function swallowClick() {
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
  }

  function render() {
    const length = state.slots.length || size();
    const slots = state.slots.length ? state.slots : Array(length).fill(null);
    els.table.style.setProperty("--n", String(length));
    els.table.replaceChildren();
    slots.forEach((id, index) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = String(index);
      slot.setAttribute("role", "listitem");
      const marker = document.createElement("span");
      marker.className = "slot__index";
      marker.textContent = String(index + 1);
      slot.append(marker);
      if (id) {
        slot.append(makeChip(id, { kind: "slot", index }));
      } else {
        const empty = document.createElement("button");
        empty.type = "button";
        empty.className = "slot__empty";
        empty.textContent = "Empty";
        empty.disabled = state.phase !== "play";
        empty.setAttribute("aria-label", `Position ${index + 1}, empty`);
        slot.append(empty);
      }
      els.table.append(slot);
    });

    els.tray.replaceChildren();
    for (const id of state.tray) els.tray.append(makeChip(id, { kind: "tray" }));

    if (state.placed === null) {
      els.result.hidden = true;
      els.result.textContent = "";
      els.result.classList.remove("is-ok");
    } else {
      els.result.hidden = false;
      els.result.textContent = state.placed === state.secret.length
        ? `All ${state.secret.length} are in the correct place.`
        : feedback(state.placed);
      els.result.classList.toggle("is-ok", state.placed === state.secret.length);
    }
    els.check.disabled = state.phase !== "play" || state.slots.some((id) => !id);
    els.summary.hidden = state.phase !== "over";
    paintHud();
  }

  function tick() {
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }

  function begin() {
    const colors = colorsFor(size());
    const dealt = deal(colors);
    clearInterval(state.clock);
    state.phase = "play";
    state.secret = dealt.secret;
    state.slots = Array(colors.length).fill(null);
    state.tray = dealt.tray;
    state.placed = null;
    state.checks = 0;
    state.picked = null;
    state.record = false;
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 200);
    els.start.textContent = "New pattern";
    setStatus("Drag a color into a position, or tap a color and then a position.");
    render();
  }

  function finish() {
    clearInterval(state.clock);
    state.phase = "over";
    state.picked = null;
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.secret.length);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.secret.length, state.elapsed);
    }
    const checks = state.checks === 1 ? "1 check" : `${state.checks} checks`;
    els.summaryText.textContent = state.record
      ? `All ${state.secret.length} colors are in the correct place in ${formatTime(state.elapsed)}. ${checks}. New best.`
      : `All ${state.secret.length} colors are in the correct place in ${formatTime(state.elapsed)}. ${checks}.`;
    setStatus(`All ${state.secret.length} are in the correct place.`, "ok");
    render();
  }

  function check() {
    if (state.phase !== "play" || state.slots.some((id) => !id)) return;
    state.placed = correctCount(state.slots, state.secret);
    state.checks += 1;
    if (state.placed === state.secret.length) finish();
    else render();
  }

  function pick(id) {
    if (state.phase !== "play") return;
    if (state.picked && state.picked !== id) {
      place(state.picked, locationOf(id));
      state.picked = null;
    } else {
      state.picked = state.picked === id ? null : id;
    }
    render();
  }

  function showGhost(id, x, y) {
    const color = colorOf(id);
    els.ghost.hidden = false;
    els.ghost.replaceChildren();
    const swatch = document.createElement("span");
    swatch.className = "chip__swatch";
    swatch.dataset.color = id;
    const name = document.createElement("span");
    name.className = "chip__name";
    name.textContent = color.label;
    els.ghost.append(swatch, name);
    els.ghost.style.left = `${x}px`;
    els.ghost.style.top = `${y}px`;
  }

  function hideGhost() {
    els.ghost.hidden = true;
    document.querySelectorAll(".is-over, .is-dragging").forEach((node) => {
      node.classList.remove("is-over", "is-dragging");
    });
  }

  function dropTarget(x, y) {
    const node = document.elementFromPoint(x, y);
    const slot = node && node.closest(".slot");
    if (slot) return { kind: "slot", index: Number(slot.dataset.index) };
    if (node && node.closest(".tray")) return { kind: "tray" };
    return null;
  }

  function markDrop(x, y) {
    document.querySelectorAll(".is-over").forEach((node) => node.classList.remove("is-over"));
    const node = document.elementFromPoint(x, y);
    const zone = node && (node.closest(".slot") || node.closest(".tray"));
    if (zone) zone.classList.add("is-over");
  }

  function onPointerDown(event) {
    const chip = event.target.closest(".chip");
    if (!chip || state.phase !== "play" || event.button > 0) return;
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    drag.id = chip.dataset.color;
    drag.pointer = event.pointerId;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved = false;
    chip.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (event.pointerId !== drag.pointer || !drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && dx * dx + dy * dy < 36) return;
    drag.moved = true;
    const chip = els.board.querySelector(`.chip[data-color="${drag.id}"]`);
    if (chip) chip.classList.add("is-dragging");
    showGhost(drag.id, event.clientX, event.clientY);
    markDrop(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    if (event.pointerId !== drag.pointer || !drag.id) return;
    const id = drag.id;
    const moved = drag.moved;
    drag.id = null;
    drag.pointer = 0;
    hideGhost();
    swallowClick();
    if (!moved) {
      pick(id);
      return;
    }
    const target = dropTarget(event.clientX, event.clientY);
    if (target) {
      state.picked = null;
      place(id, target);
    }
    render();
  }

  els.board.addEventListener("dragstart", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip || state.phase !== "play") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", chip.dataset.color);
    event.dataTransfer.effectAllowed = "move";
    chip.classList.add("is-dragging");
  });

  els.board.addEventListener("dragover", (event) => {
    const zone = event.target.closest(".slot, .tray");
    if (!zone || state.phase !== "play") return;
    event.preventDefault();
    document.querySelectorAll(".is-over").forEach((node) => node.classList.remove("is-over"));
    zone.classList.add("is-over");
  });

  els.board.addEventListener("drop", (event) => {
    const zone = event.target.closest(".slot, .tray");
    if (!zone || state.phase !== "play") return;
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (!id) return;
    swallowClick();
    state.picked = null;
    place(id, zone.classList.contains("slot") ? { kind: "slot", index: Number(zone.dataset.index) } : { kind: "tray" });
    render();
  });

  els.board.addEventListener("dragend", hideGhost);
  els.board.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  els.board.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const chip = event.target.closest(".chip");
    if (chip) {
      pick(chip.dataset.color);
      return;
    }
    const empty = event.target.closest(".slot__empty");
    if (!empty || !state.picked || state.phase !== "play") return;
    place(state.picked, { kind: "slot", index: Number(empty.closest(".slot").dataset.index) });
    state.picked = null;
    render();
  });

  els.check.addEventListener("click", check);
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);

  setStatus(`Drag the colors into the row. Next pattern: ${size()} colors.`);
  render();
})();
