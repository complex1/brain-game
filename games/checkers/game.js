(() => {
  "use strict";

  /* ---------- Rules engine (English / American draughts) ----------
     Board: 64 squares, index = row * 8 + col, row 0 at the top. Only dark squares
     ((row + col) odd) are used. Values: 1 = first-side man, 2 = first-side king,
     -1 / -2 = second side. The first side starts on rows 5–7 and moves up.
     A move is { from, path: [landing squares], caps: [captured squares], promote }. */

  const FILES = "abcdefgh";
  const FIRST = 1;
  const SECOND = -1;
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const QUIET_LIMIT = 80;

  const STEP = [];
  const JUMP = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const r = sq >> 3;
    const c = sq & 7;
    STEP.push(DIAG.map(([dr, dc]) => (inside(r + dr, c + dc) ? (r + dr) * 8 + c + dc : -1)));
    JUMP.push(DIAG.map(([dr, dc]) => (inside(r + 2 * dr, c + 2 * dc) ? (r + 2 * dr) * 8 + c + 2 * dc : -1)));
  }

  function inside(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  const isDark = (sq) => (((sq >> 3) + (sq & 7)) & 1) === 1;
  const nameOf = (sq) => FILES[sq & 7] + (8 - (sq >> 3));
  const farRow = (side) => (side === FIRST ? 0 : 7);
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function initial() {
    const b = new Array(64).fill(0);
    for (let sq = 0; sq < 64; sq += 1) {
      if (!isDark(sq)) continue;
      const r = sq >> 3;
      if (r <= 2) b[sq] = SECOND;
      else if (r >= 5) b[sq] = FIRST;
    }
    return { b, turn: FIRST, quiet: 0 };
  }

  function allowed(piece, d) {
    if (piece === 2 || piece === -2) return true;
    return piece > 0 ? d < 2 : d >= 2;
  }

  function jumpsFrom(b, from, out) {
    const piece = b[from];
    const side = piece > 0 ? FIRST : SECOND;
    const king = piece === 2 || piece === -2;
    const path = [];
    const caps = [];
    b[from] = 0;
    const dfs = (sq) => {
      let extended = false;
      for (let d = 0; d < 4; d += 1) {
        if (!allowed(piece, d)) continue;
        const land = JUMP[sq][d];
        if (land < 0 || b[land] !== 0) continue;
        const mid = STEP[sq][d];
        const v = b[mid];
        if (v === 0 || (v > 0) === (side > 0)) continue;
        extended = true;
        b[mid] = 0;
        path.push(land);
        caps.push(mid);
        if (!king && land >> 3 === farRow(side)) {
          out.push({ from, path: path.slice(), caps: caps.slice(), promote: true });
        } else {
          dfs(land);
        }
        path.pop();
        caps.pop();
        b[mid] = v;
      }
      if (!extended && path.length) out.push({ from, path: path.slice(), caps: caps.slice(), promote: false });
    };
    dfs(from);
    b[from] = piece;
  }

  function legalMoves(s) {
    const b = s.b;
    const side = s.turn;
    const jumps = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const v = b[sq];
      if (v !== 0 && (v > 0) === (side > 0)) jumpsFrom(b, sq, jumps);
    }
    if (jumps.length) return jumps;
    const out = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const v = b[sq];
      if (v === 0 || (v > 0) !== (side > 0)) continue;
      const king = v === 2 || v === -2;
      for (let d = 0; d < 4; d += 1) {
        if (!allowed(v, d)) continue;
        const to = STEP[sq][d];
        if (to < 0 || b[to] !== 0) continue;
        out.push({ from: sq, path: [to], caps: [], promote: !king && to >> 3 === farRow(side) });
      }
    }
    return out;
  }

  function apply(s, m) {
    const b = s.b.slice();
    const piece = b[m.from];
    b[m.from] = 0;
    for (const c of m.caps) b[c] = 0;
    b[m.path[m.path.length - 1]] = m.promote ? piece * 2 : piece;
    const man = piece === 1 || piece === -1;
    return { b, turn: -s.turn, quiet: m.caps.length || man ? 0 : s.quiet + 1 };
  }

  function keyOf(s) {
    return `${s.b.join(",")}|${s.turn}`;
  }

  function count(b, side) {
    let n = 0;
    for (const v of b) if (v !== 0 && (v > 0) === (side > 0)) n += 1;
    return n;
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let total = 0;
    for (const m of moves) total += perft(apply(s, m), depth - 1);
    return total;
  }

  function moveText(m) {
    return [m.from, ...m.path].map(nameOf).join(m.caps.length ? "x" : "-");
  }

  /* ---------- Computer player ---------- */

  const WIN = 100000;
  const MAN = 100;
  const KING = 175;
  const BACK_FIRST = [56, 58, 60, 62];
  const BACK_SECOND = [1, 3, 5, 7];

  function evaluate(s) {
    const b = s.b;
    let score = 0;
    let firstMen = 0;
    let secondMen = 0;
    let firstMat = 0;
    let secondMat = 0;
    const kings = [];
    const pieces = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const v = b[sq];
      if (v === 0) continue;
      const side = v > 0 ? 1 : -1;
      const r = sq >> 3;
      const c = sq & 7;
      let val;
      if (v === 1 || v === -1) {
        const adv = side === 1 ? 7 - r : r;
        val = MAN + adv * 4;
        if (side === 1) firstMen += 1;
        else secondMen += 1;
      } else {
        val = KING;
        kings.push(sq);
      }
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) val += r >= 3 && r <= 4 ? 8 : 3;
      if (side === 1) firstMat += v === 1 ? MAN : KING;
      else secondMat += v === -1 ? MAN : KING;
      pieces.push(sq);
      score += side * val;
    }
    for (const sq of BACK_FIRST) if (b[sq] === 1 && secondMen) score += 12;
    for (const sq of BACK_SECOND) if (b[sq] === -1 && firstMen) score -= 12;
    if (pieces.length <= 10 && firstMat !== secondMat) {
      const leader = firstMat > secondMat ? 1 : -1;
      let pull = 0;
      for (const k of kings) {
        if ((b[k] > 0 ? 1 : -1) !== leader) continue;
        let nearest = 14;
        for (const p of pieces) {
          if ((b[p] > 0 ? 1 : -1) === leader) continue;
          const d = Math.max(Math.abs((k >> 3) - (p >> 3)), Math.abs((k & 7) - (p & 7)));
          if (d < nearest) nearest = d;
        }
        pull += nearest;
      }
      score -= leader * pull * 3;
    }
    return s.turn === 1 ? score : -score;
  }

  function orderMoves(moves) {
    if (moves.length < 2) return moves;
    return moves
      .map((m) => ({ m, v: m.caps.length * 10 + (m.promote ? 5 : 0) }))
      .sort((x, y) => y.v - x.v)
      .map((x) => x.m);
  }

  function negamax(s, depth, alpha, beta, ply, ctx) {
    ctx.nodes += 1;
    if ((ctx.nodes & 1023) === 0 && now() > ctx.deadline) ctx.stop = true;
    if (ctx.stop) return 0;
    if (s.quiet >= QUIET_LIMIT) return 0;
    const moves = legalMoves(s);
    if (!moves.length) return -WIN + ply;
    const capturing = moves[0].caps.length > 0;
    if (depth <= 0 && (!capturing || ply >= 48)) return evaluate(s);
    let best = -Infinity;
    for (const m of orderMoves(moves)) {
      const score = -negamax(apply(s, m), depth - 1, -beta, -alpha, ply + 1, ctx);
      if (ctx.stop) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  const LEVELS = {
    easy: { depth: 2, noise: 90, time: 300 },
    medium: { depth: 5, noise: 0, time: 700 },
    hard: { depth: 8, noise: 0, time: 850 },
  };

  function chooseMove(s, level) {
    const moves = legalMoves(s);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const { depth, noise, time } = LEVELS[level] || LEVELS.medium;
    const ctx = { nodes: 0, stop: false, deadline: now() + time };
    let order = orderMoves(moves);
    let best = order[0];
    for (let d = 1; d <= depth; d += 1) {
      const scored = [];
      let alpha = -Infinity;
      for (const m of order) {
        const beta = noise > 0 ? Infinity : -alpha;
        let score = -negamax(apply(s, m), d - 1, -Infinity, beta, 1, ctx);
        if (ctx.stop) break;
        if (noise > 0) score += Math.random() * noise;
        scored.push({ m, score });
        if (score > alpha) alpha = score;
      }
      if (ctx.stop) break;
      scored.sort((x, y) => y.score - x.score);
      order = scored.map((x) => x.m);
      best = order[0];
      if (scored[0].score >= WIN - 100) break;
    }
    return best;
  }

  if (typeof document === "undefined") {
    globalThis.__checkers = {
      FIRST, SECOND, QUIET_LIMIT, initial, legalMoves, apply, perft, keyOf, count, chooseMove, evaluate, moveText, nameOf, isDark,
    };
    return;
  }

  /* ---------- Game ---------- */

  const BEST_PREFIX = "mental-game.checkers.best";
  const CROWN = "\u265B\uFE0E";

  const settings = GameSettings.mount({
    id: "checkers",
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
        id: "side",
        label: "Your color",
        hint: "Cyan moves first. Applies to the next game.",
        type: "choice",
        default: "first",
        options: [
          { value: "first", label: "Cyan (first)" },
          { value: "second", label: "Violet (second)" },
        ],
      },
      {
        id: "hints",
        label: "Show legal moves",
        hint: "Mark where the selected piece can land, and which pieces can capture when a jump is required.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") {
        state.player = side();
        setIdleStatus();
      }
      render();
    },
  });

  const els = {
    mine: document.getElementById("mine"),
    theirs: document.getElementById("theirs"),
    moves: document.getElementById("moves"),
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
    player: FIRST,
    level: "medium",
    stack: [],
    keys: [],
    legal: [],
    last: null,
    selected: -1,
    chain: [],
    notice: "",
    thinking: false,
    undos: 0,
    token: 0,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  function side() {
    return settings.values.side === "second" ? SECOND : FIRST;
  }

  function level() {
    const value = settings.values.level;
    return LEVELS[value] ? value : "medium";
  }

  function hints() {
    return settings.values.hints !== false;
  }

  const sideName = (s) => (s === FIRST ? "cyan" : "violet");

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function readBest(key) {
    const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${key}`));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  function writeBest(key, moves) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${key}`, String(moves));
    } catch {
      /* storage blocked — this game still finishes */
    }
  }

  function playerMoves() {
    return state.stack.filter((entry) => entry.before.turn === state.player).length;
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", tone === "ok");
    els.status.classList.toggle("is-bad", tone === "bad");
  }

  function setIdleStatus() {
    setStatus(`Press Start. You play ${sideName(side())} against the computer (${level()}). Cyan moves first.`);
  }

  function paintHud() {
    const you = state.phase === "idle" ? side() : state.player;
    els.mine.textContent = String(count(state.pos.b, you));
    els.theirs.textContent = String(count(state.pos.b, -you));
    els.moves.textContent = String(playerMoves());
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.phase === "idle" ? level() : state.level);
    els.best.textContent = best ? `${best}` : "—";
  }

  function yourTurn() {
    return state.phase === "play" && !state.thinking && state.pos.turn === state.player;
  }

  function canUndo() {
    return (
      state.phase === "play" &&
      !state.thinking &&
      state.stack.some((entry) => entry.before.turn === state.player)
    );
  }

  function candidates() {
    if (state.selected < 0) return [];
    return state.legal.filter(
      (m) => m.from === state.selected && state.chain.every((sq, i) => m.path[i] === sq)
    );
  }

  function pieceLabel(v) {
    const owner = (v > 0 ? FIRST : SECOND) === state.player ? "your" : "computer";
    return `${owner} ${sideName(v > 0 ? FIRST : SECOND)} ${v === 2 || v === -2 ? "king" : "man"}`;
  }

  function render() {
    const focused = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.sq
      : undefined;

    const mine = yourTurn();
    const showHints = mine && hints();
    const options = candidates();
    const step = state.chain.length;
    const targets = new Set(showHints ? options.filter((m) => m.path.length > step).map((m) => m.path[step]) : []);
    const mustJump = state.legal.length > 0 && state.legal[0].caps.length > 0;
    const movable = new Set(showHints && mustJump && state.selected < 0 ? state.legal.map((m) => m.from) : []);

    const view = state.pos.b.slice();
    const ghosts = new Set();
    let current = state.selected;
    if (step && options.length) {
      const piece = view[state.selected];
      view[state.selected] = 0;
      for (let i = 0; i < step; i += 1) ghosts.add(options[0].caps[i]);
      current = state.chain[step - 1];
      view[current] = piece;
    }
    const lastSquares = new Set(state.last ? [state.last.from, ...state.last.path] : []);
    const flipped = state.player === SECOND;

    let html = "";
    for (let i = 0; i < 64; i += 1) {
      const sq = flipped ? 63 - i : i;
      const r = sq >> 3;
      const c = sq & 7;
      const col = i % 8;
      const row = Math.floor(i / 8);
      const rank = col === 0 ? `<span class="coord coord--rank" aria-hidden="true">${8 - r}</span>` : "";
      const file = row === 7 ? `<span class="coord coord--file" aria-hidden="true">${FILES[c]}</span>` : "";
      if (!isDark(sq)) {
        html += `<span class="sq sq--light" aria-hidden="true">${rank}${file}</span>`;
        continue;
      }
      const ghost = ghosts.has(sq);
      const v = ghost ? state.pos.b[sq] : view[sq];
      const classes = ["sq", "sq--dark"];
      if (lastSquares.has(sq)) classes.push("is-last");
      if (current === sq && state.selected >= 0) classes.push("is-selected");
      if (targets.has(sq)) classes.push("is-target");
      if (movable.has(sq)) classes.push("is-movable");
      let label = `${nameOf(sq)}, `;
      if (v && ghost) label += `${pieceLabel(v)}, captured`;
      else if (v) label += pieceLabel(v);
      else label += "empty";
      if (targets.has(sq)) label += ", landing square";
      if (movable.has(sq)) label += ", can move";
      let piece = "";
      if (v) {
        const king = v === 2 || v === -2;
        const cls = `piece piece--${v > 0 ? "first" : "second"}${king ? " piece--king" : ""}${ghost ? " is-captured" : ""}`;
        piece = `<span class="${cls}" aria-hidden="true">${king ? `<span class="piece__crown">${CROWN}</span>` : ""}</span>`;
      }
      html += `<button class="${classes.join(" ")}" type="button" data-sq="${sq}" aria-label="${label}">${rank}${file}${piece}</button>`;
    }
    els.board.innerHTML = html;
    if (focused !== undefined) {
      const again = els.board.querySelector(`[data-sq="${focused}"]`);
      if (again) again.focus();
    }

    const playing = state.phase === "play";
    els.start.hidden = playing;
    els.undo.hidden = !playing;
    els.resign.hidden = !playing;
    els.undo.disabled = !canUndo();
    els.board.classList.toggle("is-idle", state.phase === "idle");

    if (playing) {
      if (state.thinking) setStatus("Computer is thinking…");
      else if (state.notice) setStatus(state.notice, "bad");
      else if (step) setStatus("Keep jumping: tap the next landing square.");
      else if (mustJump) setStatus("You must capture. Your move.");
      else setStatus("Your move.");
    }
    paintHud();
  }

  function outcomeOf() {
    if (!state.legal.length) {
      return { kind: "blocked", winner: -state.pos.turn, wiped: count(state.pos.b, state.pos.turn) === 0 };
    }
    const key = state.keys[state.keys.length - 1];
    if (state.keys.filter((k) => k === key).length >= 3) return { kind: "repeat" };
    if (state.pos.quiet >= QUIET_LIMIT) return { kind: "quiet" };
    return null;
  }

  function tick() {
    if (state.phase !== "play") return;
    state.elapsed = performance.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
    state.clock = window.setTimeout(tick, 500);
  }

  function clearSelection() {
    state.selected = -1;
    state.chain = [];
    state.notice = "";
  }

  function begin() {
    window.clearTimeout(state.clock);
    state.token += 1;
    state.player = side();
    state.level = level();
    state.pos = initial();
    state.stack = [];
    state.keys = [keyOf(state.pos)];
    state.legal = legalMoves(state.pos);
    state.last = null;
    clearSelection();
    state.thinking = false;
    state.undos = 0;
    state.record = false;
    state.elapsed = 0;
    state.started = performance.now();
    state.phase = "play";
    els.summary.hidden = true;
    state.clock = window.setTimeout(tick, 500);
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
      if (move) playMove(move);
      else render();
    }, 300);
  }

  function playMove(m) {
    state.stack.push({ before: state.pos, move: m });
    state.pos = apply(state.pos, m);
    state.keys.push(keyOf(state.pos));
    state.last = m;
    clearSelection();
    state.legal = legalMoves(state.pos);
    const end = outcomeOf();
    if (end) {
      finish(end);
      return;
    }
    if (state.pos.turn !== state.player) think();
    else render();
  }

  function finish(end) {
    window.clearTimeout(state.clock);
    state.token += 1;
    state.thinking = false;
    state.elapsed = performance.now() - state.started;
    state.phase = "over";
    clearSelection();

    const moves = playerMoves();
    const played = `${moves} ${moves === 1 ? "move" : "moves"}`;
    let title = "Draw";
    let text = "";
    let won = false;
    if (end.kind === "blocked") {
      if (end.winner === state.player) {
        won = true;
        title = "You win";
        const how = end.wiped ? "You captured every computer piece" : "The computer has no legal move";
        const previous = readBest(state.level);
        if (state.undos > 0) {
          text = `${how}, in ${played}. Undo was used, so no best was recorded.`;
        } else {
          if (!previous || moves < previous) {
            state.record = true;
            writeBest(state.level, moves);
          }
          text = state.record
            ? `${how}, in ${played}. New best.`
            : `${how}, in ${played}. Best is ${previous}.`;
        }
      } else {
        title = "You lose";
        text = end.wiped ? "The computer captured all your pieces." : "You have no legal move left.";
      }
    } else if (end.kind === "resign") {
      title = "Resigned";
      text = "You resigned this game.";
    } else if (end.kind === "repeat") {
      text = "The same position appeared three times.";
    } else {
      text = "Forty moves each passed without a capture or a man moving.";
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
    let popped;
    do {
      popped = state.stack.pop();
    } while (popped.before.turn !== state.player);
    state.pos = popped.before;
    state.keys.length = state.stack.length + 1;
    const last = state.stack[state.stack.length - 1];
    state.last = last ? last.move : null;
    state.legal = legalMoves(state.pos);
    clearSelection();
    state.undos += 1;
    render();
  }

  function completeIfDone() {
    const done = candidates().find((m) => m.path.length === state.chain.length);
    if (done) playMove(done);
    else render();
  }

  function onSquare(sq) {
    if (!yourTurn()) return;
    state.notice = "";
    const step = state.chain.length;

    if (step) {
      if (candidates().some((m) => m.path[step] === sq)) {
        state.chain.push(sq);
        completeIfDone();
      } else {
        state.notice = "Finish the jump: tap the next landing square.";
        render();
      }
      return;
    }

    if (state.selected >= 0 && candidates().some((m) => m.path[0] === sq)) {
      state.chain = [sq];
      completeIfDone();
      return;
    }

    const v = state.pos.b[sq];
    if (v !== 0 && (v > 0) === (state.player > 0)) {
      if (sq === state.selected) {
        state.selected = -1;
      } else if (state.legal.some((m) => m.from === sq)) {
        state.selected = sq;
      } else {
        state.selected = -1;
        state.notice = state.legal[0].caps.length
          ? "A capture is available, so you must jump. Pick a piece that can capture."
          : "That piece has no move.";
      }
    } else {
      state.selected = -1;
    }
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

  state.player = side();
  setIdleStatus();
  render();
})();
