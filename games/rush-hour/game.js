(() => {
  "use strict";

  const N = 6;
  const EXIT_ROW = 2;
  const GOAL = N - 2;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const BANDS = {
    easy: { min: 8, max: 12 },
    medium: { min: 13, max: 18 },
    hard: { min: 19, max: 25 },
    expert: { min: 26, max: 99 },
  };
  const LIVE = new Set(["easy", "medium", "hard"]);

  const PACK = {
    easy: [
      ["NKOOJJNKMMGHNAAEGHFIIELoFoCELBooCDDB", 12],
      ["NHFFFJNHCEEJAACooIooLLOIMKGGOIMKDDBB", 12],
      ["ECCoFFEooIoLAABIoLHoBoJJHoBKKDoooGGD", 12],
      ["MCooEEMCoFJoBAAFJoBHHHNNDDIIoGoKKLLG", 12],
      ["NNoKKGFFFJJGDoAAHoDBBBHoCooIEECMMILL", 12],
      ["GooKKoGoDBIIAADBELooHBELooHJJFCCCMMF", 12],
      ["MBGGooMBFFHECAADHECIIDoEoLKoNNoLKJJo", 12],
      ["CoLGDDCoLGNNAAoBKoJJoBKEHHMMoEoIIFFo", 12],
      ["ooBIDDooBIHMAAJEHMCoJEGoCKJEGLCKoFFL", 12],
      ["FBCCMMFBoHJEoAAHJENNKooIooKLLIDDoGGo", 12],
      ["JoCCCFJoBooFAABKoooGGKLDIIHKLDooHEEE", 12],
      ["oFoJLLoFoJCCMAAoKBMIIoKBMoDHGEooDHGE", 12],
      ["oCCJJJHDDLLLHKAANGEKBMNGEoBMoIOOBFFI", 12],
      ["EHKoMMEHKCCoNAALoINoDLoIooDJJBGGoFFB", 12],
    ],
    medium: [
      ["NoOOJJNKMMoHNKAAGHIICEGoFoCELBFDDELB", 18],
      ["NoFFFJNHoEEJoHAAOILLCoOIMKCGGIMKDDBB", 18],
      ["ECCFFLEoBIoLAABIoDHoBJJDHKKoooooGGoo", 18],
      ["MooFEEMCoFJoBCAAJoBHHHNNDDIIoGKKLLoG", 17],
      ["ooDKKoooDoIIAAHBoLGoHBELGJJBEFCCCMMF", 18],
      ["ooGGHEMBFFHEMBKAAEoLKDIICLoDNNCoooJJ", 18],
      ["DDLGooCoLGNNCAABKoJJoBKoHHMMoEIIoFFE", 18],
      ["oKBDDooKBIHMAAJIHMCoJEoLCoJEGLCFFEGo", 18],
      ["oBCCMMoBKHJEAAKHJENNoooIFoLLoIFDDoGG", 18],
      ["oCCCoFooBKLFAABKLoJGGKoDJoHIIDooHEEE", 18],
      ["MFooLLMFCCKBMAAJKBIIDJGoooDHGEoooHoE", 18],
      ["HCCJJJHDDLLLAABMNGoKBMNGEKBooIEOOFFI", 16],
      ["EHoMMoEHKCCIAAKLoINooLoBNoDJJBGGDoFF", 18],
      ["EEoBooKooBHHKAADIooFMDILCFMGGLCoMJJJ", 18],
    ],
    hard: [
      ["NOOJJHNKoMMHNKAAGoIICEGoFoCELBFDDELB", 22],
      ["oFFFOJNHEEOJNHCAAILLCooIMKGGoIMKDDBB", 25],
      ["ECCFFLEoBooLooBAADJJBIoDHooIKKHoooGG", 25],
      ["KKDooLooDIILAAHBEoGoHBEFGJJBoFoCCCMM", 25],
      ["GGooHoMBFFHEMBAAoECLoIIECLKDNNJJKDoo", 25],
      ["DDLGooCoLGNNCAABooJJoBKEHHMMKEIIFFoo", 19],
      ["oKBDDMoKBIoMAAJIHoCoJEHoCoJEGLCFFEGL", 21],
      ["oBCCMMoBoooEAAKHoEFoKHNNFLLoJIDDGGJI", 22],
      ["CCCKLFooBKLFAABKoDooHGGDJoHoIIJoEEEo", 25],
      ["MFLLKBMFCCKBMAAJooIIDJGEooDHGEoooHoo", 20],
      ["MMoooIEoCCoIEoKAABNHKooBNHDLJJGGDLFF", 25],
      ["KFMoEEKFMBHHAAMBoooooDILCGGDILCJJJoo", 25],
      ["KLLIIIKGoDDooGAABoFFJJBCooMHHCEEMooC", 24],
      ["oJJMooFoKMEEFGKAALoGBBBLCoHHoDCoIIoD", 25],
    ],
    expert: [
      ["ECCFFLEooooLAABooDooBJJDHoBIKKHGGIoo", 34],
      ["KKDooLooDIILAAHBoFooHBEFGJJBEoGCCCMM", 27],
      ["ooooGGMBoFFEMBAAHECLIIHECLKDNNJJKDoo", 27],
      ["JCCCLFJoBoLFAABoooooHKGGIIHKoDEEEKoD", 37],
      ["EMMLooEoKLCCNHKAAINHDooIooDJJBGGFFoB", 37],
      ["KFoEEoKFMBHHAAMBooooMDILCGGDILCJJJoo", 26],
      ["FJJMooFGKMEECGKAALCBBBoLoHHooDoIIooD", 30],
      ["oCCCJHEKBoJHEKBAAHLLBoooIooFGGIDDFoo", 28],
      ["BBBHooooGHLLAAGooJFFEEoJDCCCIIDoMMKK", 31],
      ["ECoDDoECooIoMCAAIKMGGLIKooHLFFJJHBBo", 27],
      ["LEoCBBLEoCoGFEoAAGFDDDMKJJIoMKooIoHH", 29],
      ["DoooGGDoKBFFAAKBoJIIHBMJoLHoMEoLCCCE", 28],
      ["HooEDDHooEIIKAAEooKoCJJGFFCooGBBBooG", 41],
      ["EEoCoooooCHHDAACoFDoKBBFLLKooIJJKGGI", 38],
    ],
  };

  function parse(text) {
    if (typeof text !== "string" || text.length !== N * N) return null;
    const cells = new Map();
    for (let i = 0; i < N * N; i++) {
      const ch = text[i];
      if (ch === "o" || ch === ".") continue;
      if (!cells.has(ch)) cells.set(ch, []);
      cells.get(ch).push(i);
    }
    const letters = [...cells.keys()].sort();
    if (letters[0] !== "A") return null;
    const vehicles = [];
    const pos = [];
    for (const ch of letters) {
      const list = cells.get(ch);
      const len = list.length;
      if (len < 2 || len > 3) return null;
      const row = (list[0] / N) | 0;
      const col = list[0] % N;
      const horiz = list[1] === list[0] + 1;
      const step = horiz ? 1 : N;
      for (let k = 1; k < len; k++) if (list[k] !== list[0] + k * step) return null;
      if (horiz && (((list[len - 1] / N) | 0) !== row)) return null;
      vehicles.push({ horiz, line: horiz ? row : col, len });
      pos.push(horiz ? col : row);
    }
    const red = vehicles[0];
    if (!red.horiz || red.line !== EXIT_ROW || red.len !== 2) return null;
    return { vehicles, pos };
  }

  function cellsOf(vehicle, at) {
    const list = [];
    for (let k = 0; k < vehicle.len; k++) {
      list.push(vehicle.horiz ? vehicle.line * N + at + k : (at + k) * N + vehicle.line);
    }
    return list;
  }

  function serialize(vehicles, pos) {
    const out = Array(N * N).fill("o");
    vehicles.forEach((vehicle, i) => {
      for (const cell of cellsOf(vehicle, pos[i])) out[cell] = LETTERS[i];
    });
    return out.join("");
  }

  function fillGrid(vehicles, pos, grid) {
    grid.fill(-1);
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      for (let k = 0; k < vehicle.len; k++) {
        grid[vehicle.horiz ? vehicle.line * N + pos[i] + k : (pos[i] + k) * N + vehicle.line] = i;
      }
    }
    return grid;
  }

  function range(vehicles, pos, grid, i) {
    const vehicle = vehicles[i];
    const at = (q) => (vehicle.horiz ? vehicle.line * N + q : q * N + vehicle.line);
    let low = pos[i];
    while (low > 0 && grid[at(low - 1)] < 0) low--;
    let high = pos[i];
    while (high + vehicle.len < N && grid[at(high + vehicle.len)] < 0) high++;
    return [low, high];
  }

  function forEachMove(vehicles, pos, grid, visit) {
    fillGrid(vehicles, pos, grid);
    for (let i = 0; i < vehicles.length; i++) {
      const [low, high] = range(vehicles, pos, grid, i);
      for (let q = low; q <= high; q++) if (q !== pos[i]) visit(i, q);
    }
  }

  function legalMoves(vehicles, pos) {
    const list = [];
    forEachMove(vehicles, pos, new Int8Array(N * N), (index, to) => list.push({ index, to }));
    return list;
  }

  function applyMove(pos, move) {
    const next = pos.slice();
    next[move.index] = move.to;
    return next;
  }

  function isSolved(vehicles, pos) {
    return vehicles[0].horiz && vehicles[0].line === EXIT_ROW && pos[0] === GOAL;
  }

  function keyOf(pos) {
    return String.fromCharCode(...pos.map((p) => 48 + p));
  }

  function decode(key, into) {
    for (let i = 0; i < key.length; i++) into[i] = key.charCodeAt(i) - 48;
    return into;
  }

  function solve(vehicles, start, cap = 300000) {
    if (start[0] === GOAL) return 0;
    const grid = new Int8Array(N * N);
    const pos = start.slice();
    const seen = new Set([keyOf(start)]);
    let frontier = [keyOf(start)];
    let depth = 0;
    while (frontier.length) {
      depth++;
      const next = [];
      for (const key of frontier) {
        decode(key, pos);
        let found = false;
        forEachMove(vehicles, pos, grid, (index, to) => {
          if (found) return;
          if (index === 0 && to === GOAL) { found = true; return; }
          const child = key.slice(0, index) + String.fromCharCode(48 + to) + key.slice(index + 1);
          if (seen.has(child)) return;
          seen.add(child);
          next.push(child);
        });
        if (found) return depth;
        if (seen.size > cap) return null;
      }
      frontier = next;
    }
    return -1;
  }

  function randomLayout(count) {
    const vehicles = [{ horiz: true, line: EXIT_ROW, len: 2 }];
    const pos = [Math.floor(Math.random() * (GOAL + 1))];
    const grid = fillGrid(vehicles, pos, new Int8Array(N * N));
    let guard = 0;
    while (vehicles.length < count && guard < 300) {
      guard++;
      const len = Math.random() < 0.28 ? 3 : 2;
      const horiz = Math.random() < 0.5;
      const line = Math.floor(Math.random() * N);
      if (horiz && line === EXIT_ROW) continue;
      const at = Math.floor(Math.random() * (N - len + 1));
      const vehicle = { horiz, line, len };
      const cells = cellsOf(vehicle, at);
      if (cells.some((cell) => grid[cell] >= 0)) continue;
      for (const cell of cells) grid[cell] = vehicles.length;
      vehicles.push(vehicle);
      pos.push(at);
    }
    return { vehicles, pos };
  }

  function bestStart(vehicles, start, band, cap) {
    const grid = new Int8Array(N * N);
    const pos = start.slice();
    const index = new Map();
    const keys = [];
    const first = keyOf(start);
    index.set(first, 0);
    keys.push(first);
    for (let head = 0; head < keys.length; head++) {
      const key = keys[head];
      decode(key, pos);
      forEachMove(vehicles, pos, grid, (i, to) => {
        const child = key.slice(0, i) + String.fromCharCode(48 + to) + key.slice(i + 1);
        if (index.has(child)) return;
        index.set(child, keys.length);
        keys.push(child);
      });
      if (keys.length > cap) return null;
    }
    const dist = new Int32Array(keys.length).fill(-1);
    const queue = [];
    const goalCode = 48 + GOAL;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].charCodeAt(0) === goalCode) { dist[i] = 0; queue.push(i); }
    }
    if (!queue.length) return null;
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head];
      const key = keys[from];
      decode(key, pos);
      forEachMove(vehicles, pos, grid, (i, to) => {
        const child = index.get(key.slice(0, i) + String.fromCharCode(48 + to) + key.slice(i + 1));
        if (dist[child] >= 0) return;
        dist[child] = dist[from] + 1;
        queue.push(child);
      });
    }
    const byDistance = new Map();
    for (let i = 0; i < keys.length; i++) {
      const d = dist[i];
      if (d < band.min || d > band.max) continue;
      if (!byDistance.has(d)) byDistance.set(d, []);
      byDistance.get(d).push(i);
    }
    if (!byDistance.size) return null;
    const distances = [...byDistance.keys()];
    const optimal = distances[Math.floor(Math.random() * distances.length)];
    const picks = byDistance.get(optimal);
    return { pos: decode(keys[picks[Math.floor(Math.random() * picks.length)]], start.slice()), optimal };
  }

  function levelOf(value) {
    return Object.prototype.hasOwnProperty.call(BANDS, value) ? value : "medium";
  }

  function makePuzzle(level, budget = 800) {
    const band = BANDS[levelOf(level)];
    const deadline = Date.now() + budget;
    let tries = 0;
    while (Date.now() < deadline) {
      tries++;
      const count = 12 + Math.floor(Math.random() * 4);
      const layout = randomLayout(count);
      const found = bestStart(layout.vehicles, layout.pos, band, 20000);
      if (found) return { level: levelOf(level), board: serialize(layout.vehicles, found.pos), optimal: found.optimal, tries };
    }
    return null;
  }

  function fromPack(level, avoid) {
    const list = PACK[levelOf(level)];
    const options = list.length > 1 ? list.filter((entry) => entry[0] !== avoid) : list;
    const [board, optimal] = options[Math.floor(Math.random() * options.length)];
    return { level: levelOf(level), board, optimal, tries: 0 };
  }

  function nextPuzzle(level, avoid) {
    const chosen = levelOf(level);
    if (LIVE.has(chosen)) {
      const made = makePuzzle(chosen, 700);
      if (made) return made;
    }
    return fromPack(chosen, avoid);
  }

  if (typeof document === "undefined") {
    globalThis.__rushHour = { BANDS, PACK, LIVE, parse, serialize, legalMoves, applyMove, isSolved, solve, makePuzzle, nextPuzzle, bestStart, randomLayout };
    return;
  }

  const BEST_PREFIX = "mental-game.rush-hour.best";
  const LEVEL_NAMES = { easy: "easy", medium: "medium", hard: "hard", expert: "expert" };
  const BAND_TEXT = { easy: "8–12", medium: "13–18", hard: "19–25", expert: "26 or more" };

  const settings = GameSettings.mount({
    id: "rush-hour",
    fields: [
      {
        id: "difficulty",
        label: "Difficulty",
        hint: "How many moves the shortest solution takes. Applies to the next puzzle.",
        type: "choice",
        default: "medium",
        options: [
          { value: "easy", label: "Easy · 8–12" },
          { value: "medium", label: "Medium · 13–18" },
          { value: "hard", label: "Hard · 19–25" },
          { value: "expert", label: "Expert · 26+" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
    },
  });

  const els = {
    moves: document.getElementById("moves"),
    optimal: document.getElementById("optimal"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    lot: document.getElementById("lot"),
    grid: document.getElementById("grid"),
    cars: document.getElementById("cars"),
    nudge: document.getElementById("nudge"),
    start: document.getElementById("start-btn"),
    reset: document.getElementById("reset-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    level: "medium",
    board: "",
    optimal: 0,
    vehicles: [],
    start: [],
    pos: [],
    moves: 0,
    lastMoved: -1,
    selected: -1,
    drag: null,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  let buttons = [];

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function readBest(level) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${level}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  function writeBest(level, moves) {
    try { localStorage.setItem(`${BEST_PREFIX}.${level}`, String(moves)); } catch { /* still finishes */ }
  }
  function showBest() {
    const best = readBest(state.level);
    els.best.textContent = best ? String(best) : "—";
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function buildGrid() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("span");
      if (((i / N) | 0) === EXIT_ROW) cell.className = "is-lane";
      frag.append(cell);
    }
    els.grid.replaceChildren(frag);
  }

  function nameOf(i) {
    if (i === 0) return "Red car";
    return `${state.vehicles[i].len === 3 ? "Truck" : "Car"} ${LETTERS[i]}`;
  }

  function describe(i) {
    const vehicle = state.vehicles[i];
    const at = state.pos[i];
    const span = `${at + 1} to ${at + vehicle.len}`;
    const where = vehicle.horiz ? `row ${vehicle.line + 1}, columns ${span}` : `column ${vehicle.line + 1}, rows ${span}`;
    return `${nameOf(i)}, ${where}, slides ${vehicle.horiz ? "left and right" : "up and down"}`;
  }

  function buildCars() {
    buttons = state.vehicles.map((vehicle, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `car ${vehicle.horiz ? "car--h" : "car--v"}${i === 0 ? " car--red" : ""}`;
      button.dataset.index = String(i);
      button.dataset.hue = String((i - 1) % 4);
      button.style.setProperty("--w", String(vehicle.horiz ? vehicle.len : 1));
      button.style.setProperty("--h", String(vehicle.horiz ? 1 : vehicle.len));
      return button;
    });
    els.cars.replaceChildren(...buttons);
  }

  function paint() {
    const playing = state.phase === "play";
    buttons.forEach((button, i) => {
      const vehicle = state.vehicles[i];
      button.style.setProperty("--x", String(vehicle.horiz ? state.pos[i] : vehicle.line));
      button.style.setProperty("--y", String(vehicle.horiz ? vehicle.line : state.pos[i]));
      button.classList.toggle("is-selected", i === state.selected && playing);
      button.setAttribute("aria-label", describe(i));
      button.disabled = !playing;
    });
    els.moves.textContent = String(state.moves);
    els.lot.classList.toggle("is-done", state.phase === "done");
    paintNudge();
  }

  function paintNudge() {
    const i = state.selected;
    const ready = state.phase === "play" && i >= 0;
    let low = 0;
    let high = 0;
    if (ready) [low, high] = range(state.vehicles, state.pos, fillGrid(state.vehicles, state.pos, new Int8Array(N * N)), i);
    for (const button of els.nudge.querySelectorAll("button")) {
      const step = Number(button.dataset.step);
      const axisOk = ready && (button.dataset.axis === "h") === state.vehicles[i].horiz;
      button.disabled = !axisOk || (step < 0 ? state.pos[i] <= low : state.pos[i] >= high);
    }
  }

  function select(i) {
    if (state.phase !== "play") return;
    state.selected = i;
    paint();
  }

  function commit(i, to) {
    if (state.phase !== "play" || to === state.pos[i]) return;
    state.pos[i] = to;
    if (state.lastMoved !== i) state.moves += 1;
    state.lastMoved = i;
    if (isSolved(state.vehicles, state.pos)) {
      finish();
      return;
    }
    if (els.status.classList.contains("is-bad")) setStatus(playText());
    paint();
  }

  function nudge(i, step) {
    if (state.phase !== "play" || i < 0) return;
    const [low, high] = range(state.vehicles, state.pos, fillGrid(state.vehicles, state.pos, new Int8Array(N * N)), i);
    const to = state.pos[i] + step;
    if (to < low || to > high) {
      setStatus(`${nameOf(i)} is blocked that way.`, "bad");
      return;
    }
    commit(i, to);
  }

  function playText() {
    return `Free the red car. Shortest solution: ${BAND_TEXT[state.level]} moves.`;
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function endDrag() {
    const drag = state.drag;
    if (!drag) return;
    state.drag = null;
    const button = buttons[drag.index];
    if (button) {
      button.classList.remove("is-dragging");
      button.style.transform = "";
    }
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.level = levelOf(settings.values.difficulty);
    endDrag();
    window.clearTimeout(state.clock);
    state.vehicles = [];
    state.pos = [];
    state.selected = -1;
    buttons = [];
    els.cars.replaceChildren();
    els.time.textContent = "0:00";
    els.moves.textContent = "0";
    els.optimal.textContent = "—";
    els.summary.hidden = true;
    els.reset.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    els.lot.classList.remove("is-done");
    showBest();
    paintNudge();
    setStatus(`Free the red car. Next puzzle: ${LEVEL_NAMES[state.level]}, ${BAND_TEXT[state.level]} moves.`);
  }

  function begin() {
    if (state.phase === "building") return;
    const token = ++state.token;
    const level = levelOf(settings.values.difficulty);
    const avoid = state.board;
    endDrag();
    window.clearTimeout(state.clock);
    state.phase = "building";
    state.level = level;
    state.selected = -1;
    els.summary.hidden = true;
    els.reset.hidden = true;
    els.start.hidden = false;
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.optimal.textContent = "—";
    els.time.textContent = "0:00";
    els.moves.textContent = "0";
    showBest();
    buttons = [];
    els.cars.replaceChildren();
    els.lot.classList.remove("is-done");
    paintNudge();
    setStatus(`Building a ${LEVEL_NAMES[level]} puzzle…`);
    window.setTimeout(() => {
      if (token !== state.token) return;
      const puzzle = nextPuzzle(level, avoid);
      if (token !== state.token) return;
      const parsed = puzzle && parse(puzzle.board);
      if (!parsed) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a puzzle. Try again.", "bad");
        return;
      }
      state.board = puzzle.board;
      state.optimal = puzzle.optimal;
      state.vehicles = parsed.vehicles;
      state.start = parsed.pos.slice();
      state.pos = parsed.pos.slice();
      state.moves = 0;
      state.lastMoved = -1;
      state.record = false;
      state.phase = "play";
      state.started = Date.now();
      state.elapsed = 0;
      els.start.disabled = false;
      els.start.textContent = "New puzzle";
      els.reset.hidden = false;
      buildCars();
      setStatus(playText());
      paint();
      tick();
    }, 30);
  }

  function reset() {
    if (state.phase !== "play") return;
    endDrag();
    state.pos = state.start.slice();
    state.moves = 0;
    state.lastMoved = -1;
    setStatus(playText());
    paint();
  }

  function finish() {
    state.phase = "done";
    endDrag();
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.level);
    if (!previous || state.moves < previous) {
      state.record = true;
      writeBest(state.level, state.moves);
    }
    const clock = formatTime(state.elapsed);
    const moves = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
    els.time.textContent = clock;
    els.optimal.textContent = String(state.optimal);
    showBest();
    paint();
    els.reset.hidden = true;
    els.start.hidden = true;
    els.summaryText.textContent = state.record
      ? `Freed in ${moves} and ${clock}. Best possible: ${state.optimal}. New ${LEVEL_NAMES[state.level]} best.`
      : `Freed in ${moves} and ${clock}. Best possible: ${state.optimal}. Your ${LEVEL_NAMES[state.level]} best is ${readBest(state.level)}.`;
    els.summary.hidden = false;
    setStatus(state.moves === state.optimal ? "Perfect: the shortest possible solution." : "The red car drove out.", "ok");
    els.again.focus();
  }

  function onPointerDown(event) {
    const button = event.target.closest ? event.target.closest(".car") : null;
    if (!button || state.phase !== "play" || state.drag || event.button !== 0) return;
    const i = Number(button.dataset.index);
    const [low, high] = range(state.vehicles, state.pos, fillGrid(state.vehicles, state.pos, new Int8Array(N * N)), i);
    state.drag = {
      index: i,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cell: els.cars.getBoundingClientRect().width / N,
      from: state.pos[i],
      low,
      high,
      offset: 0,
    };
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-dragging");
    button.focus({ preventScroll: true });
    select(i);
    event.preventDefault();
  }

  function onPointerMove(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const horiz = state.vehicles[drag.index].horiz;
    const raw = horiz ? event.clientX - drag.x : event.clientY - drag.y;
    drag.offset = Math.max((drag.low - drag.from) * drag.cell, Math.min((drag.high - drag.from) * drag.cell, raw));
    buttons[drag.index].style.transform = horiz ? `translateX(${drag.offset}px)` : `translateY(${drag.offset}px)`;
  }

  function onPointerUp(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const to = Math.max(drag.low, Math.min(drag.high, drag.from + Math.round(drag.offset / drag.cell)));
    const button = buttons[drag.index];
    state.drag = null;
    if (event.type === "pointerup") commit(drag.index, to);
    else paint();
    button.style.transform = "";
    window.requestAnimationFrame(() => button.classList.remove("is-dragging"));
  }

  function onKey(event) {
    const button = event.target.closest ? event.target.closest(".car") : null;
    if (!button || state.phase !== "play" || state.drag) return;
    const keys = { ArrowLeft: ["h", -1], ArrowRight: ["h", 1], ArrowUp: ["v", -1], ArrowDown: ["v", 1] };
    const hit = keys[event.key];
    if (!hit || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const i = Number(button.dataset.index);
    if (state.selected !== i) select(i);
    if ((hit[0] === "h") !== state.vehicles[i].horiz) {
      setStatus(`${nameOf(i)} slides ${state.vehicles[i].horiz ? "left and right" : "up and down"}.`, "bad");
      return;
    }
    nudge(i, hit[1]);
  }

  buildGrid();
  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.reset.addEventListener("click", reset);
  els.cars.addEventListener("pointerdown", onPointerDown);
  els.cars.addEventListener("pointermove", onPointerMove);
  els.cars.addEventListener("pointerup", onPointerUp);
  els.cars.addEventListener("pointercancel", onPointerUp);
  els.cars.addEventListener("lostpointercapture", onPointerUp);
  els.cars.addEventListener("keydown", onKey);
  els.cars.addEventListener("focusin", (event) => {
    const button = event.target.closest ? event.target.closest(".car") : null;
    if (button && state.phase === "play" && !state.drag) select(Number(button.dataset.index));
  });
  els.nudge.addEventListener("click", (event) => {
    const button = event.target.closest ? event.target.closest("button[data-step]") : null;
    if (button) nudge(state.selected, Number(button.dataset.step));
  });
})();
