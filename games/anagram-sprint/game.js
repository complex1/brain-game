(() => {
  "use strict";

  const WORDS = {
    4: ["mind", "game", "play", "read", "word", "time", "blue", "gold", "star", "moon", "tree", "bird", "fish", "hand", "book", "lamp", "door", "rain", "snow", "wind", "fire", "leaf", "seed", "rock", "sand", "wave", "ship", "road", "path", "code", "note", "idea", "plan", "goal", "team", "luck", "hope", "kind", "warm", "cool", "fast", "slow", "dark", "calm", "jump", "sing", "draw", "open", "work", "home"],
    5: ["brain", "focus", "logic", "sharp", "think", "learn", "quick", "light", "sound", "color", "shape", "match", "score", "round", "level", "clear", "smart", "happy", "river", "cloud", "stone", "plant", "grape", "peach", "tiger", "horse", "sheep", "mouse", "house", "water", "earth", "heart", "smile", "dance", "music", "story"],
  };

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const held = copy[i];
      copy[i] = copy[j];
      copy[j] = held;
    }
    return copy;
  }

  function scramble(word) {
    let mixed = shuffle(word.split("")).join("");
    for (let guard = 0; mixed === word && guard < 8; guard += 1) mixed = shuffle(word.split("")).join("");
    return mixed;
  }

  if (typeof document === "undefined") {
    globalThis.__anagram = { WORDS, scramble };
    return;
  }

  const BEST_PREFIX = "mental-game.anagram-sprint.best";
  const settings = GameSettings.mount({
    id: "anagram-sprint",
    fields: [
      {
        id: "length",
        label: "Word length",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "4",
        options: [
          { value: "4", label: "4 letters" },
          { value: "5", label: "5 letters" },
        ],
      },
      {
        id: "time",
        label: "Round length",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "60",
        options: [
          { value: "45", label: "45s" },
          { value: "60", label: "60s" },
          { value: "90", label: "90s" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next round: ${wordLength()} letters, ${roundLength()}s.`);
    },
  });

  const els = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    answer: document.getElementById("answer"),
    tiles: document.getElementById("tiles"),
    clear: document.getElementById("clear-btn"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", score: 0, streak: 0, solved: 0, word: "", tiles: [], built: [], deadline: 0, clock: 0, record: false };

  function wordLength() { return Number(settings.values.length) === 5 ? 5 : 4; }
  function roundLength() {
    const value = Number(settings.values.time);
    return value === 45 || value === 90 ? value : 60;
  }
  function bestKey() { return `${BEST_PREFIX}.${wordLength()}.${roundLength()}`; }
  function readBest() {
    const value = Number(localStorage.getItem(bestKey()));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(bestKey(), String(value)); } catch { /* storage blocked */ }
  }
  function formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud(seconds) {
    const left = seconds === undefined ? Math.max(0, (state.deadline - Date.now()) / 1000) : seconds;
    els.time.textContent = formatTime(left);
    els.time.classList.toggle("is-low", state.phase === "play" && left <= 10);
    els.score.textContent = String(state.score);
    els.streak.textContent = String(state.streak);
    els.best.textContent = String(readBest());
  }
  function render() {
    els.answer.replaceChildren();
    for (let i = 0; i < (state.word.length || wordLength()); i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter";
      const piece = state.built[i];
      button.textContent = piece ? piece.letter : "";
      button.classList.toggle("is-empty", !piece);
      button.disabled = state.phase !== "play" || !piece;
      button.setAttribute("aria-label", piece ? `Remove ${piece.letter}` : `Empty letter ${i + 1}`);
      button.addEventListener("click", () => removeAt(i));
      els.answer.append(button);
    }
    els.tiles.replaceChildren();
    state.tiles.forEach((tile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter";
      button.textContent = tile.letter;
      button.disabled = state.phase !== "play" || tile.used;
      button.setAttribute("aria-label", tile.letter);
      button.addEventListener("click", () => addTile(tile.index));
      els.tiles.append(button);
    });
    els.clear.hidden = state.phase !== "play";
  }
  function nextWord() {
    const list = WORDS[wordLength()];
    let word = list[Math.floor(Math.random() * list.length)];
    while (word === state.word) word = list[Math.floor(Math.random() * list.length)];
    state.word = word;
    state.built = [];
    state.tiles = scramble(word).split("").map((letter, index) => ({ letter, index, used: false }));
    state.phase = "play";
    render();
    setStatus("Tap the letters in order.");
  }
  function addTile(index) {
    if (state.phase !== "play") return;
    const tile = state.tiles[index];
    if (!tile || tile.used || state.built.length >= state.word.length) return;
    tile.used = true;
    state.built.push(tile);
    if (state.built.length === state.word.length) grade();
    else render();
  }
  function removeAt(index) {
    if (state.phase !== "play" || !state.built[index]) return;
    const [removed] = state.built.splice(index, 1);
    removed.used = false;
    render();
  }
  function grade() {
    const guess = state.built.map((tile) => tile.letter).join("");
    if (guess === state.word) {
      state.solved += 1;
      state.streak += 1;
      state.score += 1 + Math.min(state.streak, 5);
      paintHud();
      nextWord();
      return;
    }
    state.streak = 0;
    state.built.forEach((tile) => { tile.used = false; });
    state.built = [];
    paintHud();
    render();
    setStatus("Not that word. Try again.", "bad");
  }
  function tick() {
    const left = (state.deadline - Date.now()) / 1000;
    if (left <= 0) { finish(); return; }
    paintHud(left);
    state.clock = setTimeout(tick, 200);
  }
  function begin() {
    clearTimeout(state.clock);
    state.score = 0;
    state.streak = 0;
    state.solved = 0;
    state.word = "";
    state.record = false;
    state.deadline = Date.now() + roundLength() * 1000;
    els.summary.hidden = true;
    els.start.hidden = true;
    paintHud(roundLength());
    nextWord();
    tick();
  }
  function finish() {
    clearTimeout(state.clock);
    if (state.phase === "over") return;
    state.phase = "over";
    const previous = readBest();
    if (state.score > previous) {
      state.record = true;
      writeBest(state.score);
    }
    paintHud(0);
    render();
    setStatus(state.solved ? `Solved ${state.solved}.` : "Time's up.", state.solved ? "ok" : "");
    els.summaryText.textContent = state.record
      ? `Score ${state.score}. ${state.solved} words. New best.`
      : `Score ${state.score}. ${state.solved} words.`;
    els.summary.hidden = false;
    els.clear.hidden = true;
  }

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.clear.addEventListener("click", () => {
    state.tiles.forEach((tile) => { tile.used = false; });
    state.built = [];
    render();
  });
  setStatus(`Press Start. Next round: ${wordLength()} letters, ${roundLength()}s.`);
  paintHud(roundLength());
})();
