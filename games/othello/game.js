(() => {
  "use strict";

  /* ---------- Rules engine ----------
     Board: 64 squares, index = row * 8 + col, row 0 is row "1" (top).
     Values: 1 = black, -1 = white, 0 = empty. Black moves first. */

  const FILES = "abcdefgh";
  const BLACK = 1;
  const WHITE = -1;
  const PASS = -1;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const WEIGHTS = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -50, -2, -2, -2, -2, -50, -20,
    10, -2, 1, 1, 1, 1, -2, 10,
    5, -2, 1, 0, 0, 1, -2, 5,
    5, -2, 1, 0, 0, 1, -2, 5,
    10, -2, 1, 1, 1, 1, -2, 10,
    -20, -50, -2, -2, -2, -2, -50, -20,
    100, -20, 10, 5, 5, 10, -20, 100,
  ];
  const CORNERS = [0, 7, 56, 63];
  const NEAR = { 0: [1, 8, 9], 7: [6, 15, 14], 56: [57, 48, 49], 63: [62, 55, 54] };
  const ORDER = Array.from({ length: 64 }, (_, i) => i).sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);

  const RAYS = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const list = [];
    for (const [dr, dc] of DIRS) {
      const ray = [];
      let r = (sq >> 3) + dr;
      let c = (sq & 7) + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        ray.push(r * 8 + c);
        r += dr;
        c += dc;
      }
      if (ray.length >= 2) list.push(ray);
    }
    RAYS.push(list);
  }

  const nameOf = (sq) => FILES[sq & 7] + ((sq >> 3) + 1);
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function initial() {
    const b = new Array(64).fill(0);
    b[27] = WHITE;
    b[36] = WHITE;
    b[28] = BLACK;
    b[35] = BLACK;
    return { b, turn: BLACK };
  }

  function canPlay(b, sq, color) {
    if (b[sq]) return false;
    for (const ray of RAYS[sq]) {
      if (b[ray[0]] !== -color) continue;
      for (let i = 1; i < ray.length; i += 1) {
        const v = b[ray[i]];
        if (v === color) return true;
        if (v === 0) break;
      }
    }
    return false;
  }

  function flipsOf(b, sq, color) {
    const out = [];
    if (b[sq]) return out;
    for (const ray of RAYS[sq]) {
      if (b[ray[0]] !== -color) continue;
      for (let i = 1; i < ray.length; i += 1) {
        const v = b[ray[i]];
        if (v === color) {
          for (let j = 0; j < i; j += 1) out.push(ray[j]);
          break;
        }
        if (v === 0) break;
      }
    }
    return out;
  }

  function movesFor(b, color) {
    const out = [];
    for (const sq of ORDER) if (!b[sq] && canPlay(b, sq, color)) out.push(sq);
    return out;
  }

  function legalMoves(s) {
    return movesFor(s.b, s.turn);
  }

  function isOver(s) {
    return !movesFor(s.b, s.turn).length && !movesFor(s.b, -s.turn).length;
  }

  function apply(s, m) {
    if (m === PASS) return { b: s.b.slice(), turn: -s.turn };
    const flips = flipsOf(s.b, m, s.turn);
    if (!flips.length) throw new Error(`Illegal move ${nameOf(m)}`);
    const b = s.b.slice();
    b[m] = s.turn;
    for (const f of flips) b[f] = s.turn;
    return { b, turn: -s.turn };
  }

  function count(b) {
    let black = 0;
    let white = 0;
    for (const v of b) {
      if (v === BLACK) black += 1;
      else if (v === WHITE) white += 1;
    }
    return { black, white, empty: 64 - black - white };
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (!moves.length) {
      if (!movesFor(s.b, -s.turn).length) return 1;
      return perft(apply(s, PASS), depth - 1);
    }
    if (depth === 1) return moves.length;
    let total = 0;
    for (const m of moves) total += perft(apply(s, m), depth - 1);
    return total;
  }

  /* ---------- Computer player ---------- */

  const WIN = 100000;

  function finalScore(b, color) {
    let diff = 0;
    for (const v of b) diff += v;
    diff *= color;
    if (diff > 0) return WIN + diff;
    if (diff < 0) return -WIN + diff;
    return 0;
  }

  function evaluate(b, color, myMoves, theirMoves) {
    let pos = 0;
    let discs = 0;
    let empty = 0;
    for (let sq = 0; sq < 64; sq += 1) {
      const v = b[sq];
      if (!v) {
        empty += 1;
        continue;
      }
      pos += v === color ? WEIGHTS[sq] : -WEIGHTS[sq];
      discs += v === color ? 1 : -1;
    }
    let corners = 0;
    for (const c of CORNERS) {
      const owner = b[c];
      if (!owner) continue;
      corners += owner === color ? 1 : -1;
      for (const n of NEAR[c]) {
        const v = b[n];
        if (!v) continue;
        const fix = -WEIGHTS[n] + (v === owner ? 8 : 0);
        pos += v === color ? fix : -fix;
      }
    }
    const mobility = myMoves - theirMoves;
    return pos + corners * 30 + mobility * 8 + (empty <= 14 ? discs * 3 : 0);
  }

  function negamax(b, color, depth, alpha, beta, ctx) {
    ctx.nodes += 1;
    if ((ctx.nodes & 1023) === 0 && now() > ctx.deadline) ctx.stop = true;
    if (ctx.stop) return 0;
    const moves = movesFor(b, color);
    if (!moves.length) {
      if (!movesFor(b, -color).length) return finalScore(b, color);
      return -negamax(b, -color, depth, -beta, -alpha, ctx);
    }
    if (depth <= 0) return evaluate(b, color, moves.length, movesFor(b, -color).length);
    let best = -Infinity;
    for (const m of moves) {
      const flips = flipsOf(b, m, color);
      b[m] = color;
      for (const f of flips) b[f] = color;
      const score = -negamax(b, -color, depth - 1, -beta, -alpha, ctx);
      b[m] = 0;
      for (const f of flips) b[f] = -color;
      if (ctx.stop) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  const LEVELS = {
    easy: { depth: 1, noise: 60, time: 300, endgame: 0 },
    medium: { depth: 3, noise: 0, time: 600, endgame: 0 },
    hard: { depth: 5, noise: 0, time: 900, endgame: 12 },
  };

  function chooseMove(s, level) {
    const moves = legalMoves(s);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const { depth, noise, time, endgame } = LEVELS[level] || LEVELS.medium;
    const empties = count(s.b).empty;
    const maxDepth = endgame && empties <= endgame ? Math.max(depth, empties) : depth;
    const ctx = { nodes: 0, stop: false, deadline: now() + time };
    const b = s.b.slice();
    const color = s.turn;
    let order = moves;
    let best = moves[0];
    for (let d = 1; d <= maxDepth; d += 1) {
      const scored = [];
      let alpha = -Infinity;
      for (const m of order) {
        const flips = flipsOf(b, m, color);
        b[m] = color;
        for (const f of flips) b[f] = color;
        const beta = noise > 0 ? Infinity : -alpha;
        let score = -negamax(b, -color, d - 1, -Infinity, beta, ctx);
        b[m] = 0;
        for (const f of flips) b[f] = -color;
        if (ctx.stop) break;
        if (noise > 0) score += Math.random() * noise;
        scored.push({ m, score });
        if (score > alpha) alpha = score;
      }
      if (ctx.stop) break;
      scored.sort((x, y) => y.score - x.score);
      order = scored.map((x) => x.m);
      best = order[0];
      if (Math.abs(scored[0].score) >= WIN) break;
    }
    return best;
  }

  if (typeof document === "undefined") {
    globalThis.__othello = {
      BLACK, WHITE, PASS, initial, legalMoves, flipsOf, apply, isOver, count, perft, chooseMove, evaluate, nameOf,
    };
    return;
  }

  /* ---------- Game ---------- */

  const BEST_PREFIX = "mental-game.othello.best";
  const PASS_DELAY = 1400;

  const settings = GameSettings.mount({
    id: "othello",
    fields: [
      {
        id: "level",
        label: "Computer level",
        hint: "How far ahead the computer looks. Applies to the next game.",
        type: "choice",
        default: "medium",
        options: [
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ],
      },
      {
        id: "color",
        label: "Your color",
        hint: "Black moves first. Applies to the next game.",
        type: "choice",
        default: "black",
        options: [
          { value: "black", label: "Black" },
          { value: "white", label: "White" },
        ],
      },
      {
        id: "hints",
        label: "Show legal moves",
        hint: "Mark every square where you can place a disc.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") {
        state.player = color();
        setIdleStatus();
      }
      render();
    },
  });

  const els = {
    black: document.getElementById("black"),
    white: document.getElementById("white"),
    blackLabel: document.getElementById("black-label"),
    whiteLabel: document.getElementById("white-label"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    summaryTitle: document.getElementById("summary-title"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    board: document.getElementById("board"),
    start: document.getElementById("start-btn"),
    undo: document.getElementById("undo-btn"),
    resign: document.getElementById("resign-btn"),
  };

  const state = {
    phase: "idle",
    pos: initial(),
    player: BLACK,
    level: "medium",
    stack: [],
    legal: [],
    last: -1,
    anim: null,
    notice: null,
    thinking: false,
    passing: null,
    undos: 0,
    token: 0,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  function color() {
    return settings.values.color === "white" ? WHITE : BLACK;
  }

  function level() {
    const value = settings.values.level;
    return LEVELS[value] ? value : "medium";
  }

  function hints() {
    return settings.values.hints !== false;
  }

  const colorName = (c) => (c === BLACK ? "black" : "white");

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function readBest(key) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${key}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(key, margin) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${key}`, String(margin));
    } catch {
      /* storage blocked — this game still finishes */
    }
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", tone === "ok");
    els.status.classList.toggle("is-bad", tone === "bad");
  }

  function setIdleStatus() {
    setStatus(`Press Start. You play ${colorName(color())} against the computer (${level()}). Black moves first.`);
  }

  function paintHud() {
    const c = count(state.pos.b);
    els.black.textContent = String(c.black);
    els.white.textContent = String(c.white);
    const you = state.phase === "idle" ? color() : state.player;
    els.blackLabel.textContent = you === BLACK ? "Black · you" : "Black";
    els.whiteLabel.textContent = you === WHITE ? "White · you" : "White";
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.phase === "idle" ? level() : state.level);
    els.best.textContent = best ? `+${best}` : "—";
  }

  function canUndo() {
    return (
      state.phase === "play" &&
      !state.thinking &&
      state.stack.some((entry) => entry.before.turn === state.player && entry.move !== PASS)
    );
  }

  function render() {
    const focused = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.sq
      : undefined;

    const playing = state.phase === "play";
    const yourTurn = playing && !state.thinking && !state.passing && state.pos.turn === state.player;
    const targets = new Set(yourTurn && hints() ? state.legal : []);
    const anim = state.anim;
    state.anim = null;

    let html = "";
    for (let sq = 0; sq < 64; sq += 1) {
      const v = state.pos.b[sq];
      const r = sq >> 3;
      const c = sq & 7;
      const classes = ["sq"];
      if (state.last === sq) classes.push("is-last");
      if (targets.has(sq)) classes.push("is-target");
      let label = `${nameOf(sq)}, `;
      if (v) label += `${colorName(v)} disc`;
      else label += targets.has(sq) ? "empty, legal move" : "empty";
      if (state.last === sq) label += ", last move";
      const rank = c === 0 ? `<span class="coord coord--rank" aria-hidden="true">${r + 1}</span>` : "";
      const file = r === 7 ? `<span class="coord coord--file" aria-hidden="true">${FILES[c]}</span>` : "";
      let disc = "";
      if (v) {
        let motion = "";
        if (anim && anim.placed === sq) motion = " is-placed";
        else if (anim && anim.flipped.has(sq)) motion = " is-flipping";
        disc = `<span class="disc disc--${v === BLACK ? "b" : "w"}${motion}" aria-hidden="true"></span>`;
      }
      html += `<button class="${classes.join(" ")}" type="button" data-sq="${sq}" aria-label="${label}">${rank}${file}${disc}</button>`;
    }
    els.board.innerHTML = html;
    if (focused !== undefined) {
      const again = els.board.querySelector(`[data-sq="${focused}"]`);
      if (again) again.focus();
    }

    els.start.hidden = playing;
    els.undo.hidden = !playing;
    els.resign.hidden = !playing;
    els.undo.disabled = !canUndo();
    els.board.classList.toggle("is-idle", state.phase === "idle");

    if (playing) {
      if (state.thinking) setStatus("Computer is thinking…");
      else if (state.passing === "player") setStatus("You have no move, passing…", "bad");
      else if (state.passing === "computer") setStatus("No move — the computer passed.");
      else if (state.notice && state.notice.tone === "bad") setStatus(state.notice.text, "bad");
      else setStatus(state.notice ? `${state.notice.text} Your move.` : "Your move.");
    }
    paintHud();
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = performance.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 500);
  }

  function begin() {
    window.clearTimeout(state.clock);
    state.token += 1;
    state.player = color();
    state.level = level();
    state.pos = initial();
    state.stack = [];
    state.last = -1;
    state.anim = null;
    state.notice = null;
    state.thinking = false;
    state.passing = null;
    state.undos = 0;
    state.record = false;
    state.elapsed = 0;
    state.started = performance.now();
    state.phase = "play";
    els.summary.hidden = true;
    state.clock = window.setTimeout(tick, 500);
    advance();
  }

  function advance() {
    state.legal = legalMoves(state.pos);
    if (!state.legal.length) {
      if (isOver(state.pos)) {
        finish({ kind: "over" });
        return;
      }
      const mine = state.pos.turn === state.player;
      state.passing = mine ? "player" : "computer";
      const token = (state.token += 1);
      render();
      window.setTimeout(() => {
        if (token !== state.token || state.phase !== "play") return;
        state.stack.push({ before: state.pos, move: PASS });
        state.pos = apply(state.pos, PASS);
        state.passing = null;
        state.notice = mine ? null : { text: "The computer had no move and passed." };
        advance();
      }, PASS_DELAY);
      return;
    }
    if (state.pos.turn !== state.player) think();
    else render();
  }

  function think() {
    state.thinking = true;
    const token = (state.token += 1);
    render();
    window.setTimeout(() => {
      if (token !== state.token || state.phase !== "play") return;
      const move = chooseMove(state.pos, state.level);
      state.thinking = false;
      if (move !== null) playMove(move);
      else advance();
    }, 300);
  }

  function playMove(m) {
    const flips = flipsOf(state.pos.b, m, state.pos.turn);
    state.stack.push({ before: state.pos, move: m });
    state.pos = apply(state.pos, m);
    state.last = m;
    state.anim = { placed: m, flipped: new Set(flips) };
    state.notice = null;
    advance();
  }

  function finish(end) {
    window.clearTimeout(state.clock);
    state.token += 1;
    state.thinking = false;
    state.passing = null;
    state.elapsed = performance.now() - state.started;
    state.phase = "over";

    const c = count(state.pos.b);
    const mine = state.player === BLACK ? c.black : c.white;
    const theirs = state.player === BLACK ? c.white : c.black;
    const score = `${mine}–${theirs}`;
    let title = "Draw";
    let text = `Both sides finished with ${mine} discs.`;
    let won = false;
    if (end.kind === "resign") {
      title = "Resigned";
      text = "You resigned this game.";
    } else if (mine > theirs) {
      won = true;
      title = "You win";
      const margin = mine - theirs;
      const previous = readBest(state.level);
      if (state.undos > 0) {
        text = `You won ${score}. Undo was used, so no best was recorded.`;
      } else {
        if (margin > previous) {
          state.record = true;
          writeBest(state.level, margin);
        }
        text = state.record
          ? `You won ${score}, a margin of ${margin}. New best.`
          : `You won ${score}, a margin of ${margin}. Best is +${previous}.`;
      }
    } else if (mine < theirs) {
      title = "You lose";
      text = `The computer won ${theirs}–${mine}.`;
    }

    els.summaryTitle.textContent = title;
    els.summaryText.textContent = `${text} Time ${formatTime(state.elapsed)}.`;
    els.summary.hidden = false;
    setStatus(title, won ? "ok" : undefined);
    render();
    els.again.focus();
  }

  function undo() {
    if (!canUndo()) return;
    state.token += 1;
    let popped;
    do {
      popped = state.stack.pop();
    } while (popped.before.turn !== state.player || popped.move === PASS);
    state.pos = popped.before;
    const last = [...state.stack].reverse().find((entry) => entry.move !== PASS);
    state.last = last ? last.move : -1;
    state.legal = legalMoves(state.pos);
    state.anim = null;
    state.notice = null;
    state.passing = null;
    state.undos += 1;
    render();
  }

  function onSquare(sq) {
    if (state.phase !== "play" || state.thinking || state.passing || state.pos.turn !== state.player) return;
    if (state.legal.includes(sq)) {
      playMove(sq);
      return;
    }
    state.notice = { text: `${nameOf(sq)} does not trap any disc. Try another square.`, tone: "bad" };
    render();
  }

  els.board.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sq]");
    if (button) onSquare(Number(button.dataset.sq));
  });

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.undo.addEventListener("click", undo);
  els.resign.addEventListener("click", () => {
    if (state.phase === "play") finish({ kind: "resign" });
  });

  state.player = color();
  setIdleStatus();
  render();
})();
