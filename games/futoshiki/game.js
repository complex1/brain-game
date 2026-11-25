(() => {
  "use strict";

  const BEST_PREFIX = "mental-game.futoshiki.best";
  const SIZES = [4, 5, 6, 7];
  const NODE_LIMIT = 40000;

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

  function highBit(mask) {
    return 1 << (31 - Math.clz32(mask));
  }

  function digitOf(bit) {
    return 32 - Math.clz32(bit);
  }

  /* h[r*(n-1)+c] sits between (r,c) and (r,c+1); v[r*n+c] between (r,c) and (r+1,c).
     1 means the first cell is smaller, 2 means it is larger, 0 means no sign. */
  function relationsOf(puzzle) {
    const { n, h, v } = puzzle;
    const list = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) {
        const k = r * (n - 1) + c;
        const a = r * n + c;
        if (h[k] === 1) list.push({ key: `h${k}`, small: a, big: a + 1 });
        else if (h[k] === 2) list.push({ key: `h${k}`, small: a + 1, big: a });
      }
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n; c++) {
        const k = r * n + c;
        if (v[k] === 1) list.push({ key: `v${k}`, small: k, big: k + n });
        else if (v[k] === 2) list.push({ key: `v${k}`, small: k + n, big: k });
      }
    }
    return list;
  }

  const layouts = new Map();

  function layoutOf(n) {
    if (layouts.has(n)) return layouts.get(n);
    const units = [];
    for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
    const peers = Array.from({ length: n * n }, (_, i) => {
      const r = (i / n) | 0;
      const c = i % n;
      const list = [];
      for (let k = 0; k < n; k++) {
        if (k !== c) list.push(r * n + k);
        if (k !== r) list.push(k * n + c);
      }
      return list;
    });
    const layout = { units, peers, full: (1 << n) - 1 };
    layouts.set(n, layout);
    return layout;
  }

  function solve(puzzle, limit, nodeLimit) {
    const n = puzzle.n;
    const size = n * n;
    const { units, peers, full } = layoutOf(n);
    const rels = relationsOf(puzzle);
    const start = new Uint8Array(size).fill(full);
    for (let i = 0; i < size; i++) if (puzzle.givens[i]) start[i] = 1 << (puzzle.givens[i] - 1);
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
          for (const p of peers[i]) {
            if (!(dom[p] & mask)) continue;
            dom[p] &= ~mask;
            if (!dom[p]) return false;
            changed = true;
          }
        }
        for (const rel of rels) {
          const cap = highBit(dom[rel.big]) - 1;
          if (dom[rel.small] & ~cap) {
            dom[rel.small] &= cap;
            if (!dom[rel.small]) return false;
            changed = true;
          }
          const low = dom[rel.small] & -dom[rel.small];
          const floor = ~((low << 1) - 1);
          if (dom[rel.big] & ~floor) {
            dom[rel.big] &= floor;
            if (!dom[rel.big]) return false;
            changed = true;
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

  function latinSquare(n) {
    const grid = new Array(n * n).fill(0);
    const rows = new Array(n).fill(0);
    const cols = new Array(n).fill(0);
    const digits = Array.from({ length: n }, (_, i) => i + 1);

    function fill(i) {
      if (i === n * n) return true;
      const r = (i / n) | 0;
      const c = i % n;
      for (const digit of shuffle(digits.slice())) {
        const bit = 1 << (digit - 1);
        if ((rows[r] | cols[c]) & bit) continue;
        grid[i] = digit;
        rows[r] |= bit;
        cols[c] |= bit;
        if (fill(i + 1)) return true;
        rows[r] ^= bit;
        cols[c] ^= bit;
      }
      grid[i] = 0;
      return false;
    }

    fill(0);
    return grid;
  }

  function signFor(solution, first, second) {
    return solution[first] < solution[second] ? 1 : 2;
  }

  /* Adds one clue that the alternative solution breaks, so it can never come back. */
  function tighten(puzzle, solution, other) {
    const n = puzzle.n;
    const differ = [];
    for (let i = 0; i < n * n; i++) if (solution[i] !== other[i]) differ.push(i);
    const x = differ[Math.floor(Math.random() * differ.length)];
    const r = (x / n) | 0;
    const c = x % n;
    const options = [];
    const consider = (list, k, first, second) => {
      if (list[k]) return;
      if (signFor(solution, first, second) !== signFor(other, first, second)) options.push([list, k, first, second]);
    };
    if (c > 0) consider(puzzle.h, r * (n - 1) + c - 1, x - 1, x);
    if (c < n - 1) consider(puzzle.h, r * (n - 1) + c, x, x + 1);
    if (r > 0) consider(puzzle.v, x - n, x - n, x);
    if (r < n - 1) consider(puzzle.v, x, x, x + n);
    if (options.length && Math.random() < 0.85) {
      const [list, k, first, second] = options[Math.floor(Math.random() * options.length)];
      list[k] = signFor(solution, first, second);
    } else {
      puzzle.givens[x] = solution[x];
    }
  }

  function unique(puzzle) {
    const result = solve(puzzle, 2, NODE_LIMIT);
    return !result.aborted && result.count === 1;
  }

  function prune(list, deadline, puzzle) {
    for (const k of shuffle([...list.keys()])) {
      if (Date.now() > deadline) return;
      if (!list[k]) continue;
      const kept = list[k];
      list[k] = 0;
      if (!unique(puzzle)) list[k] = kept;
    }
  }

  function makePuzzle(n, budget = 3500) {
    const size = SIZES.includes(n) ? n : 5;
    const deadline = Date.now() + budget;
    while (Date.now() < deadline) {
      const solution = latinSquare(size);
      const puzzle = {
        n: size,
        givens: new Array(size * size).fill(0),
        h: new Array(size * (size - 1)).fill(0),
        v: new Array(size * (size - 1)).fill(0),
      };
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const i = r * size + c;
          if (c < size - 1 && Math.random() < 0.3) puzzle.h[r * (size - 1) + c] = signFor(solution, i, i + 1);
          if (r < size - 1 && Math.random() < 0.3) puzzle.v[i] = signFor(solution, i, i + size);
        }
      }
      for (const i of shuffle([...Array(size * size).keys()]).slice(0, Math.max(1, size - 3))) {
        puzzle.givens[i] = solution[i];
      }

      let ok = false;
      for (let guard = 0; guard < size * size * 4 && Date.now() < deadline; guard++) {
        const result = solve(puzzle, 2, NODE_LIMIT);
        if (result.aborted) break;
        if (result.count === 1) {
          ok = true;
          break;
        }
        const other = result.solutions.find((grid) => grid.some((digit, i) => digit !== solution[i]));
        tighten(puzzle, solution, other);
      }
      if (!ok) continue;

      prune(puzzle.givens, deadline, puzzle);
      prune(puzzle.h, deadline, puzzle);
      prune(puzzle.v, deadline, puzzle);
      return { ...puzzle, solution };
    }
    return null;
  }

  function findBroken(values, puzzle) {
    const n = puzzle.n;
    const cells = new Set();
    const signs = new Set();
    for (const unit of layoutOf(n).units) {
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
    for (const rel of relationsOf(puzzle)) {
      const small = values[rel.small];
      const big = values[rel.big];
      if (small && big && small >= big) {
        signs.add(rel.key);
        cells.add(rel.small);
        cells.add(rel.big);
      }
    }
    return { cells, signs };
  }

  function isSolved(values, puzzle) {
    const n = puzzle.n;
    for (let i = 0; i < n * n; i++) {
      if (!(values[i] >= 1 && values[i] <= n)) return false;
      if (puzzle.givens[i] && values[i] !== puzzle.givens[i]) return false;
    }
    const broken = findBroken(values, puzzle);
    return broken.cells.size === 0 && broken.signs.size === 0;
  }

  if (typeof document === "undefined") {
    globalThis.__futoshiki = { makePuzzle, countSolutions, isSolved, findBroken, relationsOf, latinSquare };
    return;
  }

  const settings = GameSettings.mount({
    id: "futoshiki",
    fields: [
      {
        id: "size",
        label: "Size",
        hint: "Applies to the next puzzle.",
        type: "choice",
        default: "5",
        options: SIZES.map((n) => ({ value: String(n), label: `${n}×${n}` })),
      },
      {
        id: "conflicts",
        label: "Conflicts",
        hint: "Mark repeated digits and signs the current digits break.",
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
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };

  const state = {
    phase: "idle",
    token: 0,
    n: 5,
    puzzle: null,
    values: [],
    selected: -1,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
  };

  const cells = [];
  const signs = new Map();

  function sizeOf(value) {
    const n = Number(value);
    return SIZES.includes(n) ? n : 5;
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

  function emptyPuzzle(n) {
    return {
      n,
      givens: new Array(n * n).fill(0),
      h: new Array(n * (n - 1)).fill(0),
      v: new Array(n * (n - 1)).fill(0),
    };
  }

  function signText(list, value) {
    if (!value) return "";
    if (list === "h") return value === 1 ? "<" : ">";
    return value === 1 ? "∧" : "∨";
  }

  function describe(i) {
    const { n, h, v } = state.puzzle;
    const r = (i / n) | 0;
    const c = i % n;
    const parts = [];
    const add = (value, mineFirst, side) => {
      if (!value) return;
      const smaller = (value === 1) === mineFirst;
      parts.push(`${smaller ? "less" : "greater"} than ${side}`);
    };
    if (c > 0) add(h[r * (n - 1) + c - 1], false, "left");
    if (c < n - 1) add(h[r * (n - 1) + c], true, "right");
    if (r > 0) add(v[i - n], false, "above");
    if (r < n - 1) add(v[i], true, "below");
    return parts.length ? `, ${parts.join(", ")}` : "";
  }

  function buildBoard(n) {
    const puzzle = state.puzzle;
    els.board.replaceChildren();
    els.board.style.setProperty("--n", String(n));
    els.board.style.gridTemplateColumns = `repeat(${n - 1}, minmax(0, 1fr) var(--gap)) minmax(0, 1fr)`;
    els.board.style.gridTemplateRows = `repeat(${n - 1}, auto var(--gap)) auto`;
    cells.length = 0;
    signs.clear();
    const span = n * 2 - 1;
    for (let gr = 0; gr < span; gr++) {
      for (let gc = 0; gc < span; gc++) {
        if (gr % 2 === 0 && gc % 2 === 0) {
          const index = (gr / 2) * n + gc / 2;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cell";
          button.addEventListener("click", () => select(index));
          cells.push(button);
          els.board.append(button);
        } else if (gr % 2 === 0 || gc % 2 === 0) {
          const horizontal = gr % 2 === 0;
          const r = horizontal ? gr / 2 : (gr - 1) / 2;
          const c = horizontal ? (gc - 1) / 2 : gc / 2;
          const k = horizontal ? r * (n - 1) + c : r * n + c;
          const list = horizontal ? "h" : "v";
          const sign = document.createElement("span");
          sign.className = `sign sign--${list}`;
          sign.setAttribute("aria-hidden", "true");
          sign.textContent = signText(list, puzzle[list][k]);
          signs.set(`${list}${k}`, sign);
          els.board.append(sign);
        } else {
          const gap = document.createElement("span");
          gap.setAttribute("aria-hidden", "true");
          els.board.append(gap);
        }
      }
    }

    els.padNums.replaceChildren();
    els.padNums.style.setProperty("--n", String(n));
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

  function render() {
    const n = state.n;
    const puzzle = state.puzzle;
    const playing = state.phase === "play";
    const show = settings.values.conflicts !== false;
    const broken = show ? findBroken(state.values, puzzle) : { cells: new Set(), signs: new Set() };
    const sel = state.selected;
    const selectedValue = sel >= 0 ? state.values[sel] : 0;
    let filled = 0;

    for (let i = 0; i < n * n; i++) {
      const button = cells[i];
      const value = state.values[i];
      const given = puzzle.givens[i] !== 0;
      const selected = i === sel;
      const same = Boolean(selectedValue) && !selected && value === selectedValue;
      const near = sel >= 0 && !selected && (((i / n) | 0) === ((sel / n) | 0) || i % n === sel % n);
      if (value) filled++;

      button.classList.toggle("is-given", given);
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-same", same);
      button.classList.toggle("is-peer", near && !same);
      button.classList.toggle("is-bad", broken.cells.has(i));
      button.disabled = !playing;
      button.tabIndex = selected && playing ? 0 : -1;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.textContent = value ? String(value) : "";

      const where = `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}`;
      const content = value ? `${given ? "given" : "entered"} ${value}` : "empty";
      const bad = broken.cells.has(i) ? ", conflicts" : "";
      button.setAttribute("aria-label", `${where}, ${content}${bad}${describe(i)}`);
    }

    for (const [key, sign] of signs) sign.classList.toggle("is-bad", broken.signs.has(key));
    els.filled.textContent = `${filled}/${n * n}`;
  }

  function select(index) {
    if (state.phase !== "play") return;
    state.selected = index;
    render();
    cells[index].focus();
  }

  function enterDigit(digit) {
    if (state.phase !== "play" || state.selected < 0 || digit > state.n) return;
    const index = state.selected;
    if (state.puzzle.givens[index]) return;
    state.values[index] = state.values[index] === digit ? 0 : digit;
    render();
    if (isSolved(state.values, state.puzzle)) finish();
  }

  function clearCell() {
    if (state.phase !== "play" || state.selected < 0) return;
    if (state.puzzle.givens[state.selected]) return;
    state.values[state.selected] = 0;
    render();
  }

  function move(dr, dc) {
    if (state.phase !== "play" || state.selected < 0) return;
    const n = state.n;
    const r = (((state.selected / n) | 0) + dr + n) % n;
    const c = ((state.selected % n) + dc + n) % n;
    select(r * n + c);
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 250);
  }

  function showIdle() {
    state.phase = "idle";
    state.token += 1;
    state.n = sizeOf(settings.values.size);
    state.puzzle = emptyPuzzle(state.n);
    state.values = new Array(state.n * state.n).fill(0);
    state.selected = -1;
    state.elapsed = 0;
    window.clearTimeout(state.clock);
    els.time.textContent = "0:00";
    els.pad.hidden = true;
    els.summary.hidden = true;
    els.start.hidden = false;
    els.start.disabled = false;
    els.start.textContent = "Start";
    showBest(state.n);
    buildBoard(state.n);
    render();
    setStatus(`Each row and column uses 1–${state.n} once. Next puzzle: ${state.n}×${state.n}.`);
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
      state.n = n;
      state.puzzle = { n, givens: made.givens, h: made.h, v: made.v };
      state.values = made.givens.slice();
      state.record = false;
      state.started = Date.now();
      state.elapsed = 0;
      state.selected = state.values.findIndex((value) => value === 0);
      buildBoard(n);
      els.pad.hidden = false;
      els.start.hidden = false;
      els.start.disabled = false;
      els.start.textContent = "New puzzle";
      setStatus("Pick a cell, then enter a digit. Signs point to the smaller number.");
      render();
      if (state.selected >= 0) cells[state.selected].focus();
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
      ? `Solved the ${state.n}×${state.n} grid in ${clock}. New best.`
      : `Solved the ${state.n}×${state.n} grid in ${clock}. Best is ${formatTime(readBest(state.n))}.`;
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
    }
  }

  showIdle();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", clearCell);
  document.addEventListener("keydown", onKey);
})();
