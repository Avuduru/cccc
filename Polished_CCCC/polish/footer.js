// ============================================================
// CCCC POLISH — footer.js
// Tiny demo: clicking copy/export plays the success flash.
// In the real app, export.js handles this; here we just preview.
// ============================================================

(function () {
  const footer = document.getElementById("footer-demo");
  if (!footer) return;

  footer.querySelectorAll(".cf-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.remove("is-success");
      // force reflow so the animation re-plays
      void btn.offsetWidth;
      btn.classList.add("is-success");
    });
  });
})();
