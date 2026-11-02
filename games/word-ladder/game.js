(() => {
  "use strict";

  const WORDS = {
    3: "CAT COT COG DOG DIG WIG WIT WET BET BAT CAR BAR BAN BIN BIT CAP MAP MOP TOP TAP TIP TIE LIE PIE PIN PAN PAT PET SUN RUN RUB ROB ROT RAT SIN SIT SAT MEN MET MAT TEN TIN DEN PEN HEN RED BED ROD BAG RAG BIG FIG FIT FAT SKY SLY SAY CRY DRY DAY TRY TOY TON BOY BAY RAY RAN WIN WON SON FUN FAN GUN GUT CUT GET GOT NOT NET SET LET LOT LIT LID DID LED HID HIT HAT HAD BAD CUP PUP BUG HUG HUT MUG TUG TUB CUB TAB TAG JAM JAR HAM LOW LAW SAW BOW COW ROW RAW NOW OWL OIL NIL NIP FLY FRY GAP GAS WAS WAR HAS HIS HIM DIM DAM RAM RIP RAP SIP SAP SAD POT PIT PUT".split(" "),
    4: "CARE BARE BARN BORN BURN TURN TERN TERM TEAM TEAR BEAR BEAM SEAM SEAT BEAT BELT BOLT BALL FALL FILL FILE FIRE FIRM FORM FORK PORK PORT PART PARK DARK DARE DATE LATE LAKE LIKE LINE LANE LAND SAND BAND BOND BONE CONE CORE CORD CARD CART CAST CASE CAVE CODE NODE NOTE NOSE ROSE LOSE LOSS LESS REST RENT WENT WANT WAND WIND WILD MILD MILK SILK SELL TELL TALL TALK WALK WALL WELL WILL COLD HOLD HOLD GOLD FOLD FOND FONT BENT SENT LENT LEND TEND TENT TEST REST BEST BEAT MEAT MEAN MEAL SEAL SELL TELL TALL CALL CALM PALM BALM BALD BOLD COLD".split(" "),
  };
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function wordSet(length) {
    return new Set(WORDS[length]);
  }

  function neighbors(word, words) {
    const next = [];
    for (let i = 0; i < word.length; i += 1) {
      for (const letter of LETTERS) {
        if (letter === word[i]) continue;
        const candidate = `${word.slice(0, i)}${letter}${word.slice(i + 1)}`;
        if (words.has(candidate)) next.push(candidate);
      }
    }
    return next;
  }

  function distances(start, words) {
    const dist = new Map([[start, 0]]);
    const queue = [start];
    while (queue.length) {
      const word = queue.shift();
      neighbors(word, words).forEach((next) => {
        if (dist.has(next)) return;
        dist.set(next, dist.get(word) + 1);
        queue.push(next);
      });
    }
    return dist;
  }

  function findPuzzle(length) {
    const words = wordSet(length);
    const list = [...words];
    for (let guard = 0; guard < 40; guard += 1) {
      const start = list[Math.floor(Math.random() * list.length)];
      const dist = distances(start, words);
      const goals = [...dist.entries()].filter((entry) => entry[1] === 3).map((entry) => entry[0]);
      if (!goals.length) continue;
      return { start, goal: goals[Math.floor(Math.random() * goals.length)], distance: 3 };
    }
    return null;
  }

  if (typeof document === "undefined") {
    globalThis.__wordLadder = { findPuzzle, distances, WORDS };
    return;
  }

  const BEST_PREFIX = "mental-game.word-ladder.best";
  const settings = GameSettings.mount({
    id: "word-ladder",
    fields: [
      {
        id: "length",
        label: "Word length",
        hint: "Applies the next time you press Start.",
        type: "choice",
        default: "3",
        options: [
          { value: "3", label: "3 letters" },
          { value: "4", label: "4 letters" },
        ],
      },
    ],
    onChange() {
      if (state.phase === "idle") setStatus(`Press Start. Next ladder: ${length()} letters.`);
    },
  });

  const els = {
    steps: document.getElementById("steps"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    status: document.getElementById("status"),
    goal: document.getElementById("goal"),
    word: document.getElementById("word"),
    alphabet: document.getElementById("alphabet"),
    start: document.getElementById("start-btn"),
    summary: document.getElementById("summary"),
    summaryText: document.getElementById("summary-text"),
    again: document.getElementById("again-btn"),
  };
  const state = { phase: "idle", words: new Set(), current: "", goal: "", slot: null, steps: 0, started: 0, elapsed: 0, clock: 0, record: false };

  function length() { return Number(settings.values.length) === 4 ? 4 : 3; }
  function readBest() {
    const value = Number(localStorage.getItem(`${BEST_PREFIX}.${length()}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function writeBest(value) {
    try { localStorage.setItem(`${BEST_PREFIX}.${length()}`, String(value)); } catch { /* storage blocked */ }
  }
  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-bad", kind === "bad");
  }
  function paintHud() {
    els.steps.textContent = String(state.steps);
    els.time.textContent = formatTime(state.elapsed);
    const best = readBest();
    els.best.textContent = best ? formatTime(best) : "—";
  }
  function render() {
    els.goal.textContent = state.goal ? `Goal · ${state.goal}` : "Goal · —";
    els.word.replaceChildren();
    state.current.split("").forEach((letter, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot";
      if (state.slot === index) button.classList.add("is-picked");
      button.textContent = letter;
      button.disabled = state.phase !== "play";
      button.setAttribute("aria-label", `Letter ${index + 1}, ${letter}`);
      button.setAttribute("aria-pressed", state.slot === index ? "true" : "false");
      button.addEventListener("click", () => {
        state.slot = state.slot === index ? null : index;
        render();
      });
      els.word.append(button);
    });
    els.alphabet.hidden = state.phase !== "play" || state.slot === null;
    els.alphabet.replaceChildren();
    if (!els.alphabet.hidden) {
      for (const letter of LETTERS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "alpha";
        button.textContent = letter;
        button.addEventListener("click", () => change(letter));
        els.alphabet.append(button);
      }
    }
    paintHud();
  }
  function change(letter) {
    if (state.phase !== "play" || state.slot === null || letter === state.current[state.slot]) return;
    const next = `${state.current.slice(0, state.slot)}${letter}${state.current.slice(state.slot + 1)}`;
    if (!state.words.has(next)) {
      setStatus("Not a word.", "bad");
      return;
    }
    state.current = next;
    state.steps += 1;
    state.slot = null;
    if (next === state.goal) finish();
    else {
      setStatus("One letter changed.");
      render();
    }
  }
  function tick() {
    state.elapsed = Date.now() - state.started;
    els.time.textContent = formatTime(state.elapsed);
  }
  function begin() {
    clearInterval(state.clock);
    const puzzle = findPuzzle(length());
    if (!puzzle) {
      setStatus("Couldn't build a ladder. Try again.", "bad");
      return;
    }
    state.words = wordSet(length());
    state.current = puzzle.start;
    state.goal = puzzle.goal;
    state.slot = null;
    state.steps = 0;
    state.record = false;
    state.phase = "play";
    state.started = Date.now();
    state.elapsed = 0;
    state.clock = setInterval(tick, 200);
    els.summary.hidden = true;
    els.start.hidden = true;
    setStatus(`${puzzle.start} to ${puzzle.goal}. Three steps are enough.`);
    render();
  }
  function finish() {
    clearInterval(state.clock);
    state.phase = "over";
    state.elapsed = Date.now() - state.started;
    const previous = readBest();
    if (!previous || state.elapsed < previous) {
      state.record = true;
      writeBest(state.elapsed);
    }
    setStatus("The goal word is reached.", "ok");
    els.summaryText.textContent = state.record
      ? `Reached ${state.goal} in ${state.steps} steps and ${formatTime(state.elapsed)}. New best.`
      : `Reached ${state.goal} in ${state.steps} steps and ${formatTime(state.elapsed)}.`;
    els.summary.hidden = false;
    render();
  }

  els.start.addEventListener("click", begin);
  els.again.addEventListener("click", begin);
  setStatus(`Press Start. Next ladder: ${length()} letters.`);
  paintHud();
})();
