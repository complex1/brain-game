(() => {
  "use strict";

  const CATALOG_URL = "data/games.json";
  const ALL = "All";

  const els = {
    search: document.getElementById("search-input"),
    filters: document.getElementById("tag-filters"),
    grid: document.getElementById("game-grid"),
    meta: document.getElementById("results-meta"),
    empty: document.getElementById("empty-state"),
  };

  const state = {
    games: [],
    query: "",
    activeTag: ALL,
  };

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function searchableText(game) {
    return normalize([game.name, game.tag, game.description, ...(game.tags || [])].join(" "));
  }

  function matches(game) {
    if (state.activeTag !== ALL && game.tag !== state.activeTag) return false;
    if (!state.query) return true;
    const haystack = game._search;
    return state.query.split(/\s+/).every((term) => haystack.includes(term));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCard(game) {
    const playable = game.status === "live";

    const item = el("li");
    const card = el("article", playable ? "card card--interactive" : "card");

    const header = el("div", "card__header");
    header.append(el("span", "badge badge--accent", game.tag));
    if (game.difficulty) {
      header.append(el("span", `badge badge--${game.difficulty}`, game.difficulty));
    }

    const title = el("h3", "card__title");
    if (playable) {
      const link = el("a", "card__link", game.name);
      link.href = game.path;
      title.append(link);
    } else {
      title.textContent = game.name;
    }

    const body = el("p", "card__body", game.description);

    const meta = el("div", "card__meta");
    (game.tags || []).forEach((t) => meta.append(el("span", "badge", `#${t}`)));

    const footer = el("div", "card__footer");
    footer.append(
      el("span", "label", game.durationMinutes ? `~${game.durationMinutes} min` : ""),
      el(
        "span",
        playable ? "btn btn--primary" : "btn btn--ghost",
        playable ? "Play" : "Coming soon"
      )
    );
    if (!playable) footer.lastChild.setAttribute("aria-disabled", "true");

    card.append(header, title, body, meta, footer);
    item.append(card);
    return item;
  }

  function renderFilters() {
    const tags = [ALL, ...new Set(state.games.map((g) => g.tag))];
    els.filters.replaceChildren(
      ...tags.map((tag) => {
        const chip = el("button", "chip", tag);
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(tag === state.activeTag));
        chip.addEventListener("click", () => {
          state.activeTag = tag;
          renderFilters();
          renderGrid();
        });
        return chip;
      })
    );
  }

  function renderGrid() {
    const visible = state.games.filter(matches);
    els.grid.replaceChildren(...visible.map(renderCard));
    els.empty.hidden = visible.length > 0;
    els.meta.textContent = `${visible.length} of ${state.games.length} games`;
  }

  function showError(message) {
    els.empty.hidden = false;
    els.empty.querySelector("h2").textContent = "Couldn't load the catalog";
    els.empty.querySelector("p").textContent = message;
  }

  async function init() {
    try {
      const res = await fetch(CATALOG_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.games = (data.games || []).map((g) => ({ ...g, _search: searchableText(g) }));
    } catch (err) {
      console.error(err);
      showError("Serve the project over HTTP (see README) — browsers block fetch() on file:// URLs.");
      return;
    }

    renderFilters();
    renderGrid();

    els.search.addEventListener("input", (e) => {
      state.query = normalize(e.target.value);
      renderGrid();
    });

    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        els.search.focus();
      } else if (e.key === "Escape" && document.activeElement === els.search) {
        els.search.value = "";
        state.query = "";
        renderGrid();
      }
    });
  }

  init();
})();
