(() => {
  "use strict";

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const MAX_HINTS = 3;
  const REVEALS = { easy: 3, medium: 1, hard: 0 };

  // Original lines and traditional, public-domain proverbs.
  const SENTENCES = [
    "A quiet mind finds answers that loud ones miss.",
    "Every garden starts with one small seed.",
    "Patience is a bridge built from small steps.",
    "A kind word costs nothing and warms a whole day.",
    "Water wears the stone by falling gently.",
    "Learn to walk before you try to run a mile.",
    "A friend in need is a friend indeed, they say.",
    "No rain, no river, no harvest in the fall.",
    "Curiosity opens doors that worry keeps shut.",
    "Slow and steady wins more races than haste.",
    "A small lamp still chases away the dark.",
    "Good tools help, but steady hands build the house.",
    "Many hands make light work of a heavy load.",
    "The best time to plant a tree was last spring.",
    "Honey catches more bees than vinegar ever will.",
    "A river cuts through rock by never giving up.",
    "Laughter is the shortest road between two friends.",
    "Even the tallest oak began as a tiny acorn.",
    "Clear water shows the stones at the bottom.",
    "A map helps, but the walking is still yours.",
    "Fresh bread and good company make a fine evening.",
    "Don't count the clouds when the sun is out.",
    "The wise traveler packs light and listens well.",
    "One bright idea can warm a thousand cold hours.",
    "A full moon shines the same on palace and cottage.",
    "Every expert was once a beginner who refused to quit.",
    "Fresh snow hides old paths but not the will to walk.",
    "Two heads are better than one when the puzzle is big.",
    "A quiet pond hides a great many busy fish below.",
    "Let the kettle boil and the troubles cool.",
    "The compass never argues; it simply points the way.",
    "Trust the bridge you built and check the rope you borrowed.",
    "A stitch in time saves nine, so mend the small tear before it spreads.",
    "The journey of a thousand miles begins with a single step forward.",
    "When the wind changes, some people build walls and others build windmills.",
    "A good listener learns more in an hour than a talker learns in a year.",
    "Never judge a book by its cover, or a baker by the shape of his bread.",
    "A bridge is only as strong as the first plank you trust.",
    "Tidy desks hold tidy thoughts, but messy ones often hold bright ideas.",
    "Small leaks sink great ships, so fix the tiny crack today.",
    "The fox knows many tricks, but the hedgehog knows one good one.",
    "A calm sea never made a skilled sailor, nor an easy road a hiker.",
    "Keep your eyes on the road and your heart on the home you left.",
    "If you chase two rabbits, expect to dine on neither.",
    "The quickest way to a full basket is to pick one berry at a time.",
    "Bright mornings are built on quiet evenings and a well packed bag.",
    "A long rope is made of many thin threads twisted together.",
    "The lantern works best in the dark, and so do good friends.",
    "Ask the question now, or carry the doubt all the way home.",
    "Every mountain looks steep until you have walked its lower slopes.",
    "The potter shapes the clay, and the clay shapes the potter's patience.",
    "When the storm passes, the farmer counts the fences, not the clouds.",
    "The sun rises on the lazy and the eager alike, so choose your morning.",
    "A wise gardener waters the roots instead of polishing the leaves, and the whole plant thrives.",
    "The mountain does not hurry, yet it reaches the sky long before the impatient climber.",
    "When you have lost the path, do not blame the map; walk back to the last place you knew.",
    "A quiet library holds a thousand voices, and each one waits for a curious reader.",
    "The baker who rises before dawn shares warm bread with neighbors who were still dreaming.",
    "Nobody can carry the whole harvest at once, but everyone can carry one basket to the barn.",
    "If the ladder is too short, do not curse the wall; build a taller ladder, one rung at a time.",
    "The old clock ticks the same whether you are bored or busy, so choose how to spend its minutes.",
    "A good neighbor lends a ladder, and a better one holds it steady while you climb.",
    "The river remembers every stone it has carried, yet it still sings on its way to the sea.",
    "Even a turtle reaches the far shore if it keeps walking and never watches the hares.",
    "The smallest candle can light a thousand others without losing a single bit of its flame.",
    "Teach a child to ask questions, and the world will never run out of answers to discover.",
    "Build the fence before the winter, mend the roof before the rain, and rest when the work is done.",
    "A sharp knife and a patient hand both help the cook, but only practice makes the bread rise.",
    "When many small streams join together, they become a river that no dam can hold for long.",
    "The traveler who asks for directions reaches the village before the one too proud to stop.",
    "A gentle answer can calm a roaring fire, and a steady hand can turn anger into something useful.",
    "The wisest beekeeper learns from the hive: every small worker matters, and no one works alone.",
    "Sail with the wind when it helps you, and row with patience when it does not.",
  ].map((line) => line.toUpperCase());

  const ALLOWED_PUNCT = " .,'!?;:-";

  function isLetter(ch) {
    return ch >= "A" && ch <= "Z";
  }

  function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const held = copy[i];
      copy[i] = copy[j];
      copy[j] = held;
    }
    return copy;
  }

  // A random permutation of the alphabet in which no letter stays in place.
  function derangement(rng) {
    const letters = ALPHABET.split("");
    for (let guard = 0; guard < 1000; guard += 1) {
      const mixed = shuffle(letters, rng);
      if (mixed.every((letter, index) => letter !== letters[index])) return mixed;
    }
    return letters.map((_, index) => letters[(index + 1) % letters.length]);
  }

  function distinctLetters(text) {
    const seen = [];
    for (const ch of text) {
      if (isLetter(ch) && !seen.includes(ch)) seen.push(ch);
    }
    return seen;
  }

  function encode(plain, map) {
    let out = "";
    for (const ch of plain) out += isLetter(ch) ? map[ch] : ch;
    return out;
  }

  function makeCipher(plain, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const perm = derangement(random);
    const map = {};
    const inverse = {};
    ALPHABET.split("").forEach((letter, index) => {
      map[letter] = perm[index];
      inverse[perm[index]] = letter;
    });
    const cipher = encode(plain, map);
    return { cipher, map, inverse, letters: distinctLetters(cipher) };
  }

  // Plain text for a cipher string under a partial key; unknown letters show as "_".
  function applyKey(cipher, key) {
    let out = "";
    for (const ch of cipher) out += isLetter(ch) ? key[ch] || "_" : ch;
    return out;
  }

  function isSolved(cipher, key, inverse) {
    let any = false;
    for (const ch of cipher) {
      if (!isLetter(ch)) continue;
      any = true;
      if (key[ch] !== inverse[ch]) return false;
    }
    return any;
  }

  function pool(difficulty) {
    if (difficulty === "easy") return SENTENCES.filter((line) => line.length <= 60);
    if (difficulty === "hard") return SENTENCES.filter((line) => line.length >= 75);
    return SENTENCES.filter((line) => line.length >= 45 && line.length <= 95);
  }

  function pickReveals(letters, count, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    return shuffle(letters, random).slice(0, count);
  }

  if (typeof document === "undefined") {
    globalThis.__cryptogram = {
      SENTENCES,
      REVEALS,
      ALLOWED_PUNCT,
      makeCipher,
      encode,
      applyKey,
      isSolved,
      pool,
      pickReveals,
      distinctLetters,
    };
    return;
  }

  const BEST_PREFIX = "mental-game.cryptogram.best";

  const settings = GameSettings.mount({
    id: "cryptogram",
    fields: [
      {
        id: "difficulty",
        label: "Difficulty",
        hint: "Easy shows 3 letters and uses shorter sentences. Medium shows 1. Hard shows none and uses longer sentences. Applies to the next sentence.",
        type: "choice",
        default: "medium",
        options: [
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ],
      },
      {
        id: "mistakes",
        label: "Highlight mistakes",
        hint: "Mark coded letters whose guess is wrong.",
        type: "toggle",
        default: false,
      },
      {
        id: "frequencies",
        label: "Show letter frequencies",
        hint: "Show how often each coded letter appears.",
        type: "toggle",
        default: true,
      },
    ],
    onChange() {
      if (state.phase === "idle") {
        setStatus(idleText());
        paintHud();
      } else {
        paint();
      }
    },
  });

  const els = {
    filled: document.getElementById("filled"),
    hints: document.getElementById("hints"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
    text: document.getElementById("text"),
    freq: document.getElementById("freq"),
    keypad: document.getElementById("keypad"),
    start: document.getElementById("start-btn"),
    hint: document.getElementById("hint-btn"),
    erase: document.getElementById("erase-btn"),
    clear: document.getElementById("clear-btn"),
  };

  const state = {
    phase: "idle",
    difficulty: "medium",
    cipher: "",
    inverse: {},
    letters: [],
    key: {},
    locked: new Set(),
    hints: 0,
    sel: -1,
    last: -1,
    started: 0,
    elapsed: 0,
    record: false,
    clock: 0,
    previousBest: 0,
  };

  let slots = [];
  const freqItems = new Map();
  const padButtons = new Map();

  function difficulty() {
    const value = settings.values.difficulty;
    return value === "easy" || value === "hard" ? value : "medium";
  }

  function idleText() {
    const level = difficulty();
    const shown = REVEALS[level];
    const hint = shown === 0 ? "no letters shown" : shown === 1 ? "1 letter shown" : `${shown} letters shown`;
    return `Press Start to get a coded sentence. Next one: ${level}, ${hint}.`;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function readBest(level) {
    try {
      const stored = Number(localStorage.getItem(`${BEST_PREFIX}.${level}`));
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(level, ms) {
    try {
      localStorage.setItem(`${BEST_PREFIX}.${level}`, String(ms));
    } catch {
      /* storage blocked — this run still finishes */
    }
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }

  function selectedLetter() {
    return state.sel >= 0 && slots[state.sel] ? slots[state.sel].letter : "";
  }

  function holderOf(guess) {
    return state.letters.find((letter) => state.key[letter] === guess) || "";
  }

  function playing() {
    return state.phase === "play";
  }

  function paintHud() {
    const total = state.letters.length;
    const filled = state.letters.filter((letter) => state.key[letter]).length;
    els.filled.textContent = `${filled} / ${total}`;
    els.hints.textContent = `${state.hints} / ${MAX_HINTS}`;
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest(state.phase === "idle" ? difficulty() : state.difficulty);
    els.best.textContent = best ? formatTime(best) : "—";
  }

  function paint() {
    const live = playing();
    const mark = settings.values.mistakes === true;
    const chosen = selectedLetter();

    slots.forEach((slot, index) => {
      const guess = state.key[slot.letter] || "";
      const locked = state.locked.has(slot.letter);
      const wrong = mark && guess !== "" && !locked && guess !== state.inverse[slot.letter];
      const selected = index === state.sel;
      slot.guess.textContent = guess;
      slot.el.classList.toggle("is-selected", selected);
      slot.el.classList.toggle("is-same", !selected && chosen !== "" && slot.letter === chosen);
      slot.el.classList.toggle("is-locked", locked);
      slot.el.classList.toggle("is-wrong", wrong);
      slot.el.classList.toggle("is-filled", guess !== "");
      slot.el.disabled = state.phase === "idle";
      slot.el.tabIndex = state.sel >= 0 ? (selected ? 0 : -1) : index === 0 ? 0 : -1;
      slot.el.setAttribute("aria-pressed", selected ? "true" : "false");
      const parts = [`Coded letter ${slot.letter}`, guess ? `guess ${guess}` : "no guess yet"];
      if (locked) parts.push("given, locked");
      if (wrong) parts.push("marked as a mistake");
      slot.el.setAttribute("aria-label", parts.join(", "));
    });

    els.freq.hidden = settings.values.frequencies !== true || state.letters.length === 0;
    for (const [letter, item] of freqItems) {
      const guess = state.key[letter] || "";
      const locked = state.locked.has(letter);
      const wrong = mark && guess !== "" && !locked && guess !== state.inverse[letter];
      item.el.classList.toggle("is-selected", letter === chosen);
      item.el.classList.toggle("is-locked", locked);
      item.el.classList.toggle("is-wrong", wrong);
      item.guess.textContent = guess || "·";
      item.el.disabled = !live;
      item.el.setAttribute(
        "aria-label",
        `Coded letter ${letter}, appears ${item.count} ${item.count === 1 ? "time" : "times"}, ${guess ? `guess ${guess}` : "no guess yet"}`
      );
    }

    const taken = new Set(state.letters.map((letter) => state.key[letter]).filter(Boolean));
    for (const [guess, button] of padButtons) {
      button.disabled = !live || chosen === "" || state.locked.has(chosen);
      button.classList.toggle("is-used", taken.has(guess));
    }

    const left = MAX_HINTS - state.hints;
    els.hint.textContent = `Hint (${left} left)`;
    els.hint.disabled = !live || left <= 0;
    els.erase.disabled = !live || chosen === "" || state.locked.has(chosen) || !state.key[chosen];
    els.clear.disabled = !live;
    els.summary.hidden = state.phase !== "over";
    paintHud();
  }

  function buildKeypad() {
    for (const letter of ALPHABET) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pad";
      button.textContent = letter;
      button.disabled = true;
      button.setAttribute("aria-label", `Use ${letter} for the selected coded letter`);
      button.addEventListener("click", () => assign(letter));
      els.keypad.append(button);
      padButtons.set(letter, button);
    }
  }

  function buildBoard() {
    els.text.replaceChildren();
    els.freq.replaceChildren();
    slots = [];
    freqItems.clear();
    const counts = {};
    for (const ch of state.cipher) if (isLetter(ch)) counts[ch] = (counts[ch] || 0) + 1;

    state.cipher.split(" ").forEach((word) => {
      const group = document.createElement("div");
      group.className = "word";
      group.setAttribute("role", "presentation");
      for (const ch of word) {
        if (!isLetter(ch)) {
          const mark = document.createElement("span");
          mark.className = "mark";
          mark.textContent = ch;
          group.append(mark);
          continue;
        }
        const index = slots.length;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "slot";
        el.dataset.cipher = ch;
        const guess = document.createElement("span");
        guess.className = "slot__guess";
        guess.setAttribute("aria-hidden", "true");
        const code = document.createElement("span");
        code.className = "slot__code";
        code.textContent = ch;
        code.setAttribute("aria-hidden", "true");
        el.append(guess, code);
        el.addEventListener("click", () => select(index, false));
        group.append(el);
        slots.push({ el, guess, letter: ch });
      }
      els.text.append(group);
    });

    state.letters
      .slice()
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .forEach((letter) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "freq__item";
        const code = document.createElement("span");
        code.className = "freq__code";
        code.textContent = letter;
        const count = document.createElement("span");
        count.className = "freq__count";
        count.textContent = `×${counts[letter]}`;
        const guess = document.createElement("span");
        guess.className = "freq__guess";
        el.append(code, count, guess);
        el.addEventListener("click", () => {
          const first = slots.findIndex((slot) => slot.letter === letter);
          if (first >= 0) select(first, false);
        });
        els.freq.append(el);
        freqItems.set(letter, { el, guess, count: counts[letter] });
      });
  }

  function select(index, focus) {
    if (!playing() || index < 0 || index >= slots.length) return;
    state.sel = index;
    const letter = slots[index].letter;
    const guess = state.key[letter];
    if (state.locked.has(letter)) {
      setStatus(`${letter} is a given letter (${guess}). It is locked.`);
    } else if (guess) {
      setStatus(`${letter} is guessed as ${guess}. Type another letter to change it.`);
    } else {
      setStatus(`${letter} selected. Type a letter A to Z for it.`);
    }
    paint();
    if (focus) slots[index].el.focus();
  }

  function assign(guess) {
    if (!playing()) return;
    const letter = selectedLetter();
    if (!letter) {
      setStatus("Select a coded letter first.");
      return;
    }
    if (state.locked.has(letter)) {
      setStatus(`${letter} is a given letter and cannot change.`);
      return;
    }
    if (state.key[letter] === guess) {
      setStatus(`${letter} is already ${guess}.`);
      return;
    }
    const other = holderOf(guess);
    if (other && state.locked.has(other)) {
      setStatus(`${guess} is already given for ${other}. Each letter is used once.`, "bad");
      return;
    }
    let cleared = "";
    if (other) {
      delete state.key[other];
      cleared = ` ${guess} was used for ${other}, so ${other} is cleared. A letter appears only once in the key.`;
    }
    state.key[letter] = guess;
    setStatus(`${letter} is now ${guess} everywhere.${cleared}`);
    paint();
    if (isSolved(state.cipher, state.key, state.inverse)) finish();
  }

  function erase() {
    if (!playing()) return;
    const letter = selectedLetter();
    if (!letter) return;
    if (state.locked.has(letter)) {
      setStatus(`${letter} is a given letter and cannot be cleared.`);
      return;
    }
    if (!state.key[letter]) {
      setStatus(`${letter} has no guess to clear.`);
      return;
    }
    delete state.key[letter];
    setStatus(`${letter} cleared.`);
    paint();
  }

  function clearAll() {
    if (!playing()) return;
    for (const letter of state.letters) {
      if (!state.locked.has(letter)) delete state.key[letter];
    }
    setStatus("All your guesses are cleared. Given letters stay.");
    paint();
  }

  function hint() {
    if (!playing() || state.hints >= MAX_HINTS) return;
    const chosen = selectedLetter();
    const open = state.letters.filter(
      (letter) => !state.locked.has(letter) && state.key[letter] !== state.inverse[letter]
    );
    let target = "";
    if (chosen && open.includes(chosen)) {
      target = chosen;
    } else if (open.length) {
      target = open[Math.floor(Math.random() * open.length)];
    }
    if (!target) {
      setStatus("Nothing left to reveal. Every open letter is already right.");
      return;
    }
    const truth = state.inverse[target];
    const other = holderOf(truth);
    if (other && other !== target) delete state.key[other];
    state.key[target] = truth;
    state.locked.add(target);
    state.hints += 1;
    const first = slots.findIndex((slot) => slot.letter === target);
    if (first >= 0) state.sel = first;
    setStatus(`Hint: ${target} is ${truth}. It is locked. Wins with hints do not set a best.`);
    paint();
    if (isSolved(state.cipher, state.key, state.inverse)) finish();
  }

  function move(step) {
    if (!playing() || !slots.length) return;
    const from = state.sel < 0 ? (step > 0 ? -1 : 0) : state.sel;
    select((from + step + slots.length) % slots.length, true);
  }

  function moveLetter(step) {
    if (!playing() || !state.letters.length) return;
    const at = state.letters.indexOf(selectedLetter());
    const next = state.letters[(at + step + state.letters.length) % state.letters.length];
    const first = slots.findIndex((slot) => slot.letter === next);
    select(first, true);
  }

  function tick() {
    if (!playing()) return;
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }

  function pickSentence(level) {
    const choices = pool(level);
    let index = Math.floor(Math.random() * choices.length);
    if (choices.length > 1 && choices[index] === SENTENCES[state.last]) {
      index = (index + 1) % choices.length;
    }
    state.last = SENTENCES.indexOf(choices[index]);
    return choices[index];
  }

  function begin() {
    clearInterval(state.clock);
    const level = difficulty();
    const made = makeCipher(pickSentence(level));
    state.phase = "play";
    state.difficulty = level;
    state.cipher = made.cipher;
    state.inverse = made.inverse;
    state.letters = made.letters;
    state.key = {};
    state.locked = new Set();
    for (const letter of pickReveals(made.letters, REVEALS[level])) {
      state.key[letter] = made.inverse[letter];
      state.locked.add(letter);
    }
    state.hints = 0;
    state.record = false;
    state.previousBest = readBest(level);
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 200);
    state.sel = -1;
    buildBoard();
    els.start.textContent = "New sentence";
    const open = slots.findIndex((slot) => !state.locked.has(slot.letter));
    state.sel = open >= 0 ? open : 0;
    paint();
    const given = state.locked.size;
    const note = given
      ? `${given} ${given === 1 ? "letter is" : "letters are"} given and locked. `
      : "";
    setStatus(`${note}Select a coded letter and type what it stands for.`);
    slots[state.sel].el.focus();
  }

  function finish() {
    if (state.phase === "over") return;
    clearInterval(state.clock);
    state.phase = "over";
    state.elapsed = Date.now() - state.started;
    const clean = state.hints === 0;
    if (clean) {
      const previous = readBest(state.difficulty);
      if (!previous || state.elapsed < previous) {
        state.record = true;
        writeBest(state.difficulty, state.elapsed);
      }
    }
    const hintText = clean ? "no hints" : state.hints === 1 ? "1 hint" : `${state.hints} hints`;
    let text = `Decoded in ${formatTime(state.elapsed)} with ${hintText}.`;
    if (state.record) text += " New best.";
    else if (!clean) text += " A win with hints does not set a best.";
    els.summaryText.textContent = text;
    setStatus("Every letter is right. Message decoded.", "ok");
    paint();
    els.again.focus();
  }

  function onKey(event) {
    const dialog = document.querySelector(".settings");
    if (dialog && !dialog.hidden) return;
    if (!playing() || event.ctrlKey || event.metaKey || event.altKey) return;

    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      assign(event.key.toUpperCase());
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      erase();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveLetter(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveLetter(1);
    }
  }

  buildKeypad();
  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  els.hint.addEventListener("click", hint);
  els.erase.addEventListener("click", erase);
  els.clear.addEventListener("click", clearAll);
  document.addEventListener("keydown", onKey);

  setStatus(idleText());
  paint();
})();
