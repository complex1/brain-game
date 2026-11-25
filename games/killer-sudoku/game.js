(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.killer-sudoku.best";
  const SHAPES = { 6: [2, 3], 9: [3, 3] };
  const SIZES = [6, 9];
  const NODE_LIMIT = 30000;
  const MERGE_NODE_LIMIT = 1500;
  const MERGE_BUDGET = 700;
  const MAX_CAGE = 4;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function bitCount(mask) {
    let count = 0;
    let bits = mask;
    while (bits) {
      bits &= bits - 1;
      count++;
    }
    return count;
  }

  function digitOf(bit) {
    return 32 - Math.clz32(bit);
  }

  function neighbors(n, i) {
    const r = (i / n) | 0;
    const c = i % n;
    const list = [];
    if (r > 0) list.push(i - n);
    if (r < n - 1) list.push(i + n);
    if (c > 0) list.push(i - 1);
    if (c < n - 1) list.push(i + 1);
    return list;
  }

  const layouts = new Map();

  function layoutOf(n) {
    if (layouts.has(n)) return layouts.get(n);
    const [bh, bw] = SHAPES[n];
    const box = (i) => (((i / n) | 0) / bh | 0) * (n / bw) + ((i % n) / bw | 0);
    const units = [];
    for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
    for (let b = 0; b < n; b++) {
      const list = [];
      for (let i = 0; i < n * n; i++) if (box(i) === b) list.push(i);
      units.push(list);
    }
    const peers = Array.from({ length: n * n }, (_, i) => {
      const set = new Set();
      for (const unit of units) if (unit.includes(i)) for (const j of unit) if (j !== i) set.add(j);
      return [...set];
    });
    const layout = { bh, bw, box, units, peers, full: (1 << n) - 1 };
    layouts.set(n, layout);
    return layout;
  }

  const comboCache = new Map();

  function combosFor(n, count, sum) {
    const key = `${n},${count},${sum}`;
    if (comboCache.has(key)) return comboCache.get(key);
    const list = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      if (bitCount(mask) !== count) continue;
      let total = 0;
      for (let d = 1; d <= n; d++) if (mask & (1 << (d - 1))) total += d;
      if (total === sum) list.push(mask);
    }
    comboCache.set(key, list);
    return list;
  }

  function solve(puzzle, limit, nodeLimit) {
    const n = puzzle.n;
    const size = n * n;
    const { units, peers: housePeers, full } = layoutOf(n);
    const cages = puzzle.cages.map((cage) => ({ cells: cage.cells, combos: combosFor(n, cage.cells.length, cage.sum) }));
    const peers = housePeers.map((list) => new Set(list));
    for (const cage of cages) {
      for (const a of cage.cells) for (const b of cage.cells) if (a !== b) peers[a].add(b);
    }
    const peerList = peers.map((set) => [...set]);
    const start = new Uint16Array(size).fill(full);
    const solutions = [];
    let found = 0;
    let nodes = 0;
    let aborted = false;

    function propagate(dom) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < size; i++) {
          const mask = dom[i];
          if (!mask) return false;
          if (mask & (mask - 1)) continue;
          for (const p of peerList[i]) {
            if (!(dom[p] & mask)) continue;
            dom[p] &= ~mask;
            if (!dom[p]) return false;
            changed = true;
          }
        }
        for (const cage of cages) {
          let fixed = 0;
          for (const i of cage.cells) if (!(dom[i] & (dom[i] - 1))) fixed |= dom[i];
          let allowed = 0;
          let required = full;
          for (const combo of cage.combos) {
            if ((combo & fixed) !== fixed) continue;
            let fits = true;
            for (const i of cage.cells) {
              if (!(dom[i] & combo)) {
                fits = false;
                break;
              }
            }
            if (!fits) continue;
            allowed |= combo;
            required &= combo;
          }
          if (!allowed) return false;
          for (const i of cage.cells) {
            if (dom[i] & ~allowed) {
              dom[i] &= allowed;
              changed = true;
            }
          }
          let need = required & ~fixed;
          while (need) {
            const bit = need & -need;
            need ^= bit;
            let spot = -1;
            let spots = 0;
            for (const i of cage.cells) {
              if (dom[i] & bit) {
                spot = i;
                spots++;
              }
            }
            if (!spots) return false;
            if (spots === 1 && dom[spot] !== bit) {
              dom[spot] = bit;
              changed = true;
            }
          }
        }
        for (const unit of units) {
          let once = 0;
          let twice = 0;
          for (const i of unit) {
            twice |= once & dom[i];
            once |= dom[i];
          }
          if (once !== full) return false;
          let single = once & ~twice;
          while (single) {
            const bit = single & -single;
            single ^= bit;
            for (const i of unit) {
              if (!(dom[i] & bit)) continue;
              if (dom[i] !== bit) {
                dom[i] = bit;
                changed = true;
              }
              break;
            }
          }
        }
      }
      return true;
    }

    function search(dom) {
      if (found >= limit || aborted) return;
      if (++nodes > nodeLimit) {
        aborted = true;
        return;
      }
      if (!propagate(dom)) return;
      let best = -1;
      let bestCount = 99;
      for (let i = 0; i < size; i++) {
        const count = bitCount(dom[i]);
        if (count > 1 && count < bestCount) {
          best = i;
          bestCount = count;
          if (count === 2) break;
        }
      }
      if (best < 0) {
        found++;
        solutions.push(Array.from(dom, digitOf));
        return;
      }
      let mask = dom[best];
      while (mask) {
        const bit = mask & -mask;
        mask ^= bit;
        const next = dom.slice();
        next[best] = bit;
        search(next);
        if (found >= limit || aborted) return;
      }
    }

    search(start);
    return { count: found, aborted, solutions };
  }

  function countSolutions(puzzle, limit = 2) {
    return solve(puzzle, limit, Infinity).count;
  }

  function solvedBoard(n) {
    const [bh, bw] = SHAPES[n];
    const rows = [];
    for (const band of shuffle([...Array(n / bh).keys()])) {
      for (const offset of shuffle([...Array(bh).keys()])) rows.push(band * bh + offset);
    }
    const cols = [];
    for (const stack of shuffle([...Array(n / bw).keys()])) {
      for (const offset of shuffle([...Array(bw).keys()])) cols.push(stack * bw + offset);
    }
    const digits = shuffle(Array.from({ length: n }, (_, i) => i + 1));
    const board = new Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const rr = rows[r];
        board[r * n + c] = digits[(bw * (rr % bh) + ((rr / bh) | 0) + cols[c]) % n];
      }
    }
    if (bh === bw && Math.random() < 0.5) {
      const turned = new Array(n * n);
      for (let i = 0; i < n * n; i++) turned[(i % n) * n + ((i / n) | 0)] = board[i];
      return turned;
    }
    return board;
  }

  function pickCageSize() {
    const roll = Math.random();
    if (roll < 0.05) return 1;
    if (roll < 0.4) return 2;
    if (roll < 0.75) return 3;
    return 4;
  }

  function digitsMask(cells, solution) {
    let mask = 0;
    for (const i of cells) mask |= 1 << (solution[i] - 1);
    return mask;
  }

  function partition(n, solution) {
    const owner = new Array(n * n).fill(-1);
    const groups = [];
    for (const startCell of shuffle([...Array(n * n).keys()])) {
      if (owner[startCell] >= 0) continue;
      const id = groups.length;
      const cells = [startCell];
      owner[startCell] = id;
      let used = 1 << (solution[startCell] - 1);
      const target = pickCageSize();
      while (cells.length < target) {
        const options = [];
        for (const cell of cells) {
          for (const next of neighbors(n, cell)) {
            if (owner[next] >= 0 || used & (1 << (solution[next] - 1)) || options.includes(next)) continue;
            options.push(next);
          }
        }
        if (!options.length) break;
        const pick = options[Math.floor(Math.random() * options.length)];
        cells.push(pick);
        owner[pick] = id;
        used |= 1 << (solution[pick] - 1);
      }
      groups.push(cells);
    }
    return groups;
  }

  function connected(n, cells) {
    if (!cells.length) return false;
    const inside = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const cell = stack.pop();
      for (const next of neighbors(n, cell)) {
        if (inside.has(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen.size === cells.length;
  }

  function components(n, cells) {
    const left = new Set(cells);
    const parts = [];
    while (left.size) {
      const first = left.values().next().value;
      left.delete(first);
      const part = [first];
      const stack = [first];
      while (stack.length) {
        const cell = stack.pop();
        for (const next of neighbors(n, cell)) {
          if (!left.has(next)) continue;
          left.delete(next);
          part.push(next);
          stack.push(next);
        }
      }
      parts.push(part);
    }
    return parts;
  }

  function sumOf(cells, grid) {
    let total = 0;
    for (const i of cells) total += grid[i];
    return total;
  }

  /* Splits the cage holding x so that the alternative solution no longer fits its sums. */
  function splitCage(n, groups, x, solution, other) {
    const index = groups.findIndex((cells) => cells.includes(x));
    const cells = groups[index];
    const others = cells.filter((cell) => cell !== x);
    let best = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const part = [x];
      const rest = [];
      others.forEach((cell, k) => (mask & (1 << k) ? part : rest).push(cell));
      if (!rest.length || !connected(n, part)) continue;
      if (sumOf(part, solution) === sumOf(part, other)) continue;
      const pieces = [part, ...components(n, rest)];
      const score = pieces.filter((piece) => piece.length === 1).length * 10 + pieces.length + Math.random();
      if (score < bestScore) {
        bestScore = score;
        best = pieces;
      }
    }
    groups.splice(index, 1, ...best);
  }

  function toPuzzle(n, groups, solution) {
    return {
      n,
      cages: groups.map((cells) => ({ cells: cells.slice().sort((a, b) => a - b), sum: sumOf(cells, solution) })),
    };
  }

  function unique(puzzle, nodeLimit) {
    const result = solve(puzzle, 2, nodeLimit);
    return !result.aborted && result.count === 1;
  }

  /* Folds small cages into a neighbor while the grid stays unique, for a harder puzzle. */
  function mergeSmall(n, groups, solution, deadline) {
    const order = shuffle(groups.filter((cells) => cells.length <= 2));
    for (const cells of order) {
      if (Date.now() > deadline) return;
      const from = groups.indexOf(cells);
      if (from < 0) continue;
      const touching = new Set();
      for (const cell of cells) {
        for (const next of neighbors(n, cell)) {
          const j = groups.findIndex((group) => group.includes(next));
          if (j !== from) touching.add(j);
        }
      }
      const mask = digitsMask(cells, solution);
      for (const j of shuffle([...touching])) {
        const target = groups[j];
        if (target.length + cells.length > MAX_CAGE || digitsMask(target, solution) & mask) continue;
        const trial = groups.filter((_, k) => k !== from && k !== j);
        trial.push(target.concat(cells));
        if (unique(toPuzzle(n, trial, solution), MERGE_NODE_LIMIT)) {
          groups.length = 0;
          groups.push(...trial);
          break;
        }
      }
    }
  }

  function makePuzzle(size, budget = 4000) {
    const n = SIZES.includes(size) ? size : 6;
    const deadline = Date.now() + budget;
    while (Date.now() < deadline) {
      const solution = solvedBoard(n);
      const groups = partition(n, solution);
      let ok = false;
      for (let guard = 0; guard < n * n && Date.now() < deadline; guard++) {
        const result = solve(toPuzzle(n, groups, solution), 2, NODE_LIMIT);
        if (result.aborted) break;
        if (result.count === 1) {
          ok = true;
          break;
        }
        const other = result.solutions.find((grid) => grid.some((digit, i) => digit !== solution[i]));
        const differ = [];
        for (let i = 0; i < n * n; i++) if (other[i] !== solution[i]) differ.push(i);
        splitCage(n, groups, differ[Math.floor(Math.random() * differ.length)], solution, other);
      }
      if (!ok) continue;
      mergeSmall(n, groups, solution, Math.min(deadline, Date.now() + MERGE_BUDGET));
      return { ...toPuzzle(n, groups, solution), solution };
    }
    return null;
  }

  function findBroken(values, puzzle) {
    const n = puzzle.n;
    const cells = new Set();
    const cages = new Set();
    const groups = layoutOf(n).units.concat(puzzle.cages.map((cage) => cage.cells));
    for (const unit of groups) {
      for (let a = 0; a < unit.length; a++) {
        const value = values[unit[a]];
        if (!value) continue;
        for (let b = a + 1; b < unit.length; b++) {
          if (values[unit[b]] !== value) continue;
          cells.add(unit[a]);
          cells.add(unit[b]);
        }
      }
    }
    puzzle.cages.forEach((cage, k) => {
      let total = 0;
      let empty = 0;
      for (const i of cage.cells) {
        if (values[i]) total += values[i];
        else empty++;
      }
      if (total + empty > cage.sum || (!empty && total !== cage.sum)) {
        cages.add(k);
        for (const i of cage.cells) if (values[i]) cells.add(i);
      }
    });
    return { cells, cages };
  }

  function isSolved(values, puzzle) {
    const n = puzzle.n;
    for (let i = 0; i < n * n; i++) if (!(values[i] >= 1 && values[i] <= n)) return false;
    const broken = findBroken(values, puzzle);
    return broken.cells.size === 0 && broken.cages.size === 0;
  }

  if (typeof document === "undefined") {
    globalThis.__killerSudoku = { makePuzzle, countSolutions, isSolved, findBroken, layoutOf, connected };
    return;
  }

  const settings = GameSettings.mount({
    id: "killer-sudoku",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "6×6 uses 2×3 boxes and digits 1–6. Applies to the next puzzle.",
        type: "choice",
        default: "6",
        options: [
          { value: "6", label: "6×6" },
          { value: "9", label: "9×9" },
        ],
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark repeated digits and cages whose sum can no longer work.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") showIdle();
      else if (state.phase === "play") render();
    },
  });

  const els = {
    filled: document.getElementById("filled"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    pad: document.getElementById("pad"),
    padNums: document.getElementById("pad-nums"),
    notes: document.getElementById("notes-btn"),
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 6,
    puzzle: null,
    owner: [],
    values: [],
    notes: [],
    selected: -1,
    notesMode: false,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  const cells = [];
  const valueEls = [];
  const sumEls = new Map();

  function sizeOf(value) {
    const n = Number(value);
    return SIZES.includes(n) ? n : 6;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function bestKey(n) {
    return `${BEST_PREFIX}.${n}`;
  }

  function readBest(n) {
    const stored = Number(localStorage.getItem(bestKey(n)));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(n, ms) {
    try {
      localStorage.setItem(bestKey(n), String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function showBest(n) {
    const best = readBest(n);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function rowOf(i) {
    return (i / state.n) | 0;
  }

  function colOf(i) {
    return i % state.n;
  }

  function buildBoard() {
    const n = state.n;
    const { bh, bw } = layoutOf(n);
    const owner = new Array(n * n).fill(-1);
    state.puzzle.cages.forEach((cage, k) => {
      for (const i of cage.cells) owner[i] = k;
    });
    state.owner = owner;

    els.board.replaceChildren();
    els.board.style.setProperty("--n", String(n));
    els.board.classList.toggle("board--9", n === 9);
    cells.length = 0;
    valueEls.length = 0;
    sumEls.clear();

    for (let r = 0; r < n; r++) {
      const line = document.createElement("div");
      line.className = "board__row";
      line.setAttribute("role", "row");
      for (let c = 0; c < n; c++) {
        const index = r * n + c;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.setAttribute("role", "gridcell");
        button.classList.toggle("is-box-r", c % bw === bw - 1 && c < n - 1);
        button.classList.toggle("is-box-b", r % bh === bh - 1 && r < n - 1);
        button.addEventListener("click", () => select(index));

        const k = owner[index];
        if (k >= 0) {
          const same = (j) => owner[j] === k;
          const outline = document.createElement("span");
          outline.className = "cage";
          outline.setAttribute("aria-hidden", "true");
          outline.classList.toggle("open-t", r > 0 && same(index - n));
          outline.classList.toggle("open-b", r < n - 1 && same(index + n));
          outline.classList.toggle("open-l", c > 0 && same(index - 1));
          outline.classList.toggle("open-r", c < n - 1 && same(index + 1));
          button.append(outline);
          if (state.puzzle.cages[k].cells[0] === index) {
            const sum = document.createElement("span");
            sum.className = "cage__sum";
            sum.setAttribute("aria-hidden", "true");
            sum.textContent = String(state.puzzle.cages[k].sum);
            sumEls.set(k, sum);
            button.append(sum);
          }
        }

        const value = document.createElement("span");
        value.className = "cell__value";
        button.append(value);
        valueEls.push(value);
        cells.push(button);
        line.append(button);
      }
      els.board.append(line);
    }

    els.padNums.replaceChildren();
    els.padNums.classList.toggle("pad__nums--9", n === 9);
    for (let digit = 1; digit <= n; digit++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--ghost";
      button.textContent = String(digit);
      button.setAttribute("aria-label", `Enter ${digit}`);
      button.addEventListener("click", () => enterDigit(digit));
      els.padNums.append(button);
    }
  }

  function notesElement(mask) {
    const grid = document.createElement("span");
    grid.className = "cell__notes";
    grid.setAttribute("aria-hidden", "true");
    for (let digit = 1; digit <= state.n; digit++) {
      const mark = document.createElement("i");
      if (mask & (1 << (digit - 1))) mark.textContent = String(digit);
      grid.append(mark);
    }
    return grid;
  }

  function render() {
    const n = state.n;
    const { box } = layoutOf(n);
    const playing = state.phase === "play";
    const show = settings.values.conflicts !== false;
    const broken = show ? findBroken(state.values, state.puzzle) : { cells: new Set(), cages: new Set() };
    const sel = state.selected;
    const selectedValue = sel >= 0 ? state.values[sel] : 0;
    let filled = 0;

    for (let i = 0; i < n * n; i++) {
      const button = cells[i];
      const value = state.values[i];
      const selected = i === sel;
      const same = Boolean(selectedValue) && !selected && value === selectedValue;
      const near = sel >= 0 && !selected && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || box(i) === box(sel));
      const bad = broken.cells.has(i);
      if (value) filled++;

      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-same", same);
      button.classList.toggle("is-peer", near && !same);
      button.classList.toggle("is-bad", bad);
      button.disabled = !playing;
      button.tabIndex = selected && playing ? 0 : -1;
      button.setAttribute("aria-selected", selected ? "true" : "false");

      const k = state.owner[i];
      const cage = k >= 0 ? state.puzzle.cages[k] : null;
      const where = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
      const cageText = cage ? `, cage of ${cage.cells.length} sums to ${cage.sum}` : "";
      let content = "empty";
      if (value) {
        valueEls[i].textContent = String(value);
        content = `${value}${bad ? ", conflicts" : ""}`;
      } else if (state.notes[i]) {
        valueEls[i].replaceChildren(notesElement(state.notes[i]));
        const marks = [];
        for (let digit = 1; digit <= n; digit++) if (state.notes[i] & (1 << (digit - 1))) marks.push(digit);
        content = `notes ${marks.join(" ")}`;
      } else {
        valueEls[i].textContent = "";
      }
      button.setAttribute("aria-label", `${where}${cageText}, ${content}`);
    }

    for (const [k, sum] of sumEls) sum.classList.toggle("is-bad", broken.cages.has(k));
    els.filled.textContent = `${filled}/${n * n}`;
  }

  function select(index) {
    if (state.phase !== "play") return;
    state.selected = index;
    render();
    cells[index].focus();
  }

  function clearPeerNotes(index, digit) {
    const bit = 1 << (digit - 1);
    const { peers } = layoutOf(state.n);
    for (const j of peers[index]) state.notes[j] &= ~bit;
    const k = state.owner[index];
    for (const j of state.puzzle.cages[k].cells) if (j !== index) state.notes[j] &= ~bit;
  }

  function enterDigit(digit) {
    if (state.phase !== "play" || state.selected < 0 || digit > state.n) return;
    const index = state.selected;

    if (state.notesMode) {
      if (state.values[index]) return;
      state.notes[index] ^= 1 << (digit - 1);
      render();
      return;
    }

    if (state.values[index] === digit) {
      state.values[index] = 0;
      render();
      return;
    }

    state.values[index] = digit;
    state.notes[index] = 0;
    clearPeerNotes(index, digit);
    render();
    if (isSolved(state.values, state.puzzle)) finish();
  }

  function clearCell() {
    if (state.phase !== "play" || state.selected < 0) return;
    state.values[state.selected] = 0;
    state.notes[state.selected] = 0;
    render();
  }

  function toggleNotes() {
    if (state.phase !== "play") return;
    state.notesMode = !state.notesMode;
    els.notes.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    setStatus(state.notesMode ? "Notes on. Digits toggle candidates." : "Notes off. Digits fill the cell.");
  }

  function move(dr, dc) {
    if (state.phase !== "play" || state.selected < 0) return;
    const n = state.n;
    const r = (rowOf(state.selected) + dr + n) % n;
    const c = (colOf(state.selected) + dc + n) % n;
    select(r * n + c);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function resetGrid(n, puzzle) {
    state.n = n;
    state.puzzle = puzzle;
    state.values = new Array(n * n).fill(0);
    state.notes = new Array(n * n).fill(0);
    state.selected = -1;
    state.notesMode = false;
    els.notes.setAttribute("aria-pressed", "false");
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    window.clearTimeout(state.clock);
    const n = sizeOf(settings.values.size);
    resetGrid(n, { n, cages: [] });
    state.elapsed = 0;
    els.time.textContent = "0:00";
    els.pad.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest(n);
    buildBoard();
    render();
    setStatus(`Rows, columns, boxes use 1–${n} once; cages add up. Next: ${n}×${n}.`);
  }

  function begin() {
    if (state.phase === "building") return;
    const n = sizeOf(settings.values.size);
    const token = ++state.token;
    state.phase = "building";
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.start.disabled = true;
    els.start.textContent = "Building…";
    els.summary.hidden = true;
    els.pad.hidden = true;
    showBest(n);
    setStatus(`Building a ${n}×${n} puzzle…`);

    window.setTimeout(() => {
      if (token !== state.token) return;
      const made = makePuzzle(n);
      if (token !== state.token) return;
      if (!made) {
        state.phase = "idle";
        els.start.disabled = false;
        els.start.textContent = "Try again";
        setStatus("Couldn't build a fair puzzle. Try again.", "bad");
        return;
      }
      state.phase = "play";
      resetGrid(n, { n, cages: made.cages });
      state.record = false;
      state.started = Date.now();
      state.elapsed = 0;
      state.selected = 0;
      buildBoard();
      els.pad.hidden = false;
      els.start.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New puzzle";
      setStatus("Pick a cell, then enter a digit. Cage sums sit in the corner.");
      render();
      cells[0].focus();
      tick();
    }, 30);
  }

  function finish() {
    state.phase = "done";
    window.clearTimeout(state.clock);
    state.elapsed = Date.now() - state.started;
    const previous = readBest(state.n);
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.n, state.elapsed);
    }
    const clock = formatTime(state.elapsed);
    els.time.textContent = clock;
    showBest(state.n);
    els.pad.hidden = true;
    els.start.hidden = true;
    els.summary.hidden = false;
    els.summaryText.textContent = state.record
      ? `Solved the ${state.n}×${state.n} killer in ${clock}. New best.`
      : `Solved the ${state.n}×${state.n} killer in ${clock}. Best is ${formatTime(readBest(state.n))}.`;
    setStatus("Solved.", "ok");
    state.selected = -1;
    render();
    els.again.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (state.phase !== "play") return;
    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      enterDigit(Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      clearCell();
      return;
    }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      move(moves[event.key][0], moves[event.key][1]);
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      toggleNotes();
    }
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearCell);
  els.notes.addEventListener("click", toggleNotes);
  document.addEventListener("keydown", onKey);
})();
