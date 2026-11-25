(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.masyu.best";
  const SIZES = [6, 8, 10];
  const WHITE = 1;
  const BLACK = 2;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  const geometryCache = new Map();

  function geometry(n) {
    if (geometryCache.has(n)) return geometryCache.get(n);
    const H = n * (n - 1);
    const count = H * 2;
    const endA = new Int16Array(count);
    const endB = new Int16Array(count);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) {
        const e = r * (n - 1) + c;
        endA[e] = r * n + c;
        endB[e] = r * n + c + 1;
      }
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n; c++) {
        const e = H + r * n + c;
        endA[e] = r * n + c;
        endB[e] = (r + 1) * n + c;
      }
    }
    const V = n * n;
    const L = new Int16Array(V);
    const R = new Int16Array(V);
    const U = new Int16Array(V);
    const D = new Int16Array(V);
    for (let v = 0; v < V; v++) {
      const r = Math.floor(v / n);
      const c = v % n;
      L[v] = c > 0 ? r * (n - 1) + c - 1 : -1;
      R[v] = c < n - 1 ? r * (n - 1) + c : -1;
      U[v] = r > 0 ? H + (r - 1) * n + c : -1;
      D[v] = r < n - 1 ? H + r * n + c : -1;
    }
    const LL = new Int16Array(V);
    const RR = new Int16Array(V);
    const UU = new Int16Array(V);
    const DD = new Int16Array(V);
    const inc = [];
    for (let v = 0; v < V; v++) {
      const c = v % n;
      const r = Math.floor(v / n);
      LL[v] = c > 1 ? L[v - 1] : -1;
      RR[v] = c < n - 2 ? R[v + 1] : -1;
      UU[v] = r > 1 ? U[v - n] : -1;
      DD[v] = r < n - 2 ? D[v + n] : -1;
      inc.push([L[v], R[v], U[v], D[v]].filter((e) => e >= 0));
    }
    const geo = { n, H, count, endA, endB, L, R, U, D, LL, RR, UU, DD, inc };
    geometryCache.set(n, geo);
    return geo;
  }

  function isHorizontal(geo, e) {
    return e < geo.H;
  }

  function otherEnd(geo, e, v) {
    return geo.endA[e] === v ? geo.endB[e] : geo.endA[e];
  }

  // True when the edges picked by isOn form exactly one closed loop that obeys every circle.
  function loopValid(n, circles, isOn) {
    const geo = geometry(n);
    const deg = new Uint8Array(n * n);
    let total = 0;
    let start = -1;
    for (let e = 0; e < geo.count; e++) {
      if (!isOn(e)) continue;
      total++;
      deg[geo.endA[e]]++;
      deg[geo.endB[e]]++;
      start = geo.endA[e];
    }
    if (total < 4) return false;
    for (let v = 0; v < n * n; v++) {
      if (deg[v] !== 0 && deg[v] !== 2) return false;
      if (circles[v] && deg[v] !== 2) return false;
    }
    let cur = start;
    let came = -1;
    let walked = 0;
    do {
      const next = geo.inc[cur].find((e) => e !== came && isOn(e));
      came = next;
      cur = otherEnd(geo, next, cur);
      walked++;
    } while (cur !== start && walked <= total);
    if (walked !== total) return false;
    const on = (e) => e >= 0 && isOn(e);
    for (let v = 0; v < n * n; v++) {
      if (!circles[v]) continue;
      const horiz = on(geo.L[v]) && on(geo.R[v]);
      const vert = on(geo.U[v]) && on(geo.D[v]);
      if (circles[v] === WHITE) {
        if (horiz && !(on(geo.LL[v]) && on(geo.RR[v]))) continue;
        if (vert && !(on(geo.UU[v]) && on(geo.DD[v]))) continue;
        return false;
      }
      if (horiz || vert) return false;
      if (on(geo.L[v]) && !on(geo.LL[v])) return false;
      if (on(geo.R[v]) && !on(geo.RR[v])) return false;
      if (on(geo.U[v]) && !on(geo.UU[v])) return false;
      if (on(geo.D[v]) && !on(geo.DD[v])) return false;
    }
    return true;
  }

  function countSolutions(puzzle, limit = 2, deadline = Infinity, nodeCap = 400000, onSolution = null) {
    const n = puzzle.n;
    const circles = puzzle.circles;
    const geo = geometry(n);
    const { count, endA, endB, L, R, U, D, LL, RR, UU, DD, inc } = geo;
    const V = n * n;
    const whites = [];
    const blacks = [];
    for (let v = 0; v < V; v++) {
      if (circles[v] === WHITE) whites.push(v);
      else if (circles[v] === BLACK) blacks.push(v);
    }
    const circleTotal = whites.length + blacks.length;
    const state = new Uint8Array(count);
    const deg = new Uint8Array(V);
    const seen = new Uint8Array(V);
    const queue = new Int16Array(V);
    let changed = false;
    let found = 0;
    let nodes = 0;
    let aborted = false;

    const val = (e) => (e < 0 ? 2 : state[e]);

    function set(e, value) {
      if (e < 0) return value === 2;
      const now = state[e];
      if (now === value) return true;
      if (now !== 0) return false;
      state[e] = value;
      changed = true;
      return true;
    }

    function vertexRule(v) {
      const list = inc[v];
      let on = 0;
      let open = 0;
      for (const e of list) {
        if (state[e] === 1) on++;
        else if (state[e] === 0) open++;
      }
      if (on > 2) return false;
      if (on === 2) {
        if (open) for (const e of list) if (state[e] === 0) set(e, 2);
        return true;
      }
      if (circles[v]) {
        if (on + open < 2) return false;
        if (on + open === 2 && open) for (const e of list) if (state[e] === 0) set(e, 1);
        return true;
      }
      if (on === 1) {
        if (open === 0) return false;
        if (open === 1) for (const e of list) if (state[e] === 0) set(e, 1);
      } else if (open === 1) {
        for (const e of list) if (state[e] === 0) set(e, 2);
      }
      return true;
    }

    function whiteRule(v) {
      const l = val(L[v]);
      const r = val(R[v]);
      const u = val(U[v]);
      const d = val(D[v]);
      const horiz = l !== 2 && r !== 2 && u !== 1 && d !== 1 && !(val(LL[v]) === 1 && val(RR[v]) === 1);
      const vert = u !== 2 && d !== 2 && l !== 1 && r !== 1 && !(val(UU[v]) === 1 && val(DD[v]) === 1);
      if (!horiz && !vert) return false;
      if (!vert) {
        if (!set(L[v], 1) || !set(R[v], 1) || !set(U[v], 2) || !set(D[v], 2)) return false;
        if (val(LL[v]) === 1 && !set(RR[v], 2)) return false;
        if (val(RR[v]) === 1 && !set(LL[v], 2)) return false;
      } else if (!horiz) {
        if (!set(U[v], 1) || !set(D[v], 1) || !set(L[v], 2) || !set(R[v], 2)) return false;
        if (val(UU[v]) === 1 && !set(DD[v], 2)) return false;
        if (val(DD[v]) === 1 && !set(UU[v], 2)) return false;
      }
      return true;
    }

    function leg(a, aa, b) {
      if (val(a) === 1) return set(aa, 1) && set(b, 2);
      if (val(aa) === 2) return set(a, 2);
      return true;
    }

    function blackRule(v) {
      if (!leg(L[v], LL[v], R[v]) || !leg(R[v], RR[v], L[v])) return false;
      if (!leg(U[v], UU[v], D[v]) || !leg(D[v], DD[v], U[v])) return false;
      if (val(L[v]) === 2 && !set(R[v], 1)) return false;
      if (val(R[v]) === 2 && !set(L[v], 1)) return false;
      if (val(U[v]) === 2 && !set(D[v], 1)) return false;
      if (val(D[v]) === 2 && !set(U[v], 1)) return false;
      return true;
    }

    function loops() {
      deg.fill(0);
      seen.fill(0);
      let total = 0;
      for (let e = 0; e < count; e++) {
        if (state[e] !== 1) continue;
        deg[endA[e]]++;
        deg[endB[e]]++;
        total++;
      }
      let first = -1;
      let active = 0;
      for (let v = 0; v < V; v++) {
        if (deg[v] || circles[v]) {
          active++;
          if (first < 0) first = v;
        }
      }
      if (first >= 0) {
        let head = 0;
        let tail = 0;
        queue[tail++] = first;
        seen[first] = 1;
        let reached = 0;
        while (head < tail) {
          const v = queue[head++];
          if (deg[v] || circles[v]) reached++;
          for (const e of inc[v]) {
            if (state[e] === 2) continue;
            const w = endA[e] === v ? endB[e] : endA[e];
            if (seen[w]) continue;
            seen[w] = 1;
            queue[tail++] = w;
          }
        }
        if (reached !== active) return false;
        seen.fill(0);
      }
      if (!total) return true;
      for (let v = 0; v < V; v++) {
        if (deg[v] !== 1 || seen[v]) continue;
        let cur = v;
        let came = -1;
        let edges = 0;
        let rings = circles[v] ? 1 : 0;
        seen[v] = 1;
        for (;;) {
          let next = -1;
          for (const e of inc[cur]) if (e !== came && state[e] === 1) { next = e; break; }
          if (next < 0) break;
          came = next;
          cur = endA[next] === cur ? endB[next] : endA[next];
          edges++;
          seen[cur] = 1;
          if (circles[cur]) rings++;
        }
        const end = cur;
        for (const e of inc[v]) {
          if (state[e] !== 0) continue;
          const far = endA[e] === v ? endB[e] : endA[e];
          if (far !== end) continue;
          if (edges !== total || rings !== circleTotal) set(e, 2);
        }
      }
      for (let v = 0; v < V; v++) {
        if (deg[v] !== 2 || seen[v]) continue;
        let cur = v;
        let came = -1;
        let edges = 0;
        let rings = 0;
        do {
          seen[cur] = 1;
          if (circles[cur]) rings++;
          let next = -1;
          for (const e of inc[cur]) if (e !== came && state[e] === 1) { next = e; break; }
          came = next;
          cur = endA[next] === cur ? endB[next] : endA[next];
          edges++;
        } while (cur !== v);
        if (edges !== total || rings !== circleTotal) return false;
        for (let e = 0; e < count; e++) if (state[e] === 0) set(e, 2);
        return true;
      }
      return true;
    }

    function propagate() {
      do {
        changed = false;
        for (let v = 0; v < V; v++) if (!vertexRule(v)) return false;
        for (const v of whites) if (!whiteRule(v)) return false;
        for (const v of blacks) if (!blackRule(v)) return false;
        if (!changed && !loops()) return false;
      } while (changed);
      return true;
    }

    function pickBranch() {
      let best = -1;
      let bestScore = 99;
      for (let v = 0; v < V; v++) {
        let on = 0;
        let open = 0;
        let first = -1;
        for (const e of inc[v]) {
          if (state[e] === 1) on++;
          else if (state[e] === 0) {
            open++;
            if (first < 0) first = e;
          }
        }
        if (!open || on === 2) continue;
        let score;
        if (on === 1) score = open;
        else if (circles[v]) score = 4 + open;
        else continue;
        if (score < bestScore) {
          bestScore = score;
          best = first;
          if (score <= 2) break;
        }
      }
      if (best >= 0) return best;
      return state.indexOf(0);
    }

    function search() {
      if (found >= limit || aborted) return;
      nodes++;
      if (nodes > nodeCap || ((nodes & 31) === 0 && Date.now() > deadline)) {
        aborted = true;
        return;
      }
      if (!propagate()) return;
      const branch = pickBranch();
      if (branch < 0) {
        if (loopValid(n, circles, (e) => state[e] === 1)) {
          found++;
          if (onSolution) onSolution(state.map((s) => (s === 1 ? 1 : 0)));
        }
        return;
      }
      const saved = state.slice();
      for (const value of [1, 2]) {
        state.set(saved);
        state[branch] = value;
        search();
        if (found >= limit || aborted) break;
      }
    }

    if (!circleTotal) return 0;
    search();
    return aborted ? -1 : found;
  }

  // A shape is a set of cells on the (n-1)×(n-1) grid between cell centers. When it is connected, has no holes,
  // never touches itself only at a corner and has no 2×2 block, its outline is one simple loop through n×n centers.
  function shapeOk(inside, m) {
    const has = (r, c) => r >= 0 && c >= 0 && r < m && c < m && inside[r][c];
    let count = 0;
    let start = -1;
    for (let r = -1; r < m; r++) {
      for (let c = -1; c < m; c++) {
        const a = has(r, c);
        const b = has(r, c + 1);
        const d = has(r + 1, c);
        const e = has(r + 1, c + 1);
        if ((a && e && !b && !d) || (b && d && !a && !e) || (a && b && d && e)) return false;
        if (a) {
          count++;
          start = r * m + c;
        }
      }
    }
    if (count < 2) return false;
    const seen = new Uint8Array(m * m);
    const stack = [start];
    seen[start] = 1;
    let reach = 0;
    while (stack.length) {
      const cell = stack.pop();
      reach++;
      const r = Math.floor(cell / m);
      const c = cell % m;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (!has(rr, cc) || seen[rr * m + cc]) continue;
        seen[rr * m + cc] = 1;
        stack.push(rr * m + cc);
      }
    }
    if (reach !== count) return false;
    seen.fill(0);
    for (let i = 0; i < m; i++) stack.push(i, (m - 1) * m + i, i * m, i * m + m - 1);
    let outside = 0;
    while (stack.length) {
      const cell = stack.pop();
      const r = Math.floor(cell / m);
      const c = cell % m;
      if (seen[cell] || inside[r][c]) continue;
      seen[cell] = 1;
      outside++;
      if (r > 0) stack.push(cell - m);
      if (r < m - 1) stack.push(cell + m);
      if (c > 0) stack.push(cell - 1);
      if (c < m - 1) stack.push(cell + 1);
    }
    return outside + count === m * m;
  }

  function growShape(m) {
    const inside = Array.from({ length: m }, () => Array(m).fill(false));
    const r0 = Math.floor(Math.random() * m);
    const c0 = Math.floor(Math.random() * (m - 1));
    inside[r0][c0] = true;
    inside[r0][c0 + 1] = true;
    let size = 2;
    const target = Math.floor(m * m * (0.5 + Math.random() * 0.3));
    for (let guard = 0; guard < m * m * 20 && size < target; guard++) {
      const r = Math.floor(Math.random() * m);
      const c = Math.floor(Math.random() * m);
      if (inside[r][c]) continue;
      inside[r][c] = true;
      if (shapeOk(inside, m)) size++;
      else inside[r][c] = false;
    }
    return inside;
  }

  function outline(inside, n) {
    const geo = geometry(n);
    const m = n - 1;
    const has = (r, c) => r >= 0 && c >= 0 && r < m && c < m && inside[r][c];
    const on = new Uint8Array(geo.count);
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        if (!inside[r][c]) continue;
        if (!has(r - 1, c)) on[r * (n - 1) + c] = 1;
        if (!has(r + 1, c)) on[(r + 1) * (n - 1) + c] = 1;
        if (!has(r, c - 1)) on[geo.H + r * n + c] = 1;
        if (!has(r, c + 1)) on[geo.H + r * n + c + 1] = 1;
      }
    }
    return on;
  }

  // Flip one shape cell beside an edge where the two loops disagree, so the next outline rules out that alternative.
  function reshape(inside, n, on, other) {
    const geo = geometry(n);
    const m = n - 1;
    const options = [];
    for (let e = 0; e < geo.count; e++) {
      if (on[e] === other[e]) continue;
      const a = geo.endA[e];
      const r = Math.floor(a / n);
      const c = a % n;
      if (e < geo.H) options.push([r - 1, c], [r, c]);
      else options.push([r, c - 1], [r, c]);
    }
    for (const [r, c] of shuffle(options)) {
      if (r < 0 || c < 0 || r >= m || c >= m) continue;
      inside[r][c] = !inside[r][c];
      if (shapeOk(inside, m)) return true;
      inside[r][c] = !inside[r][c];
    }
    return false;
  }

  function uniqueLoop(n, deadline) {
    const m = n - 1;
    const inside = growShape(m);
    for (let step = 0; step < 80 && Date.now() < deadline; step++) {
      const on = outline(inside, n);
      const puzzle = { n, circles: candidateCircles(n, on) };
      let other = null;
      const result = countSolutions(puzzle, 2, Math.min(deadline, Date.now() + 250), 60000, (found) => {
        if (!other && found.some((value, e) => value !== on[e])) other = found;
      });
      if (result === 1) return puzzle;
      if (result < 0 || !other || !reshape(inside, n, on, other)) return null;
    }
    return null;
  }

  function candidateCircles(n, on) {
    const geo = geometry(n);
    const V = n * n;
    const straight = new Int8Array(V).fill(-1);
    for (let v = 0; v < V; v++) {
      const list = geo.inc[v].filter((e) => on[e]);
      if (list.length !== 2) continue;
      straight[v] = isHorizontal(geo, list[0]) === isHorizontal(geo, list[1]) ? 1 : 0;
    }
    const circles = new Uint8Array(V);
    for (let v = 0; v < V; v++) {
      if (straight[v] < 0) continue;
      const next = geo.inc[v].filter((e) => on[e]).map((e) => otherEnd(geo, e, v));
      if (straight[v] === 1 && next.some((w) => straight[w] === 0)) circles[v] = WHITE;
      else if (straight[v] === 0 && next.every((w) => straight[w] === 1)) circles[v] = BLACK;
    }
    return circles;
  }

  function sizeOf(value) {
    const n = Number(value);
    return SIZES.includes(n) ? n : 6;
  }

  function budgetFor(n) {
    return n >= 10 ? 4500 : n >= 8 ? 2500 : 1200;
  }

  function makePuzzle(size, budget) {
    const n = sizeOf(size);
    const deadline = Date.now() + (budget || budgetFor(n));
    while (Date.now() < deadline) {
      const puzzle = uniqueLoop(n, deadline);
      if (!puzzle) continue;
      const circles = puzzle.circles;
      for (const v of shuffle([...circles.keys()].filter((cell) => circles[cell]))) {
        if (Date.now() > deadline) break;
        const kept = circles[v];
        circles[v] = 0;
        if (countSolutions(puzzle, 2, Math.min(deadline, Date.now() + 200), 40000) !== 1) circles[v] = kept;
      }
      return puzzle;
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__masyu = { makePuzzle, countSolutions, loopValid, geometry };
    return;
  }

  const settings = GameSettings.mount({
    id: "masyu",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next board. 10×10 takes a moment to build.",
        type: "choice",
        default: "6",
        options: [
          { value: "6", label: "6×6" },
          { value: "8", label: "8×8" },
          { value: "10", label: "10×10" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark circles the current lines break and cells with more than two lines.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
      else if (state.phase === "play") paint();
    },
  });

  const els = {
    segments: document.getElementById("segments"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    start: document.getElementById("start-btn"),
    clear: document.getElementById("clear-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 6,
    circles: [],
    lines: new Uint8Array(0),
    drag: null,
    suppressClick: false,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  const nodes = [];
  const edges = [];

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
    try {
      localStorage.setItem(bestKey(), String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest() {
    const best = readBest();
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function brokenCircles(geo, deg) {
    const n = state.n;
    const on = (e) => e >= 0 && state.lines[e] === 1;
    const bad = new Uint8Array(n * n);
    for (let v = 0; v < n * n; v++) {
      const kind = state.circles[v];
      if (!kind) continue;
      const left = on(geo.L[v]);
      const right = on(geo.R[v]);
      const up = on(geo.U[v]);
      const down = on(geo.D[v]);
      const across = left && right;
      const upright = up && down;
      if (kind === WHITE) {
        if (deg[v] === 2 && !across && !upright) bad[v] = 1;
        if (across && on(geo.LL[v]) && on(geo.RR[v])) bad[v] = 1;
        if (upright && on(geo.UU[v]) && on(geo.DD[v])) bad[v] = 1;
      } else {
        if (across || upright) bad[v] = 1;
        const legs = [
          [left, geo.LL[v], v - 1],
          [right, geo.RR[v], v + 1],
          [up, geo.UU[v], v - n],
          [down, geo.DD[v], v + n],
        ];
        for (const [used, beyond, next] of legs) {
          if (!used) continue;
          if (beyond < 0 || (deg[next] >= 2 && !on(beyond))) bad[v] = 1;
        }
      }
      if (deg[v] > 2) bad[v] = 1;
    }
    return bad;
  }

  function paint() {
    const n = state.n;
    const geo = geometry(n);
    const show = settings.values.conflicts !== false;
    const deg = new Uint8Array(n * n);
    let segments = 0;
    for (let e = 0; e < geo.count; e++) {
      if (state.lines[e] !== 1) continue;
      segments++;
      deg[geo.endA[e]]++;
      deg[geo.endB[e]]++;
    }
    const bad = show ? brokenCircles(geo, deg) : new Uint8Array(n * n);
    for (let v = 0; v < nodes.length; v++) {
      nodes[v].classList.toggle("is-bad", bad[v] === 1);
      nodes[v].classList.toggle("is-branch", show && deg[v] > 2);
    }
    for (let e = 0; e < edges.length; e++) {
      const on = state.lines[e] === 1;
      edges[e].classList.toggle("is-on", on);
      edges[e].setAttribute("aria-pressed", String(on));
    }
    els.segments.textContent = String(segments);
  }

  function place(r, c) {
    return `row ${r + 1}, column ${c + 1}`;
  }

  function addEdge(e) {
    const n = state.n;
    const geo = geometry(n);
    const a = geo.endA[e];
    const b = geo.endB[e];
    const horizontal = e < geo.H;
    const r = Math.floor(a / n);
    const c = a % n;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `edge ${horizontal ? "edge--h" : "edge--v"}`;
    button.style.left = `${((horizontal ? c + 1 : c + 0.5) / n) * 100}%`;
    button.style.top = `${((horizontal ? r + 0.5 : r + 1) / n) * 100}%`;
    button.setAttribute(
      "aria-label",
      `Line from ${place(r, c)} to ${place(Math.floor(b / n), b % n)}`,
    );
    button.addEventListener("click", (event) => {
      if (event.detail !== 0 && state.suppressClick) {
        state.suppressClick = false;
        return;
      }
      toggle(e);
    });
    edges[e] = button;
    els.board.append(button);
  }

  function render() {
    const n = state.n;
    const geo = geometry(n);
    els.board.style.setProperty("--n", String(n));
    els.board.classList.remove("is-solved");
    els.board.replaceChildren();
    nodes.length = 0;
    edges.length = 0;
    for (let v = 0; v < n * n; v++) {
      const node = document.createElement("div");
      node.className = "node";
      const kind = state.circles[v];
      if (kind) {
        node.classList.add(kind === WHITE ? "is-white" : "is-black");
        node.setAttribute("role", "img");
        node.setAttribute(
          "aria-label",
          `${place(Math.floor(v / n), v % n)}, ${kind === WHITE ? "hollow circle" : "filled circle"}`,
        );
      } else {
        node.setAttribute("aria-hidden", "true");
      }
      nodes.push(node);
      els.board.append(node);
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) addEdge(r * (n - 1) + c);
      if (r < n - 1) for (let c = 0; c < n; c++) addEdge(geo.H + r * n + c);
    }
    paint();
  }

  function solved() {
    return loopValid(state.n, state.circles, (e) => state.lines[e] === 1);
  }

  function toggle(e) {
    if (state.phase !== "play") return;
    state.lines[e] = state.lines[e] ? 0 : 1;
    paint();
    if (solved()) finish();
  }

  function clearLines() {
    if (state.phase !== "play") return;
    state.lines.fill(0);
    state.drag = null;
    paint();
    setStatus("Lines cleared.");
  }

  function cellAt(event) {
    const n = state.n;
    const rect = els.board.getBoundingClientRect();
    const width = els.board.clientWidth || 1;
    const height = els.board.clientHeight || 1;
    const x = ((event.clientX - rect.left - els.board.clientLeft) / width) * n;
    const y = ((event.clientY - rect.top - els.board.clientTop) / height) * n;
    if (x < 0 || y < 0 || x >= n || y >= n) return -1;
    return Math.floor(y) * n + Math.floor(x);
  }

  function edgeBetween(a, b) {
    const geo = geometry(state.n);
    return geo.inc[a].find((e) => otherEnd(geo, e, a) === b);
  }

  function onPointerDown(event) {
    state.suppressClick = false;
    if (state.phase !== "play" || event.button !== 0) return;
    const cell = cellAt(event);
    if (cell < 0) return;
    if (!event.target.closest(".edge")) event.preventDefault();
    state.drag = { id: event.pointerId, cell, draw: null, captured: false };
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId || state.phase !== "play") return;
    const n = state.n;
    const target = cellAt(event);
    if (target < 0) return;
    let changed = false;
    while (drag.cell !== target) {
      const r = Math.floor(drag.cell / n);
      const c = drag.cell % n;
      const dr = Math.floor(target / n) - r;
      const dc = (target % n) - c;
      const next = Math.abs(dr) >= Math.abs(dc) ? drag.cell + Math.sign(dr) * n : drag.cell + Math.sign(dc);
      const e = edgeBetween(drag.cell, next);
      if (drag.draw === null) drag.draw = state.lines[e] ? 0 : 1;
      state.lines[e] = drag.draw;
      drag.cell = next;
      changed = true;
    }
    if (!changed) return;
    if (!drag.captured) {
      drag.captured = true;
      state.suppressClick = true;
      try {
        els.board.setPointerCapture(event.pointerId);
      } catch {
        /* capture is optional; drawing still follows the pointer */
      }
    }
    paint();
    if (solved()) finish();
  }

  function onPointerUp(event) {
    if (state.drag && state.drag.id === event.pointerId) state.drag = null;
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.circles = [];
    state.lines = new Uint8Array(0);
    state.drag = null;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.segments.textContent = "0";
    els.board.replaceChildren();
    nodes.length = 0;
    edges.length = 0;
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest();
    setStatus(`One loop through every circle. Next board: ${state.n}×${state.n}.`);
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
    state.record = false;
    state.drag = null;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.segments.textContent = "0";
    els.summary.hidden = true;
    els.clear.hidden = true;
    els.board.replaceChildren();
    nodes.length = 0;
    edges.length = 0;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Building…";
    showBest();
    setStatus(`Building a ${n}×${n} loop…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = makePuzzle(n);
      if (token !== state.token) return;
      if (!puzzle) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair loop. Try again.", "bad");
        return;
      }
      state.circles = puzzle.circles;
      state.lines = new Uint8Array(geometry(n).count);
      state.phase = "play";
      state.started = Date.now();
      els.start.disabled = false;
      els.start.textContent = "New board";
      els.clear.hidden = false;
      setStatus("Drag from cell to cell to draw, or tap between two cells to toggle a line.");
      render();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    state.drag = null;
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest();
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    showBest();
    els.board.classList.add("is-solved");
    els.clear.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Closed the ${state.n}×${state.n} loop in ${clock}. New best.`
      : `Closed the ${state.n}×${state.n} loop in ${clock}. Best is ${formatTime(readBest())}.`;
    setStatus("Loop closed through every circle.", "ok");
    els.again.focus();
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearLines);
  els.board.addEventListener("pointerdown", onPointerDown);
  els.board.addEventListener("pointermove", onPointerMove);
  els.board.addEventListener("pointerup", onPointerUp);
  els.board.addEventListener("pointercancel", onPointerUp);
})();
