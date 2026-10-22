/* Per-game settings. Each game calls GameSettings.mount() with its own fields. */
(() => {
  "use strict";

  const GEAR = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;

  function storageKey(id) {
    return `mental-game.${id}.settings`;
  }

  function readSaved(id) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(id)) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeSaved(id, values) {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(values));
    } catch {
      /* storage blocked — settings still apply for this visit */
    }
  }

  function accepted(field, raw) {
    if (field.type === "toggle") return typeof raw === "boolean" ? raw : field.default;
    if (field.type === "choice" && field.options.some((option) => option.value === raw)) return raw;
    if (field.type === "range") {
      const numeric = Number(raw);
      const min = Number(field.min);
      const max = Number(field.max);
      const step = Number(field.step) || 1;
      if (!Number.isFinite(numeric) || !Number.isFinite(min) || !Number.isFinite(max)) return String(field.default);
      const clamped = Math.min(max, Math.max(min, numeric));
      const snapped = min + Math.round((clamped - min) / step) * step;
      return String(Math.min(max, Math.max(min, snapped)));
    }
    return field.default;
  }

  function optionsFor(field) {
    if (field.type === "toggle") {
      return [
        { value: true, label: "On" },
        { value: false, label: "Off" },
      ];
    }
    return field.options;
  }

  function mount({ id, fields, onChange }) {
    const slot = document.querySelector("[data-game-settings]");
    if (!slot) throw new Error("GameSettings.mount needs a [data-game-settings] element");
    if (!id || !Array.isArray(fields)) throw new Error("GameSettings.mount needs an id and fields");

    const saved = readSaved(id);
    const values = {};
    for (const field of fields) values[field.id] = accepted(field, saved[field.id]);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "icon-btn";
    openButton.setAttribute("aria-label", "Settings");
    openButton.setAttribute("aria-haspopup", "dialog");
    openButton.setAttribute("aria-expanded", "false");
    openButton.innerHTML = GEAR;

    const overlay = document.createElement("div");
    overlay.className = "settings";
    overlay.hidden = true;

    const panel = document.createElement("div");
    panel.id = "game-settings-dialog";
    panel.className = "settings__panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "game-settings-title");

    const header = document.createElement("div");
    header.className = "settings__header";
    const heading = document.createElement("h2");
    heading.id = "game-settings-title";
    heading.textContent = "Settings";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "icon-btn";
    closeButton.setAttribute("aria-label", "Close settings");
    closeButton.textContent = "×";
    header.append(heading, closeButton);

    const form = document.createElement("div");
    form.className = "settings__fields";
    if (fields.length === 0) {
      const empty = document.createElement("p");
      empty.className = "settings__hint";
      empty.textContent = "This game has no settings yet.";
      form.append(empty);
    }

    const note = document.createElement("p");
    note.className = "settings__hint";
    note.textContent = "Saved on this device. Each game keeps its own settings.";

    panel.append(header, form, note);
    overlay.append(panel);
    slot.replaceChildren(openButton);
    document.body.append(overlay);
    openButton.setAttribute("aria-controls", panel.id);

    let previousFocus = null;

    function notify() {
      writeSaved(id, values);
      if (typeof onChange === "function") onChange({ ...values });
    }

    function renderFields() {
      form.replaceChildren();
      if (fields.length === 0) {
        const empty = document.createElement("p");
        empty.className = "settings__hint";
        empty.textContent = "This game has no settings yet.";
        form.append(empty);
        return;
      }

      for (const field of fields) {
        const block = document.createElement("div");
        block.className = "settings__field";

        const label = document.createElement("p");
        label.className = "label";
        label.id = `setting-${id}-${field.id}-label`;
        label.textContent = field.label;

        block.append(label);
        if (field.hint) {
          const hint = document.createElement("p");
          hint.className = "settings__hint";
          hint.textContent = field.hint;
          block.append(hint);
        }

        if (field.type === "range") {
          const row = document.createElement("div");
          row.className = "settings__range";
          const slider = document.createElement("input");
          slider.type = "range";
          slider.min = String(field.min);
          slider.max = String(field.max);
          slider.step = String(field.step || 1);
          slider.value = String(values[field.id]);
          slider.setAttribute("aria-labelledby", label.id);
          const readout = document.createElement("span");
          readout.className = "settings__value";
          readout.textContent = String(values[field.id]);
          slider.addEventListener("input", () => {
            values[field.id] = slider.value;
            readout.textContent = slider.value;
            notify();
          });
          row.append(slider, readout);
          block.append(row);
          form.append(block);
          continue;
        }

        const choices = document.createElement("div");
        choices.className = "settings__choices";
        choices.setAttribute("role", "group");
        choices.setAttribute("aria-labelledby", label.id);

        for (const option of optionsFor(field)) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip";
          chip.textContent = option.label;
          chip.setAttribute("aria-pressed", String(values[field.id] === option.value));
          chip.addEventListener("click", () => {
            if (values[field.id] === option.value) return;
            values[field.id] = option.value;
            for (const btn of choices.querySelectorAll(".chip")) {
              btn.setAttribute("aria-pressed", String(btn === chip));
            }
            notify();
          });
          choices.append(chip);
        }

        block.append(choices);
        form.append(block);
      }
    }

    function focusable() {
      return [...panel.querySelectorAll("button, [href], input, select, textarea")].filter(
        (el) => !el.hidden && el.getAttribute("aria-disabled") !== "true"
      );
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const page = document.querySelector("main");

    function open() {
      renderFields();
      overlay.hidden = false;
      if (page) page.inert = true;
      openButton.setAttribute("aria-expanded", "true");
      previousFocus = document.activeElement;
      document.addEventListener("keydown", onKey);
      closeButton.focus();
    }

    function close() {
      if (overlay.hidden) return;
      overlay.hidden = true;
      if (page) page.inert = false;
      openButton.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKey);
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      else openButton.focus();
    }

    openButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    return {
      get values() {
        return { ...values };
      },
    };
  }

  window.GameSettings = { mount };
})();
