(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.find-the-number.best";
  const DISKS = ["outer", "middle", "inner"];
  const RINGS = [46, 32, 18];
  const MIN_COUNT = 6;
  const MAX_COUNT = 42;
  const PACE = { slow: "1.5", normal: "1", fast: "0.68" };

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function countOf(value) {
    const count = Math.round(Number(value));
    if (!Number.isFinite(count)) return 9;
    return Math.min(MAX_COUNT, Math.max(MIN_COUNT, count));
  }

  function shares(count) {
    const weight = RINGS.reduce((sum, ring) => sum + ring, 0);
    const exact = RINGS.map((ring) => (ring / weight) * count);
    const counts = exact.map((value) => Math.floor(value));
    let left = count - counts.reduce((sum, value) => sum + value, 0);
    exact
      .map((value, index) => ({ index, extra: value - counts[index] }))
      .sort((a, b) => b.extra - a.extra)
      .forEach((item) => {
        if (left <= 0) return;
        counts[item.index] += 1;
        left -= 1;
      });
    return counts;
  }

  function tokenSize(counts) {
    let gap = Infinity;
    counts.forEach((count, index) => {
      if (!count) return;
      gap = Math.min(gap, 2 * RINGS[index] * Math.sin(Math.PI / count));
    });
    const size = Math.min(11, Math.max(7, gap * 0.72));
    return `${size.toFixed(2)}cqw`;
  }

  function deal(count) {
    const numbers = shuffle([...Array(count).keys()].map((index) => index + 1));
    return shares(count).map((quota) => {
      const group = numbers.splice(0, quota);
      const offset = Math.random() * 360;
      const step = 360 / group.length;
      return group.map((number, index) => ({
        number,
        angle: offset + step * index,
      }));
    });
  }

  const settings = GameSettings.mount({
    id: "find-the-number",
    fields: [
      {
        id: "count",
        label: "Numbers",
        hint: "How many numbers are spread across the three disks. 42 is the limit.",
        type: "range",
        min: MIN_COUNT,
        max: MAX_COUNT,
        step: 1,
        default: "9",
      },
      {
        id: "speed",
        label: "Speed",
        hint: "How fast the disks spin. Applies to the next round.",
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
      if (state.phase === "idle") showIdle();
    },
  });

  const els = {
    next: document.getElementById("next"),
    found: document.getElementById("found"),
    misses: document.getElementById("misses"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    orbit: document.getElementById("orbit"),
    hub: document.getElementById("hub"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    total: 9,
    next: 1,
    found: 0,
    misses: 0,
    speed: "normal",
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function speedLabel(value) {
    if (value === "slow") return "Slow";
    if (value === "fast") return "Fast";
    return "Normal";
  }

  function readBest(count) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${count}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(count, ms) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${count}`, String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest(count) {
    const best = readBest(count);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function clearDisks() {
    for (const name of DISKS) {
      const disk = els.orbit.querySelector(`[data-disk="${name}"]`);
      disk.replaceChildren();
    }
  }

  function paint() {
    els.next.textContent = state.phase === "play" ? String(state.next) : "—";
    els.found.textContent = state.total ? `${state.found}/${state.total}` : "0";
    els.misses.textContent = String(state.misses);
    els.misses.classList.toggle("is-low", state.misses > 0);
    els.hub.textContent = state.phase === "play" ? String(state.next) : state.phase === "done" ? "✓" : "—";
  }

  function build(layout) {
    clearDisks();
    els.orbit.style.setProperty("--token", tokenSize(layout.map((spots) => spots.length)));
    layout.forEach((spots, index) => {
      const disk = els.orbit.querySelector(`[data-disk="${DISKS[index]}"]`);
      for (const spot of spots) {
        const slot = document.createElement("div");
        slot.className = "slot";
        slot.style.setProperty("--angle", `${spot.angle}deg`);
        const upright = document.createElement("div");
        upright.className = "upright";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "token";
        button.dataset.number = String(spot.number);
        button.textContent = String(spot.number);
        button.setAttribute("aria-label", `Number ${spot.number}`);
        button.addEventListener("click", () => choose(spot.number, button));
        upright.append(button);
        slot.append(upright);
        disk.append(slot);
      }
    });
  }

  function choose(number, button) {
    if (state.phase !== "play" || button.disabled) return;
    if (number !== state.next) {
      state.misses += 1;
      button.classList.add("is-wrong");
      window.setTimeout(() => button.classList.remove("is-wrong"), 320);
      setStatus(`Next is ${state.next}.`, "bad");
      paint();
      return;
    }
    state.found += 1;
    button.classList.add("is-found");
    button.disabled = true;
    if (state.found === state.total) {
      finish();
      return;
    }
    state.next += 1;
    setStatus(`Next is ${state.next}.`);
    paint();
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function showIdle() {
    state.phase = "idle";
    state.total = countOf(settings.values.count);
    state.next = 1;
    state.found = 0;
    state.misses = 0;
    state.speed = settings.values.speed || "normal";
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.orbit.classList.remove("is-live");
    els.orbit.style.setProperty("--pace", PACE[state.speed] || "1");
    clearDisks();
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest(state.total);
    paint();
    setStatus(
      `Outer and inner spin clockwise, middle spins back. Next round: ${state.total} numbers, ${speedLabel(state.speed).toLowerCase()} speed.`
    );
  }

  function begin() {
    if (state.phase === "building") return;
    const total = countOf(settings.values.count);
    const speed = settings.values.speed || "normal";
    state.phase = "play";
    state.total = total;
    state.next = 1;
    state.found = 0;
    state.misses = 0;
    state.speed = speed;
    state.record = false;
    state.started = Date.now();
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "New round";
    els.time.textContent = "0:00";
    els.orbit.style.setProperty("--pace", PACE[speed] || "1");
    showBest(total);
    build(deal(total));
    els.orbit.classList.add("is-live");
    setStatus("Next is 1.");
    paint();
    tick();
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.total);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.total, state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    const best = formatTime(readBest(state.total));
    const misses = state.misses === 0 ? "no misses" : state.misses === 1 ? "1 miss" : `${state.misses} misses`;
    els.time.textContent = clock;
    showBest(state.total);
    els.orbit.classList.remove("is-live");
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Found 1–${state.total} in ${clock} with ${misses}. New best.`
      : `Found 1–${state.total} in ${clock} with ${misses}. Best is ${best}.`;
    setStatus("Sequence complete.", "ok");
    paint();
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
