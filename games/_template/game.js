(() => {
  "use strict";

  // Replace the id and fields with this game's own options.
  GameSettings.mount({
    id: "game-id",
    fields: [
      {
        id: "example",
        label: "Example option",
        hint: "Swap this for a setting that changes this game.",
        type: "toggle",
        default: true,
      },
    ],
  });

  const startBtn = document.getElementById("start-btn");

  startBtn.addEventListener("click", () => {
    // Game logic goes here.
  });
})();
