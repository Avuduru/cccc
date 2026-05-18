// ============================================================
// CCCC POLISH — controls.js
// Wires the type dropdown, segmented buttons, and badge toggles.
// Mirrors the real app's class behavior for visual fidelity.
// ============================================================

(function () {
  // ---- type dropdown (custom) ----
  const dd = document.getElementById("type-dropdown");
  if (dd) {
    const toggle = dd.querySelector(".dropdown-toggle");
    const txt = dd.querySelector(".dropdown-toggle__txt");
    const items = dd.querySelectorAll(".dropdown-item");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dd.classList.toggle("is-open");
    });

    items.forEach((item) => {
      item.addEventListener("click", () => {
        items.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        const ar = item.querySelector(".dropdown-item__ar");
        if (ar && txt) txt.textContent = ar.textContent;
        dd.classList.remove("is-open");
      });
    });

    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target)) dd.classList.remove("is-open");
    });
  }

  // ---- segmented groups ----
  function wireSeg(groupId, btnSel) {
    const grp = document.getElementById(groupId);
    if (!grp) return;
    grp.querySelectorAll(btnSel).forEach((btn) => {
      btn.addEventListener("click", () => {
        grp.querySelectorAll(btnSel).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  wireSeg("orient-group", ".orient-btn");
  wireSeg("size-group", ".size-btn");

  // ---- badge toggles ----
  const cloud = document.getElementById("badge-cloud");
  if (cloud) {
    cloud.querySelectorAll(".badge-tog").forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("is-on"));
    });
  }
})();
