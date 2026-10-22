(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.slitherlink.best";

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function edgeList(n) {
    const edges = [];
    for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) edges.push(["h", r, c]);
    for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) edges.push(["v", r, c]);
    return edges;
  }

  function countSolutions(n, clues, limit, deadline) {
    const edges = edgeList(n);
    const index = new Map(edges.map((edge, i) => [edge.join(","), i]));
    const verts = [];
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const list = [];
        if (c > 0) list.push(index.get(`h,${r},${c - 1}`));
        if (c < n) list.push(index.get(`h,${r},${c}`));
        if (r > 0) list.push(index.get(`v,${r - 1},${c}`));
        if (r < n) list.push(index.get(`v,${r},${c}`));
        verts.push(list);
      }
    }
    const cells = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        cells.push({
          clue: clues[r][c],
          edges: [`h,${r},${c}`, `h,${r + 1},${c}`, `v,${r},${c}`, `v,${r},${c + 1}`].map((id) => index.get(id)),
        });
      }
    }
    const state = new Uint8Array(edges.length);
    let found = 0;
    let nodes = 0;
    let aborted = false;

    function propagate() {
      let changed = true;
      while (changed) {
        changed = false;
        for (const cell of cells) {
          if (cell.clue == null) continue;
          let inn = 0;
          const unknown = [];
          for (const edge of cell.edges) {
            if (state[edge] === 1) inn++;
            else if (state[edge] === 0) unknown.push(edge);
          }
          if (inn > cell.clue || inn + unknown.length < cell.clue) return false;
          const fill = inn === cell.clue ? 2 : inn + unknown.length === cell.clue ? 1 : 0;
          if (!fill || !unknown.length) continue;
          for (const edge of unknown) state[edge] = fill;
          changed = true;
        }
        for (const list of verts) {
          let inn = 0;
          const unknown = [];
          for (const edge of list) {
            if (state[edge] === 1) inn++;
            else if (state[edge] === 0) unknown.push(edge);
          }
          if (inn > 2 || (inn === 1 && unknown.length === 0)) return false;
          if (inn === 2) {
            for (const edge of unknown) state[edge] = 2;
            if (unknown.length) changed = true;
          } else if (inn === 1 && unknown.length === 1) {
            state[unknown[0]] = 1;
            changed = true;
          } else if (inn === 0 && unknown.length === 1) {
            state[unknown[0]] = 2;
            changed = true;
          }
        }
      }
      return true;
    }

    function oneLoop() {
      const adj = Array.from({ length: (n + 1) * (n + 1) }, () => []);
      let inn = 0;
      for (let i = 0; i < edges.length; i++) {
        if (state[i] !== 1) continue;
        inn++;
        const [kind, r, c] = edges[i];
        const a = r * (n + 1) + c;
        const b = kind === "h" ? a + 1 : a + n + 1;
        adj[a].push(b);
        adj[b].push(a);
      }
      if (inn < 4) return false;
      let start = -1;
      for (let vertex = 0; vertex < adj.length; vertex++) {
        if (!adj[vertex].length) continue;
        if (adj[vertex].length !== 2) return false;
        start = vertex;
      }
      const seen = new Set();
      let cur = start;
      let prev = -1;
      while (!seen.has(cur)) {
        seen.add(cur);
        const next = adj[cur].find((vertex) => vertex !== prev);
        prev = cur;
        cur = next;
      }
      return seen.size === inn;
    }

    function search() {
      nodes++;
      if (nodes > 80000 || (deadline && Date.now() > deadline)) {
        aborted = true;
        return;
      }
      if (found >= limit) return;
      const saved = state.slice();
      if (!propagate()) {
        state.set(saved);
        return;
      }
      const branch = state.indexOf(0);
      if (branch < 0) {
        if (oneLoop()) found++;
        state.set(saved);
        return;
      }
      const mid = state.slice();
      for (const value of [1, 2]) {
        state.set(mid);
        state[branch] = value;
        search();
        if (found >= limit) break;
      }
      state.set(saved);
    }

    search();
    return aborted ? -1 : found;
  }

  function randomInside(n) {
    const inside = new Set();
    inside.add(`${Math.floor(Math.random() * n)},${Math.floor(Math.random() * n)}`);
    const target = Math.max(4, Math.floor(n * n * (0.4 + Math.random() * 0.25)));
    for (let guard = 0; inside.size < target && guard < n * n * 30; guard++) {
      const options = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const key = `${r},${c}`;
          if (inside.has(key)) continue;
          let touch = 0;
          if (inside.has(`${r - 1},${c}`)) touch++;
          if (inside.has(`${r + 1},${c}`)) touch++;
          if (inside.has(`${r},${c - 1}`)) touch++;
          if (inside.has(`${r},${c + 1}`)) touch++;
          if (!touch) continue;
          let pinch = false;
          for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            if (!inside.has(`${r + dr},${c + dc}`)) continue;
            if (!inside.has(`${r + dr},${c}`) || !inside.has(`${r},${c + dc}`)) pinch = true;
          }
          if (pinch) continue;
          options.push(key);
        }
      }
      if (!options.length) break;
      const key = options[Math.floor(Math.random() * options.length)];
      inside.add(key);
      const seen = Array.from({ length: n }, () => Array(n).fill(false));
      const stack = [];
      for (let i = 0; i < n; i++) stack.push([0, i], [n - 1, i], [i, 0], [i, n - 1]);
      while (stack.length) {
        const [r, c] = stack.pop();
        if (r < 0 || c < 0 || r >= n || c >= n || seen[r][c] || inside.has(`${r},${c}`)) continue;
        seen[r][c] = true;
        stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
      }
      let hole = false;
      for (let r = 0; r < n && !hole; r++) {
        for (let c = 0; c < n; c++) if (!inside.has(`${r},${c}`) && !seen[r][c]) hole = true;
      }
      if (hole) inside.delete(key);
    }
    return inside;
  }

  function loopEdges(inside, n) {
    const on = new Set();
    for (const key of inside) {
      const [r, c] = key.split(",").map(Number);
      if (!inside.has(`${r - 1},${c}`)) on.add(`h,${r},${c}`);
      if (!inside.has(`${r + 1},${c}`)) on.add(`h,${r + 1},${c}`);
      if (!inside.has(`${r},${c - 1}`)) on.add(`v,${r},${c}`);
      if (!inside.has(`${r},${c + 1}`)) on.add(`v,${r},${c + 1}`);
    }
    const degree = new Map();
    for (const id of on) {
      const [kind, r, c] = id.split(",");
      const rr = Number(r);
      const cc = Number(c);
      const ends = kind === "h" ? [[rr, cc], [rr, cc + 1]] : [[rr, cc], [rr + 1, cc]];
      for (const [vr, vc] of ends) degree.set(`${vr},${vc}`, (degree.get(`${vr},${vc}`) || 0) + 1);
    }
    if ([...degree.values()].some((value) => value !== 2)) return null;
    return on;
  }

  function makePuzzle(n, budget) {
    const deadline = Date.now() + budget;
    while (Date.now() < deadline) {
      const on = loopEdges(randomInside(n), n);
      if (!on) continue;
      const clues = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
        let count = 0;
        if (on.has(`h,${r},${c}`)) count++;
        if (on.has(`h,${r + 1},${c}`)) count++;
        if (on.has(`v,${r},${c}`)) count++;
        if (on.has(`v,${r},${c + 1}`)) count++;
        return count;
      }));
      if (countSolutions(n, clues, 2, deadline) !== 1) continue;
      for (const i of shuffle([...Array(n * n).keys()])) {
        if (Date.now() > deadline) break;
        const r = Math.floor(i / n);
        const c = i % n;
        const prev = clues[r][c];
        clues[r][c] = null;
        const next = countSolutions(n, clues, 2, deadline);
        if (next !== 1) clues[r][c] = prev;
        if (next < 0) break;
      }
      return clues;
    }
    return null;
  }

  function sizeOf(value) {
    const n = Number(value);
    return n === 5 || n === 7 ? n : 6;
  }

  if (typeof document === "undefined") {
    globalThis.__slitherlink = { makePuzzle, countSolutions };
    return;
  }

  const settings = GameSettings.mount({
    id: "slitherlink",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board.",
        type: "choice",
        default: "6",
        options: [
          { value: "5", label: "5×5" },
          { value: "6", label: "6×6" },
          { value: "7", label: "7×7" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark a number that the current lines can no longer satisfy.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
    },
  });

  const els = {
    matched: document.getElementById("matched"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 6,
    clues: [],
    lines: new Map(),
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function bestKey() {
    return `${BEST_PREFIX}.${state.n}`;
  }

  function readBest() {
    const stored = Number(localStorage.getItem(bestKey()));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(ms) {
    try { localStorage.setItem(bestKey(), String(ms)); } catch { /* this run still finishes */ }
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function cellEdges(r, c) {
    return [`h,${r},${c}`, `h,${r + 1},${c}`, `v,${r},${c}`, `v,${r},${c + 1}`];
  }

  function around(key) {
    let on = 0;
    let open = 0;
    for (const edge of key) {
      const mark = state.lines.get(edge) || 0;
      if (mark === 1) on++;
      else if (mark === 0) open++;
    }
    return { on, open };
  }

  function loopClosed() {
    const n = state.n;
    const adj = Array.from({ length: (n + 1) * (n + 1) }, () => []);
    let inn = 0;
    for (const [key, mark] of state.lines) {
      if (mark !== 1) continue;
      inn++;
      const [kind, r, c] = key.split(",");
      const rr = Number(r);
      const cc = Number(c);
      const a = rr * (n + 1) + cc;
      const b = kind === "h" ? a + 1 : a + n + 1;
      adj[a].push(b);
      adj[b].push(a);
    }
    if (inn < 4) return false;
    let start = -1;
    for (let vertex = 0; vertex < adj.length; vertex++) {
      if (!adj[vertex].length) continue;
      if (adj[vertex].length !== 2) return false;
      start = vertex;
    }
    const seen = new Set();
    let cur = start;
    let prev = -1;
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      const next = adj[cur].find((vertex) => vertex !== prev);
      prev = cur;
      cur = next;
    }
    return seen.size === inn;
  }

  function paint() {
    const show = settings.values.conflicts !== false;
    let matched = 0;
    let numbered = 0;
    for (const clue of els.board.querySelectorAll(".clue")) {
      const r = Number(clue.dataset.r);
      const c = Number(clue.dataset.c);
      const value = state.clues[r][c];
      const tally = around(cellEdges(r, c));
      const met = value != null && tally.on === value && tally.open === 0;
      const bad = show && value != null && (tally.on > value || tally.on + tally.open < value);
      clue.classList.toggle("is-met", met);
      clue.classList.toggle("is-bad", bad);
      if (value != null) {
        numbered++;
        if (tally.on === value && tally.open === 0) matched++;
      }
    }
    for (const edge of els.board.querySelectorAll(".edge")) {
      const mark = state.lines.get(edge.dataset.key) || 0;
      edge.classList.toggle("is-on", mark === 1);
      edge.classList.toggle("is-mark", mark === 2);
      edge.textContent = mark === 2 ? "×" : "";
      edge.setAttribute("aria-pressed", String(mark === 1));
    }
    els.matched.textContent = numbered ? `${matched}/${numbered}` : "0";
    return matched === numbered && numbered > 0 && loopClosed();
  }

  function render() {
    const n = state.n;
    els.board.style.setProperty("--n", String(n));
    els.board.replaceChildren();
    for (let r = 0; r <= n * 2; r++) {
      for (let c = 0; c <= n * 2; c++) {
        if (r % 2 === 0 && c % 2 === 0) {
          const dot = document.createElement("span");
          dot.className = "dot";
          els.board.append(dot);
        } else if (r % 2 === 1 && c % 2 === 1) {
          const clue = document.createElement("span");
          const cr = (r - 1) / 2;
          const cc = (c - 1) / 2;
          const value = state.clues[cr][cc];
          clue.className = "clue";
          clue.dataset.r = String(cr);
          clue.dataset.c = String(cc);
          clue.textContent = value == null ? "" : String(value);
          els.board.append(clue);
        } else {
          const horizontal = r % 2 === 0;
          const er = horizontal ? r / 2 : (r - 1) / 2;
          const ec = horizontal ? (c - 1) / 2 : c / 2;
          const button = document.createElement("button");
          button.type = "button";
          button.className = `edge ${horizontal ? "edge--h" : "edge--v"}`;
          button.dataset.key = `${horizontal ? "h" : "v"},${er},${ec}`;
          button.setAttribute("aria-label", `${horizontal ? "Horizontal" : "Vertical"} line ${er + 1}, ${ec + 1}`);
          button.addEventListener("click", () => toggle(button.dataset.key));
          els.board.append(button);
        }
      }
    }
    paint();
  }

  function toggle(key) {
    if (state.phase !== "play") return;
    const mark = ((state.lines.get(key) || 0) + 1) % 3;
    if (mark === 0) state.lines.delete(key);
    else state.lines.set(key, mark);
    if (paint()) finish();
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.clues = [];
    state.lines = new Map();
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.matched.textContent = "0";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    els.board.replaceChildren();
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    setStatus(`One closed loop. Next board: ${state.n}×${state.n}.`);
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
    state.lines = new Map();
    state.record = false;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.summary.hidden = true;
    els.board.replaceChildren();
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.best.textContent = readBest() ? formatTime(readBest()) : "—";
    setStatus(`Building a ${n}×${n} loop…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const clues = makePuzzle(n, n >= 7 ? 2800 : n === 6 ? 2200 : 1200);
      if (token !== state.token) return;
      if (!clues) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair loop. Try again.", "bad");
        return;
      }
      state.clues = clues;
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.hidden = false;
      els.start.textContent = "New board";
      setStatus("Click a side to draw it. Click again to cross it out.");
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest();
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    els.best.textContent = formatTime(readBest());
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Closed the ${state.n}×${state.n} loop in ${clock}. New best.`
      : `Closed the ${state.n}×${state.n} loop in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Loop closed.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
})();
