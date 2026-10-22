(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.hashi.best";

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function crosses(a, b) {
    const ah = a.r1 === a.r2;
    const bh = b.r1 === b.r2;
    if (ah === bh) return false;
    const h = ah ? a : b;
    const v = ah ? b : a;
    return v.c1 > Math.min(h.c1, h.c2) && v.c1 < Math.max(h.c1, h.c2) && h.r1 > Math.min(v.r1, v.r2) && h.r1 < Math.max(v.r1, v.r2);
  }

  function grow(n, target) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const islands = [[Math.floor(Math.random() * n), Math.floor(Math.random() * n)]];
      const bridges = [];
      let guard = 0;
      while (islands.length < target && guard < 500) {
        guard++;
        const parent = islands[Math.floor(Math.random() * islands.length)];
        const horizontal = Math.random() < 0.5;
        const next = horizontal ? [parent[0], Math.floor(Math.random() * n)] : [Math.floor(Math.random() * n), parent[1]];
        if (next[0] === parent[0] && next[1] === parent[1]) continue;
        if (islands.some((spot) => spot[0] === next[0] && spot[1] === next[1])) continue;
        const covers = bridges.some((bridge) => {
          if (bridge.r1 === bridge.r2 && next[0] === bridge.r1) return next[1] > Math.min(bridge.c1, bridge.c2) && next[1] < Math.max(bridge.c1, bridge.c2);
          if (bridge.c1 === bridge.c2 && next[1] === bridge.c1) return next[0] > Math.min(bridge.r1, bridge.r2) && next[0] < Math.max(bridge.r1, bridge.r2);
          return false;
        });
        if (covers) continue;
        const blocked = islands.some((spot) => {
          if (horizontal && spot[0] === parent[0]) return spot[1] > Math.min(parent[1], next[1]) && spot[1] < Math.max(parent[1], next[1]);
          if (!horizontal && spot[1] === parent[1]) return spot[0] > Math.min(parent[0], next[0]) && spot[0] < Math.max(parent[0], next[0]);
          return false;
        });
        if (blocked) continue;
        const edge = { a: islands.length, b: islands.indexOf(parent), r1: parent[0], c1: parent[1], r2: next[0], c2: next[1], count: 1 };
        if (bridges.some((other) => crosses(other, edge))) continue;
        bridges.push(edge);
        islands.push(next);
      }
      if (islands.length === target) return { islands, bridges };
    }
    return null;
  }

  function countSolutions(islands, limit, deadline) {
    const possible = [];
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const a = islands[i];
        const b = islands[j];
        if (a.r !== b.r && a.c !== b.c) continue;
        const blocked = islands.some((island, k) => {
          if (k === i || k === j) return false;
          if (a.r === b.r) return island.r === a.r && island.c > Math.min(a.c, b.c) && island.c < Math.max(a.c, b.c);
          return island.c === a.c && island.r > Math.min(a.r, b.r) && island.r < Math.max(a.r, b.r);
        });
        if (!blocked) possible.push({ a: i, b: j, r1: a.r, c1: a.c, r2: b.r, c2: b.c });
      }
    }
    const count = Array(possible.length).fill(0);
    let found = 0;
    let aborted = false;
    function degree(i) {
      let sum = 0;
      possible.forEach((edge, k) => { if (edge.a === i || edge.b === i) sum += count[k]; });
      return sum;
    }
    function search(k) {
      if (found >= limit) return;
      if (Date.now() > deadline) { aborted = true; return; }
      if (k === possible.length) {
        if (islands.some((island, i) => degree(i) !== island.n)) return;
        const seen = new Set([0]);
        const stack = [0];
        while (stack.length) {
          const cur = stack.pop();
          possible.forEach((edge, i) => {
            if (!count[i]) return;
            const next = edge.a === cur ? edge.b : edge.b === cur ? edge.a : -1;
            if (next >= 0 && !seen.has(next)) { seen.add(next); stack.push(next); }
          });
        }
        if (seen.size === islands.length) found++;
        return;
      }
      for (let value = 0; value <= 2; value++) {
        if (value && possible.slice(0, k).some((other, i) => count[i] && crosses(other, possible[k]))) continue;
        const edge = possible[k];
        if (degree(edge.a) + value > islands[edge.a].n || degree(edge.b) + value > islands[edge.b].n) continue;
        count[k] = value;
        search(k + 1);
        if (found >= limit || aborted) break;
      }
      count[k] = 0;
    }
    search(0);
    return aborted ? -1 : found;
  }

  function makePuzzle(n, budget) {
    const islandsWanted = n === 9 ? 10 : n === 8 ? 8 : 8;
    const deadline = Date.now() + budget;
    let tries = 0;
    while (Date.now() < deadline && tries < 200) {
      tries++;
      const grown = grow(n, islandsWanted);
      if (!grown) continue;
      const chosen = grown.bridges;
      const spots = grown.islands;
      const between = (a, b) => spots.some((spot) => {
        if ((spot[0] === a[0] && spot[1] === a[1]) || (spot[0] === b[0] && spot[1] === b[1])) return false;
        if (a[0] === b[0]) return spot[0] === a[0] && spot[1] > Math.min(a[1], b[1]) && spot[1] < Math.max(a[1], b[1]);
        if (a[1] === b[1]) return spot[1] === a[1] && spot[0] > Math.min(a[0], b[0]) && spot[0] < Math.max(a[0], b[0]);
        return false;
      });
      const possible = [];
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          if (spots[i][0] !== spots[j][0] && spots[i][1] !== spots[j][1]) continue;
          if (between(spots[i], spots[j])) continue;
          possible.push({ a: i, b: j, r1: spots[i][0], c1: spots[i][1], r2: spots[j][0], c2: spots[j][1] });
        }
      }
      const degree = Array(spots.length).fill(0);
      for (const edge of chosen) { degree[edge.a]++; degree[edge.b]++; }
      for (const edge of shuffle(possible.slice())) {
        if (Math.random() < 0.55) continue;
        const same = chosen.find((other) => other.a === edge.a && other.b === edge.b);
        if (same || chosen.some((other) => crosses(other, edge))) {
          if (same && same.count === 1 && degree[edge.a] < 8 && degree[edge.b] < 8 && Math.random() < 0.5) {
            same.count = 2;
            degree[edge.a]++;
            degree[edge.b]++;
          }
          continue;
        }
        if (degree[edge.a] >= 8 || degree[edge.b] >= 8) continue;
        const count = Math.random() < 0.3 && degree[edge.a] < 7 && degree[edge.b] < 7 ? 2 : 1;
        chosen.push({ ...edge, count });
        degree[edge.a] += count;
        degree[edge.b] += count;
      }
      if (degree.some((value) => value < 1 || value > 8)) continue;
      const islands = spots.map((spot, i) => ({ r: spot[0], c: spot[1], n: degree[i] }));
      if (countSolutions(islands, 2, deadline) === 1) return { n, islands };
    }
    return null;
  }

  function sizeOf(value) {
    const n = Number(value);
    return n === 8 || n === 9 ? n : 7;
  }

  if (typeof document === "undefined") {
    globalThis.__hashi = { makePuzzle, countSolutions };
    return;
  }

  const settings = GameSettings.mount({
    id: "hashi",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next map.",
        type: "choice",
        default: "7",
        options: [
          { value: "7", label: "7×7" },
          { value: "8", label: "8×8" },
          { value: "9", label: "9×9" },
        ],
      },
    ],
    onChange() { if (state.phase === "idle") showIdle(); },
  });

  const els = {
    linked: document.getElementById("linked"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    bridges: document.getElementById("bridges"),
    islands: document.getElementById("islands"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = { phase: "idle", token: 0, n: 7, islands: [], links: new Map(), selected: -1, started: 0, elapsed: 0, record: false, clock: 0 };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function readBest() {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${state.n}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  function writeBest(ms) { try { localStorage.setItem(`${BEST_PREFIX}.${state.n}`, String(ms)); } catch { /* still finishes */ } }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function pairKey(a, b) { return a < b ? `${a},${b}` : `${b},${a}`; }
  function edgeOf(a, b) {
    const left = state.islands[a];
    const right = state.islands[b];
    return { r1: left.r, c1: left.c, r2: right.r, c2: right.c };
  }
  function sees(a, b) {
    const left = state.islands[a];
    const right = state.islands[b];
    if (left.r !== right.r && left.c !== right.c) return false;
    return !state.islands.some((island, index) => {
      if (index === a || index === b) return false;
      if (left.r === right.r) return island.r === left.r && island.c > Math.min(left.c, right.c) && island.c < Math.max(left.c, right.c);
      return island.c === left.c && island.r > Math.min(left.r, right.r) && island.r < Math.max(left.r, right.r);
    });
  }
  function degree(index) {
    let sum = 0;
    for (const [key, count] of state.links) {
      const [a, b] = key.split(",").map(Number);
      if (a === index || b === index) sum += count;
    }
    return sum;
  }
  function connected() {
    if (!state.islands.length) return false;
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const cur = stack.pop();
      for (const [key, count] of state.links) {
        if (!count) continue;
        const [a, b] = key.split(",").map(Number);
        const next = a === cur ? b : b === cur ? a : -1;
        if (next >= 0 && !seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return seen.size === state.islands.length;
  }

  function paint() {
    const n = state.n;
    els.bridges.setAttribute("viewBox", `0 0 ${n} ${n}`);
    els.bridges.replaceChildren();
    for (const [key, count] of state.links) {
      if (!count) continue;
      const [a, b] = key.split(",").map(Number);
      const left = state.islands[a];
      const right = state.islands[b];
      const horizontal = left.r === right.r;
      const offsets = count === 1 ? [0] : [-0.12, 0.12];
      for (const offset of offsets) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(left.c + 0.5 + (horizontal ? 0 : offset)));
        line.setAttribute("y1", String(left.r + 0.5 + (horizontal ? offset : 0)));
        line.setAttribute("x2", String(right.c + 0.5 + (horizontal ? 0 : offset)));
        line.setAttribute("y2", String(right.r + 0.5 + (horizontal ? offset : 0)));
        els.bridges.append(line);
      }
    }
    let linked = 0;
    for (const button of els.islands.querySelectorAll(".island")) {
      const index = Number(button.dataset.index);
      const met = degree(index) === state.islands[index].n;
      const over = degree(index) > state.islands[index].n;
      if (met) linked++;
      button.classList.toggle("is-met", met);
      button.classList.toggle("is-bad", over);
      button.classList.toggle("is-selected", state.selected === index);
    }
    els.linked.textContent = state.islands.length ? `${linked}/${state.islands.length}` : "0";
    return linked === state.islands.length && state.islands.length > 0 && connected();
  }

  function render() {
    const n = state.n;
    els.islands.replaceChildren();
    state.islands.forEach((island, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "island";
      button.dataset.index = String(index);
      button.textContent = String(island.n);
      button.style.left = `${((island.c + 0.5) / n) * 100}%`;
      button.style.top = `${((island.r + 0.5) / n) * 100}%`;
      button.setAttribute("aria-label", `Island ${island.n}`);
      button.addEventListener("click", () => choose(index));
      els.islands.append(button);
    });
    paint();
  }

  function choose(index) {
    if (state.phase !== "play") return;
    if (state.selected < 0 || state.selected === index) {
      state.selected = state.selected === index ? -1 : index;
      paint();
      return;
    }
    const other = state.selected;
    if (!sees(other, index)) {
      setStatus("Those islands are not in a clear straight line.", "bad");
      state.selected = index;
      paint();
      return;
    }
    const key = pairKey(other, index);
    const next = ((state.links.get(key) || 0) + 1) % 3;
    if (next && [...state.links].some(([otherKey, count]) => count && otherKey !== key && crosses(edgeOf(...otherKey.split(",").map(Number)), edgeOf(other, index)))) {
      setStatus("Bridges cannot cross.", "bad");
      state.selected = -1;
      paint();
      return;
    }
    if (next) state.links.set(key, next);
    else state.links.delete(key);
    state.selected = -1;
    setStatus("Click two islands to add a bridge. Click again for a second, then to remove it.");
    if (paint()) finish();
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.islands = [];
    state.links = new Map();
    state.selected = -1;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.linked.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.islands.replaceChildren();
    els.bridges.replaceChildren();
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`Connect every island. Next map: ${state.n}×${state.n}.`);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function begin() {
    if (state.phase === "building") return;
    const token = ++state.token;
    const n = sizeOf(settings.values.size);
    state.phase = "building";
    state.n = n;
    state.links = new Map();
    state.selected = -1;
    state.record = false;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.islands.replaceChildren();
    els.bridges.replaceChildren();
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${n}×${n} map…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n, 2500);
      if (token !== state.token) return;
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair map. Try again.", "bad");
        return;
      }
      state.islands = puzzle.islands;
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New map";
      setStatus("Click two islands in a straight line to bridge them.");
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    if (!readBest() || state.elapsed < readBest()) { state.record = true; writeBest(state.elapsed); }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    els.best.textContent = formatTime(readBest());
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Linked the ${state.n}×${state.n} map in ${clock}. New best.`
      : `Linked the ${state.n}×${state.n} map in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Every island is connected.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
