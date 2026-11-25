(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.sokoban.best";
  const PROGRESS_KEY = "mental-game.sokoban.progress";

  const LEVELS = [
    ["######", "#@   #", "# #$ #", "#.   #", "######"],
    ["######", "#.   #", "#  # #", "#$#  #", "#.@$ #", "######"],
    ["#######", "#  # +#", "# $   #", "#.#$# #", "#     #", "#######"],
    ["#######", "#+ .$ #", "#*### #", "# $   #", "# # # #", "#     #", "#######"],
    ["#######", "###   #", "# $ #$#", "# #   #", "#   #.#", "#.@   #", "#######"],
    ["########", "###    #", "#   ## #", "# #   $#", "#  .# .#", "## # $ #", "#@*    #", "########"],
    ["########", "#@ #   #", "# $.  .#", "##$#.# #", "# $  # #", "#      #", "########"],
    ["########", "#   #  #", "#@.*   #", "# ## # #", "#.$  # #", "# #$ $ #", "#   # .#", "########"],
    ["#########", "##   ..##", "#  # #  #", "#$   .  #", "# ## ## #", "# $     #", "#+$# #$ #", "##     ##", "#########"],
    ["#########", "#.    ###", "# ##. $@#", "#  # ##$#", "##$# $  #", "#    ##.#", "# ## $..#", "#    #  #", "#########"],
    ["#########", "#  ###  #", "# $     #", "# # $ #.#", "#.# # #.#", "#   #   #", "###*#$###", "#@$   . #", "#########"],
    ["#########", "# .  # .#", "#  # $  #", "##$# ## #", "# *     #", "#@## #  #", "# $ $# .#", "#  #   .#", "#########"],
    ["#########", "#.  #@  #", "#    $. #", "##.### ##", "#   # $ #", "#     $ #", "# * #   #", "#########"],
    ["##########", "###   ####", "# $ #$ $ #", "# # $@## #", "# ..#$   #", "##.## .# #", "#    $ # #", "#   #. . #", "##########"],
  ].map((rows) => rows.join("\n"));

  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  function parseLevel(text) {
    const lines = String(text).split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    const height = lines.length;
    const width = Math.max(0, ...lines.map((line) => line.length));
    if (!height || !width) return null;
    const size = width * height;
    const raw = new Uint8Array(size);
    const target = new Uint8Array(size);
    const boxes = [];
    let player = -1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const ch = lines[r][c] || " ";
        const i = r * width + c;
        if (ch === "#") { raw[i] = 1; continue; }
        if (ch === "." || ch === "*" || ch === "+") target[i] = 1;
        if (ch === "$" || ch === "*") boxes.push(i);
        if (ch === "@" || ch === "+") {
          if (player >= 0) return null;
          player = i;
        }
        if (!" .$@*+-_".includes(ch)) return null;
      }
    }
    if (player < 0) return null;
    const inside = new Uint8Array(size);
    const stack = [player];
    inside[player] = 1;
    while (stack.length) {
      const i = stack.pop();
      const r = (i / width) | 0;
      const c = i % width;
      if (r === 0 || c === 0 || r === height - 1 || c === width - 1) return null;
      for (const next of [i - width, i + width, i - 1, i + 1]) {
        if (raw[next] || inside[next]) continue;
        inside[next] = 1;
        stack.push(next);
      }
    }
    const wall = new Uint8Array(size);
    const targets = [];
    for (let i = 0; i < size; i++) {
      wall[i] = inside[i] ? 0 : 1;
      if (target[i] && !inside[i]) return null;
      if (target[i]) targets.push(i);
    }
    if (boxes.some((box) => !inside[box])) return null;
    if (!boxes.length || boxes.length !== targets.length) return null;
    boxes.sort((a, b) => a - b);
    const level = { width, height, wall, inside, raw, target, targets, boxes, player };
    level.dead = deadSquares(level);
    return level;
  }

  function offsets(level) {
    return [-level.width, level.width, -1, 1];
  }

  function deadSquares(level) {
    const size = level.width * level.height;
    const live = new Uint8Array(size);
    const stack = [];
    for (const t of level.targets) { live[t] = 1; stack.push(t); }
    const steps = offsets(level);
    while (stack.length) {
      const box = stack.pop();
      for (const d of steps) {
        const to = box + d;
        const behind = to + d;
        if (level.wall[to] || level.wall[behind] || live[to]) continue;
        live[to] = 1;
        stack.push(to);
      }
    }
    const dead = new Uint8Array(size);
    for (let i = 0; i < size; i++) dead[i] = level.inside[i] && !live[i] ? 1 : 0;
    return dead;
  }

  function startState(level) {
    return { player: level.player, boxes: level.boxes.slice() };
  }

  function move(level, state, dir) {
    const delta = DIRS[dir];
    if (!delta) return null;
    const step = delta[0] * level.width + delta[1];
    const to = state.player + step;
    if (level.wall[to]) return null;
    const at = state.boxes.indexOf(to);
    if (at < 0) return { player: to, boxes: state.boxes.slice(), pushed: false };
    const behind = to + step;
    if (level.wall[behind] || state.boxes.includes(behind)) return null;
    const boxes = state.boxes.slice();
    boxes[at] = behind;
    boxes.sort((a, b) => a - b);
    return { player: to, boxes, pushed: true };
  }

  function isSolved(level, state) {
    return state.boxes.length > 0 && state.boxes.every((box) => level.target[box] === 1);
  }

  function isDeadBox(level, box) {
    return level.dead[box] === 1;
  }

  function keyOf(player, boxes) {
    return String.fromCharCode(player, ...boxes);
  }

  function solve(level, cap = 2000000) {
    const steps = offsets(level);
    const startKey = keyOf(level.player, level.boxes);
    if (isSolved(level, level)) return { moves: 0, pushes: 0, states: 1 };
    const pushes = new Map([[startKey, 0]]);
    let frontier = [startKey];
    let depth = 0;
    const occupied = new Uint8Array(level.width * level.height);
    while (frontier.length) {
      depth++;
      const next = [];
      for (const key of frontier) {
        const player = key.charCodeAt(0);
        const boxes = [];
        for (let k = 1; k < key.length; k++) boxes.push(key.charCodeAt(k));
        for (const box of boxes) occupied[box] = 1;
        const done = pushes.get(key);
        for (const d of steps) {
          const to = player + d;
          if (level.wall[to]) continue;
          let childBoxes = boxes;
          let pushed = 0;
          if (occupied[to]) {
            const behind = to + d;
            if (level.wall[behind] || occupied[behind] || level.dead[behind]) continue;
            childBoxes = boxes.map((box) => (box === to ? behind : box)).sort((a, b) => a - b);
            pushed = 1;
          }
          const child = keyOf(to, childBoxes);
          if (pushes.has(child)) continue;
          pushes.set(child, done + pushed);
          if (pushed && childBoxes.every((box) => level.target[box] === 1)) {
            for (const box of boxes) occupied[box] = 0;
            return { moves: depth, pushes: done + 1, states: pushes.size };
          }
          next.push(child);
        }
        for (const box of boxes) occupied[box] = 0;
        if (pushes.size > cap) return null;
      }
      frontier = next;
    }
    return { moves: -1, pushes: -1, states: pushes.size };
  }

  function region(level, player, occupied, steps, seen, stamp) {
    let low = player;
    const stack = [player];
    seen[player] = stamp;
    while (stack.length) {
      const i = stack.pop();
      if (i < low) low = i;
      for (const d of steps) {
        const next = i + d;
        if (level.wall[next] || occupied[next] || seen[next] === stamp) continue;
        seen[next] = stamp;
        stack.push(next);
      }
    }
    return low;
  }

  function solvePushes(level, cap = 2000000) {
    const steps = offsets(level);
    const size = level.width * level.height;
    const occupied = new Uint8Array(size);
    const seen = new Int32Array(size);
    const reachable = new Int32Array(size);
    let stamp = 0;
    let reach = 0;
    if (isSolved(level, level)) return { pushes: 0, states: 1 };
    for (const box of level.boxes) occupied[box] = 1;
    const first = keyOf(region(level, level.player, occupied, steps, seen, ++stamp), level.boxes);
    for (const box of level.boxes) occupied[box] = 0;
    const visited = new Set([first]);
    let frontier = [first];
    let depth = 0;
    while (frontier.length) {
      depth++;
      const next = [];
      for (const key of frontier) {
        const player = key.charCodeAt(0);
        const boxes = [];
        for (let k = 1; k < key.length; k++) boxes.push(key.charCodeAt(k));
        for (const box of boxes) occupied[box] = 1;
        region(level, player, occupied, steps, reachable, ++reach);
        for (const box of boxes) {
          for (const d of steps) {
            const from = box - d;
            const behind = box + d;
            if (reachable[from] !== reach || level.wall[behind] || occupied[behind] || level.dead[behind]) continue;
            const moved = boxes.map((b) => (b === box ? behind : b)).sort((a, b) => a - b);
            if (moved.every((b) => level.target[b] === 1)) {
              for (const b of boxes) occupied[b] = 0;
              return { pushes: depth, states: visited.size };
            }
            occupied[box] = 0;
            occupied[behind] = 1;
            const child = keyOf(region(level, box, occupied, steps, seen, ++stamp), moved);
            occupied[behind] = 0;
            occupied[box] = 1;
            if (visited.has(child)) continue;
            visited.add(child);
            next.push(child);
          }
        }
        for (const box of boxes) occupied[box] = 0;
        if (visited.size > cap) return null;
      }
      frontier = next;
    }
    return { pushes: -1, states: visited.size };
  }

  if (typeof document === "undefined") {
    globalThis.__sokoban = { LEVELS, parseLevel, startState, move, isSolved, isDeadBox, deadSquares, solve, solvePushes };
    return;
  }

  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
  };

  const parsed = LEVELS.map(parseLevel);

  const state = {
    phase: "play",
    currentLevel: 1,
    number: 1,
    level: null,
    player: -1,
    boxes: [],
    history: [],
    moves: 0,
    pushes: 0,
    record: false,
  };

  function levelNumber(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= LEVELS.length ? n : 1;
  }

  const settings = GameSettings.mount({
    id: "sokoban",
    fields: [
      {
        id: "level",
        label: "Level",
        hint: "Levels get bigger and need more planning as the number goes up.",
        type: "choice",
        default: "1",
        options: LEVELS.map((_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      },
      {
        id: "deadlock",
        label: "Show deadlock warning",
        hint: "Tints a box red when it sits where it can never reach a ring.",
        type: "toggle",
        default: true,
      },
    ],
    onChange(values) {
      const chosen = levelNumber(values.level);
      if (chosen !== state.currentLevel) {
        state.currentLevel = chosen;
        saveProgress();
        if (state.phase === "done" || state.moves === 0) loadLevel(chosen);
        else setStatus(`Level ${chosen} selected. Press Reset level to switch.`);
      }
      paint();
    },
  });

  const els = {
    level: document.getElementById("level"),
    moves: document.getElementById("moves"),
    pushes: document.getElementById("pushes"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    room: document.getElementById("room"),
    pad: document.getElementById("pad"),
    undo: document.getElementById("undo-btn"),
    reset: document.getElementById("reset-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    next: document.getElementById("next-btn"),
    again: document.getElementById("again-btn"),
  };

  let cells = [];

  function readBest(n) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${n}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  function writeBest(n, moves) {
    try { localStorage.setItem(`${BEST_PREFIX}.${n}`, String(moves)); } catch { /* still finishes */ }
  }
  function readProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
      return saved && typeof saved === "object" ? saved : null;
    } catch {
      return null;
    }
  }
  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ level: state.currentLevel, setting: settings.values.level }));
    } catch { /* progress only lasts this visit */ }
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function showBest() {
    const best = readBest(state.number);
    els.best.textContent = best ? String(best) : "—";
  }
  function introText() {
    const count = state.level.boxes.length;
    return `Level ${state.number} of ${LEVELS.length}: push ${count === 1 ? "the box" : `all ${count} boxes`} onto the rings.`;
  }

  function buildRoom() {
    const level = state.level;
    els.room.style.setProperty("--w", String(level.width));
    els.room.style.setProperty("--h", String(level.height));
    els.room.setAttribute("aria-label", `Level ${state.number} board. Use the arrow keys or W A S D to move.`);
    cells = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < level.width * level.height; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (level.inside[i]) cell.classList.add("cell--floor");
      else if (level.raw[i]) cell.classList.add("cell--wall");
      if (level.target[i]) cell.classList.add("cell--target");
      cell.dataset.index = String(i);
      cell.setAttribute("aria-hidden", "true");
      cells.push(cell);
      frag.append(cell);
    }
    els.room.replaceChildren(frag);
  }

  function paint() {
    if (!state.level) return;
    const warn = settings.values.deadlock !== false;
    const boxes = new Set(state.boxes);
    for (let i = 0; i < cells.length; i++) {
      const has = boxes.has(i);
      cells[i].classList.toggle("has-box", has);
      cells[i].classList.toggle("is-dead", has && warn && isDeadBox(state.level, i));
      cells[i].classList.toggle("has-player", i === state.player);
    }
    els.level.textContent = String(state.number);
    els.moves.textContent = String(state.moves);
    els.pushes.textContent = String(state.pushes);
    els.undo.disabled = state.phase !== "play" || !state.history.length;
    for (const button of els.pad.querySelectorAll("button")) button.disabled = state.phase !== "play";
  }

  function loadLevel(n) {
    state.number = levelNumber(n);
    state.level = parsed[state.number - 1];
    const start = startState(state.level);
    state.phase = "play";
    state.player = start.player;
    state.boxes = start.boxes;
    state.history = [];
    state.moves = 0;
    state.pushes = 0;
    state.record = false;
    els.summary.hidden = true;
    showBest();
    buildRoom();
    setStatus(introText());
    paint();
  }

  function step(dir) {
    if (state.phase !== "play") return;
    const next = move(state.level, state, dir);
    if (!next) return;
    const pushedTo = next.pushed ? next.player * 2 - state.player : -1;
    state.history.push({ player: state.player, boxes: state.boxes, pushed: next.pushed });
    state.player = next.player;
    state.boxes = next.boxes;
    state.moves += 1;
    if (next.pushed) state.pushes += 1;
    if (isSolved(state.level, state)) {
      finish();
      return;
    }
    if (pushedTo >= 0 && settings.values.deadlock !== false && isDeadBox(state.level, pushedTo)) {
      setStatus("That box can no longer reach a ring. Undo to free it.", "bad");
    } else if (els.status.classList.contains("is-bad")) {
      setStatus(introText());
    }
    paint();
  }

  function undo() {
    if (state.phase !== "play" || !state.history.length) return;
    const last = state.history.pop();
    state.player = last.player;
    state.boxes = last.boxes;
    state.moves -= 1;
    if (last.pushed) state.pushes -= 1;
    if (els.status.classList.contains("is-bad")) setStatus(introText());
    paint();
  }

  function finish() {
    state.phase = "done";
    const previous = readBest(state.number);
    if (!previous || state.moves < previous) {
      state.record = true;
      writeBest(state.number, state.moves);
    }
    showBest();
    paint();
    const last = state.number >= LEVELS.length;
    const tally = `${state.moves} ${state.moves === 1 ? "move" : "moves"} and ${state.pushes} ${state.pushes === 1 ? "push" : "pushes"}`;
    els.summaryText.textContent = state.record
      ? `Level ${state.number} solved in ${tally}. New best.${last ? " That was the last level." : ""}`
      : `Level ${state.number} solved in ${tally}. Best is ${readBest(state.number)} moves.${last ? " That was the last level." : ""}`;
    els.next.hidden = last;
    els.summary.hidden = false;
    setStatus("Every box is on a ring.", "ok");
    (last ? els.again : els.next).focus();
  }

  function nextLevel() {
    if (state.number >= LEVELS.length) return;
    state.currentLevel = state.number + 1;
    saveProgress();
    loadLevel(state.currentLevel);
    els.room.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (state.phase !== "play") return;
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const undoCombo = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "z";
    if (undoCombo || (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "u" || event.key === "U" || event.key === "Backspace"))) {
      event.preventDefault();
      undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const dir = KEYS[event.key] || KEYS[event.key.toLowerCase()];
    if (!dir) return;
    event.preventDefault();
    step(dir);
  }

  function onRoomClick(event) {
    if (state.phase !== "play") return;
    const cell = event.target.closest ? event.target.closest(".cell") : null;
    if (!cell) return;
    const index = Number(cell.dataset.index);
    const width = state.level.width;
    const dr = ((index / width) | 0) - ((state.player / width) | 0);
    const dc = (index % width) - (state.player % width);
    if (Math.abs(dr) === Math.abs(dc)) return;
    if (Math.abs(dr) > Math.abs(dc)) step(dr > 0 ? "down" : "up");
    else step(dc > 0 ? "right" : "left");
  }

  const saved = readProgress();
  const fromSetting = levelNumber(settings.values.level);
  state.currentLevel = saved && saved.setting === settings.values.level ? levelNumber(saved.level) : fromSetting;
  loadLevel(state.currentLevel);

  document.addEventListener("keydown", onKey);
  els.room.addEventListener("click", onRoomClick);
  els.pad.addEventListener("click", (event) => {
    const button = event.target.closest ? event.target.closest("button[data-dir]") : null;
    if (button) step(button.dataset.dir);
  });
  els.undo.addEventListener("click", undo);
  els.reset.addEventListener("click", () => loadLevel(state.currentLevel));
  els.next.addEventListener("click", nextLevel);
  els.again.addEventListener("click", () => {
    loadLevel(state.number);
    els.room.focus();
  });
})();
