// ============================================================
// CCCC POLISH — app.js
// Variation A/B toggle. Adds keyboard shortcuts (A / B).
// ============================================================

(function () {
  const body = document.body;
  const buttons = document.querySelectorAll(".vbtn");

  function setVariation(v) {
    if (v !== "a" && v !== "b") return;
    body.setAttribute("data-variation", v);
    buttons.forEach((btn) => {
      const active = btn.dataset.variation === v;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setVariation(btn.dataset.variation));
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "a" || k === "b") setVariation(k);
  });
})();
