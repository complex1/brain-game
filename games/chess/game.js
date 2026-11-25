(() => {
  "use strict";

  /* ---------- Rules engine ----------
     Board: 64 squares, index = row * 8 + col, row 0 is rank 8.
     Pieces: uppercase = white, lowercase = black. Empty square = "". */

  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const FILES = "abcdefgh";
  const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const CASTLE_LOSS = { 60: "KQ", 63: "K", 56: "Q", 4: "kq", 7: "k", 0: "q" };

  const PST_P = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ];
  const PST_N = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ];
  const PST_B = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ];
  const PST_K = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ];

  const isWhite = (piece) => piece < "a";
  const sqOf = (name) => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
  const nameOf = (sq) => FILES[sq & 7] + (8 - (sq >> 3));
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function parseFen(fen) {
    const [rows, turn, castle, ep, half, full] = fen.split(" ");
    const b = [];
    for (const row of rows.split("/")) {
      for (const ch of row) {
        if (ch >= "1" && ch <= "8") for (let i = 0; i < Number(ch); i += 1) b.push("");
        else b.push(ch);
      }
    }
    return {
      b,
      turn,
      castle: !castle || castle === "-" ? "" : castle,
      ep: ep && ep !== "-" ? sqOf(ep) : -1,
      half: Number(half) || 0,
      full: Number(full) || 1,
    };
  }

  function keyOf(s) {
    return `${s.b.map((p) => p || "-").join("")}${s.turn}${s.castle}${s.ep}`;
  }

  function attacked(b, sq, by) {
    const r = sq >> 3;
    const c = sq & 7;
    const white = by === "w";
    const pr = white ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      for (const dc of [-1, 1]) {
        if (inside(pr, c + dc) && b[pr * 8 + c + dc] === (white ? "P" : "p")) return true;
      }
    }
    for (const [dr, dc] of KNIGHT_STEPS) {
      if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (white ? "N" : "n")) return true;
    }
    for (const [dr, dc] of KING_STEPS) {
      if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (white ? "K" : "k")) return true;
    }
    const rook = white ? "R" : "r";
    const bishop = white ? "B" : "b";
    const queen = white ? "Q" : "q";
    for (const [dr, dc] of ROOK_DIRS) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    for (const [dr, dc] of BISHOP_DIRS) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  }

  function kingSquare(b, color) {
    const king = color === "w" ? "K" : "k";
    return b.indexOf(king);
  }

  function kingAttacked(b, color) {
    const k = kingSquare(b, color);
    return k >= 0 && attacked(b, k, color === "w" ? "b" : "w");
  }

  function inCheck(s) {
    return kingAttacked(s.b, s.turn);
  }

  function pseudoMoves(s, capturesOnly) {
    const b = s.b;
    const white = s.turn === "w";
    const out = [];
    const enemy = (q) => q !== "" && isWhite(q) !== white;
    const add = (from, to, piece, cap, flag) => {
      out.push({ from, to, piece, cap, promo: "", flag: flag || "" });
    };
    const addPawn = (from, to, piece, cap) => {
      const row = to >> 3;
      if (row === 0 || row === 7) {
        for (const promo of "qrbn") out.push({ from, to, piece, cap, promo, flag: "" });
      } else {
        add(from, to, piece, cap);
      }
    };

    for (let sq = 0; sq < 64; sq += 1) {
      const p = b[sq];
      if (!p || isWhite(p) !== white) continue;
      const t = p.toLowerCase();
      const r = sq >> 3;
      const c = sq & 7;

      if (t === "p") {
        const dir = white ? -1 : 1;
        const nr = r + dir;
        if (nr < 0 || nr > 7) continue;
        const one = nr * 8 + c;
        if (!b[one] && !capturesOnly) {
          addPawn(sq, one, p, "");
          const home = white ? 6 : 1;
          const two = (nr + dir) * 8 + c;
          if (r === home && !b[two]) add(sq, two, p, "", "double");
        }
        for (const dc of [-1, 1]) {
          if (!inside(nr, c + dc)) continue;
          const to = nr * 8 + c + dc;
          if (enemy(b[to])) addPawn(sq, to, p, b[to]);
          else if (to === s.ep && !b[to]) add(sq, to, p, white ? "p" : "P", "ep");
        }
        continue;
      }

      if (t === "n" || t === "k") {
        for (const [dr, dc] of t === "n" ? KNIGHT_STEPS : KING_STEPS) {
          if (!inside(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + c + dc;
          const q = b[to];
          if (!q) {
            if (!capturesOnly) add(sq, to, p, "");
          } else if (enemy(q)) {
            add(sq, to, p, q);
          }
        }
        if (t === "k" && !capturesOnly) {
          const by = white ? "b" : "w";
          const home = white ? 60 : 4;
          if (sq === home && !attacked(b, home, by)) {
            const rook = white ? "R" : "r";
            if (
              s.castle.includes(white ? "K" : "k") &&
              !b[home + 1] && !b[home + 2] && b[home + 3] === rook &&
              !attacked(b, home + 1, by)
            ) {
              add(sq, home + 2, p, "", "K");
            }
            if (
              s.castle.includes(white ? "Q" : "q") &&
              !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook &&
              !attacked(b, home - 1, by)
            ) {
              add(sq, home - 2, p, "", "Q");
            }
          }
        }
        continue;
      }

      const dirs = t === "r" ? ROOK_DIRS : t === "b" ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (inside(rr, cc)) {
          const to = rr * 8 + cc;
          const q = b[to];
          if (!q) {
            if (!capturesOnly) add(sq, to, p, "");
          } else {
            if (enemy(q)) add(sq, to, p, q);
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
    return out;
  }

  function apply(s, m) {
    const b = s.b.slice();
    const white = s.turn === "w";
    b[m.from] = "";
    b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : m.piece;
    if (m.flag === "ep") b[m.to + (white ? 8 : -8)] = "";
    if (m.flag === "K") {
      b[m.to - 1] = b[m.to + 1];
      b[m.to + 1] = "";
    }
    if (m.flag === "Q") {
      b[m.to + 1] = b[m.to - 2];
      b[m.to - 2] = "";
    }
    let castle = s.castle;
    for (const sq of [m.from, m.to]) {
      const lost = CASTLE_LOSS[sq];
      if (lost) for (const ch of lost) castle = castle.replace(ch, "");
    }
    const pawn = m.piece === "P" || m.piece === "p";
    return {
      b,
      turn: white ? "b" : "w",
      castle,
      ep: m.flag === "double" ? (m.from + m.to) / 2 : -1,
      half: pawn || m.cap ? 0 : s.half + 1,
      full: white ? s.full : s.full + 1,
    };
  }

  function legalMoves(s, capturesOnly) {
    const out = [];
    for (const m of pseudoMoves(s, capturesOnly)) {
      if (!kingAttacked(apply(s, m).b, s.turn)) out.push(m);
    }
    return out;
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let total = 0;
    for (const m of moves) total += perft(apply(s, m), depth - 1);
    return total;
  }

  function sanOf(s, m, legal) {
    if (m.flag === "K") return suffix(s, m, "O-O");
    if (m.flag === "Q") return suffix(s, m, "O-O-O");
    const t = m.piece.toLowerCase();
    const dest = nameOf(m.to);
    let text = "";
    if (t === "p") {
      if (m.cap) text += `${FILES[m.from & 7]}x`;
      text += dest;
      if (m.promo) text += `=${m.promo.toUpperCase()}`;
    } else {
      text += m.piece.toUpperCase();
      const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      if (rivals.length) {
        const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
        const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
        if (!sameFile) text += FILES[m.from & 7];
        else if (!sameRank) text += 8 - (m.from >> 3);
        else text += nameOf(m.from);
      }
      if (m.cap) text += "x";
      text += dest;
    }
    return suffix(s, m, text);
  }

  function suffix(s, m, text) {
    const after = apply(s, m);
    if (!inCheck(after)) return text;
    return legalMoves(after).length ? `${text}+` : `${text}#`;
  }

  function insufficient(b) {
    const minors = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const p = b[sq];
      if (!p) continue;
      const t = p.toLowerCase();
      if (t === "k") continue;
      if (t === "p" || t === "r" || t === "q") return false;
      minors.push({ t, shade: ((sq >> 3) + (sq & 7)) & 1 });
    }
    if (minors.length <= 1) return true;
    return minors.every((m) => m.t === "b" && m.shade === minors[0].shade);
  }

  /* ---------- Computer player ---------- */

  const MATE = 100000;

  function evaluate(s) {
    let score = 0;
    let heavy = 0;
    const kings = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const p = s.b[sq];
      if (!p) continue;
      const white = isWhite(p);
      const t = p.toLowerCase();
      const idx = white ? sq : sq ^ 56;
      let v = VALUE[t];
      if (t !== "p" && t !== "k") heavy += v;
      if (t === "p") v += PST_P[idx];
      else if (t === "n") v += PST_N[idx];
      else if (t === "b") v += PST_B[idx];
      else if (t === "k") kings.push([sq, white]);
      score += white ? v : -v;
    }
    const endgame = heavy <= 2400;
    for (const [sq, white] of kings) {
      const v = endgame
        ? -Math.round((Math.abs((sq >> 3) - 3.5) + Math.abs((sq & 7) - 3.5)) * 12)
        : PST_K[white ? sq : sq ^ 56];
      score += white ? v : -v;
    }
    return s.turn === "w" ? score : -score;
  }

  function order(moves) {
    const scored = moves.map((m) => ({
      m,
      v: (m.cap ? 10 * VALUE[m.cap.toLowerCase()] - VALUE[m.piece.toLowerCase()] / 10 : 0) + (m.promo ? 800 : 0),
    }));
    scored.sort((a, b) => b.v - a.v);
    return scored.map((x) => x.m);
  }

  function quiesce(s, alpha, beta, depth) {
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth === 0) return alpha;
    for (const m of order(legalMoves(s, true))) {
      const score = -quiesce(apply(s, m), -beta, -alpha, depth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ply) {
    if (s.half >= 100) return 0;
    if (depth <= 0) {
      if (ply < 10 && inCheck(s)) depth = 1;
      else return quiesce(s, alpha, beta, 3);
    }
    const moves = legalMoves(s);
    if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
    for (const m of order(moves)) {
      const score = -negamax(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  const LEVELS = {
    easy: { depth: 1, noise: 220 },
    medium: { depth: 3, noise: 20 },
    hard: { depth: 4, noise: 0 },
  };

  function chooseMove(s, level) {
    const moves = legalMoves(s);
    if (!moves.length) return null;
    const { depth, noise } = LEVELS[level] || LEVELS.medium;
    let best = null;
    let bestScore = -Infinity;
    for (const m of order(moves)) {
      const window = noise > 0 ? -Infinity : bestScore;
      const raw = -negamax(apply(s, m), depth - 1, -Infinity, -window, 1);
      const score = raw + (noise > 0 ? Math.random() * noise : 0);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  if (typeof document === "undefined") {
    globalThis.__chess = { START, parseFen, legalMoves, apply, perft, chooseMove, evaluate, sanOf, inCheck, keyOf, insufficient };
    return;
  }

  /* ---------- Game ---------- */

  const BEST_PREFIX = "mental-game.chess.best";
  const GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };
  const TEXT = "\uFE0E";

  const settings = GameSettings.mount({
    id: "chess",
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
        hint: "White moves first. Applies to the next game.",
        type: "choice",
        default: "w",
        options: [
          { value: "w", label: "White" },
          { value: "b", label: "Black" },
        ],
      },
      {
        id: "hints",
        label: "Show legal moves",
        hint: "Mark every square the selected piece can move to.",
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
    moves: document.getElementById("moves"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    summaryTitle: document.getElementById("summary-title"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    board: document.getElementById("board"),
    promo: document.getElementById("promo"),
    list: document.getElementById("movelist"),
    start: document.getElementById("start-btn"),
    undo: document.getElementById("undo-btn"),
    resign: document.getElementById("resign-btn"),
  };

  const state = {
    phase: "idle",
    pos: parseFen(START),
    player: "w",
    level: "medium",
    stack: [],
    keys: [],
    legal: [],
    last: null,
    selected: -1,
    pending: null,
    thinking: false,
    undos: 0,
    token: 0,
    started: 0,
    elapsed: 0,
    clock: 0,
    record: false,
  };

  function side() {
    return settings.values.side === "b" ? "b" : "w";
  }

  function level() {
    const value = settings.values.level;
    return LEVELS[value] ? value : "medium";
  }

  function hints() {
    return settings.values.hints !== false;
  }

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
    const color = side() === "w" ? "white" : "black";
    setStatus(`Press Start. You play ${color} against the computer (${level()}).`);
  }

  function paintHud() {
    els.moves.textContent = String(playerMoves());
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.phase === "idle" ? level() : state.level);
    els.best.textContent = best ? `${best}` : "—";
  }

  function canUndo() {
    return (
      state.phase === "play" &&
      !state.thinking &&
      state.stack.some((entry) => entry.before.turn === state.player)
    );
  }

  function render() {
    const focused = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.sq
      : undefined;

    const flipped = state.player === "b";
    const targets = new Map();
    if (state.phase === "play" && state.selected >= 0 && hints()) {
      for (const m of state.legal) if (m.from === state.selected) targets.set(m.to, m);
    }
    const checked = state.phase !== "idle" && inCheck(state.pos) ? kingSquare(state.pos.b, state.pos.turn) : -1;

    let html = "";
    for (let i = 0; i < 64; i += 1) {
      const sq = flipped ? 63 - i : i;
      const r = sq >> 3;
      const c = sq & 7;
      const p = state.pos.b[sq];
      const classes = ["sq", (r + c) % 2 ? "sq--dark" : "sq--light"];
      if (state.selected === sq) classes.push("is-selected");
      if (state.last && (state.last.from === sq || state.last.to === sq)) classes.push("is-last");
      if (targets.has(sq)) classes.push("is-target");
      if (p) classes.push("has-piece");
      if (checked === sq) classes.push("is-check");
      const label = `${nameOf(sq)}, ${p ? `${isWhite(p) ? "white" : "black"} ${NAMES[p.toLowerCase()]}` : "empty"}`;
      const col = i % 8;
      const row = Math.floor(i / 8);
      const rank = col === 0 ? `<span class="coord coord--rank" aria-hidden="true">${8 - r}</span>` : "";
      const file = row === 7 ? `<span class="coord coord--file" aria-hidden="true">${FILES[c]}</span>` : "";
      const piece = p
        ? `<span class="piece piece--${isWhite(p) ? "w" : "b"}" aria-hidden="true">${GLYPH[p.toLowerCase()]}${TEXT}</span>`
        : "";
      html += `<button class="${classes.join(" ")}" type="button" data-sq="${sq}" aria-label="${label}">${rank}${file}${piece}</button>`;
    }
    els.board.innerHTML = html;
    if (focused !== undefined) {
      const again = els.board.querySelector(`[data-sq="${focused}"]`);
      if (again) again.focus();
    }

    els.promo.hidden = !state.pending;
    if (state.pending) {
      const white = state.player === "w";
      els.promo.innerHTML = ["q", "r", "b", "n"]
        .map(
          (t) =>
            `<button class="btn btn--ghost promo__btn" type="button" data-promo="${t}" aria-label="Promote to ${NAMES[t]}"><span class="piece piece--${white ? "w" : "b"}" aria-hidden="true">${GLYPH[t]}${TEXT}</span></button>`
        )
        .join("");
    }

    renderList();

    const playing = state.phase === "play";
    els.start.hidden = playing;
    els.start.textContent = "Start";
    els.undo.hidden = !playing;
    els.resign.hidden = !playing;
    els.undo.disabled = !canUndo();
    els.board.classList.toggle("is-idle", state.phase === "idle");

    if (playing) {
      if (state.thinking) setStatus("Computer is thinking…");
      else if (state.pending) setStatus("Choose a piece to promote to.");
      else setStatus(inCheck(state.pos) ? "Check. Your move." : "Your move.", inCheck(state.pos) ? "bad" : undefined);
    }
    paintHud();
  }

  function renderList() {
    let html = "";
    const entries = state.stack;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry.before.turn === "w") {
        const reply = entries[i + 1];
        html += `<li><span>${entry.san}</span><span>${reply ? reply.san : ""}</span></li>`;
      } else if (i === 0) {
        html += `<li><span>…</span><span>${entry.san}</span></li>`;
      }
    }
    els.list.innerHTML = html;
    els.list.parentElement.hidden = !entries.length;
    els.list.parentElement.scrollTop = els.list.parentElement.scrollHeight;
  }

  function outcomeOf() {
    if (!state.legal.length) {
      if (inCheck(state.pos)) return { kind: "mate", winner: state.pos.turn === "w" ? "b" : "w" };
      return { kind: "stalemate" };
    }
    const key = state.keys[state.keys.length - 1];
    if (state.keys.filter((k) => k === key).length >= 3) return { kind: "repeat" };
    if (state.pos.half >= 100) return { kind: "fifty" };
    if (insufficient(state.pos.b)) return { kind: "material" };
    return null;
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
    state.player = side();
    state.level = level();
    state.pos = parseFen(START);
    state.stack = [];
    state.keys = [keyOf(state.pos)];
    state.legal = legalMoves(state.pos);
    state.last = null;
    state.selected = -1;
    state.pending = null;
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
    }, 320);
  }

  function playMove(m) {
    const san = sanOf(state.pos, m, state.legal);
    state.stack.push({ before: state.pos, move: m, san });
    state.pos = apply(state.pos, m);
    state.keys.push(keyOf(state.pos));
    state.last = { from: m.from, to: m.to };
    state.selected = -1;
    state.pending = null;
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
    state.selected = -1;
    state.pending = null;

    const moves = playerMoves();
    const count = `${moves} ${moves === 1 ? "move" : "moves"}`;
    let title = "Draw";
    let text = "";
    if (end.kind === "mate") {
      if (end.winner === state.player) {
        title = "You win";
        const previous = readBest(state.level);
        if (state.undos > 0) {
          text = `Checkmate in ${count}. Undo was used, so no best was recorded.`;
        } else {
          if (!previous || moves < previous) {
            state.record = true;
            writeBest(state.level, moves);
          }
          text = state.record
            ? `Checkmate in ${count}. New best.`
            : `Checkmate in ${count}. Best is ${previous}.`;
        }
      } else {
        title = "You lose";
        text = "Checkmate. The computer wins this one.";
      }
    } else if (end.kind === "resign") {
      title = "Resigned";
      text = "You resigned this game.";
    } else if (end.kind === "stalemate") {
      text = "Stalemate. The side to move has no legal move.";
    } else if (end.kind === "repeat") {
      text = "The same position appeared three times.";
    } else if (end.kind === "fifty") {
      text = "Fifty moves passed without a capture or a pawn move.";
    } else {
      text = "Neither side has enough pieces left to checkmate.";
    }

    els.summaryTitle.textContent = title;
    els.summaryText.textContent = `${text} Time ${formatTime(state.elapsed)}.`;
    els.summary.hidden = false;
    setStatus(title, end.kind === "mate" && end.winner === state.player ? "ok" : undefined);
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
    state.last = last ? { from: last.move.from, to: last.move.to } : null;
    state.legal = legalMoves(state.pos);
    state.selected = -1;
    state.pending = null;
    state.undos += 1;
    render();
  }

  function onSquare(sq) {
    if (state.phase !== "play" || state.thinking || state.pos.turn !== state.player) return;
    state.pending = null;
    if (state.selected >= 0) {
      const options = state.legal.filter((m) => m.from === state.selected && m.to === sq);
      if (options.length === 1) {
        playMove(options[0]);
        return;
      }
      if (options.length > 1) {
        state.pending = options;
        render();
        return;
      }
    }
    const p = state.pos.b[sq];
    if (p && isWhite(p) === (state.player === "w") && sq !== state.selected) state.selected = sq;
    else state.selected = -1;
    render();
  }

  els.board.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sq]");
    if (button) onSquare(Number(button.dataset.sq));
  });

  els.promo.addEventListener("click", (event) => {
    const button = event.target.closest("[data-promo]");
    if (!button || !state.pending) return;
    const move = state.pending.find((m) => m.promo === button.dataset.promo);
    if (move) playMove(move);
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
