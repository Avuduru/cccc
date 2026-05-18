// ============================================================
// CCCC POLISH — sliders.js
// Renders the 10 Mawjoodat rating rows. Pure markup for now;
// drag/snap/transitions land in chunk 4.
// ============================================================

(function () {
  // mirrors CATEGORIES.Mawjoodat from the real app, with group tags
  // for color-coding in the info modal (chunk 9). Game-only categories
  // are flagged but still rendered here for preview purposes.
  const CATEGORIES = [
    { key: "kufr",     ar: "كفريات",      en: "blasphemy",  group: "doctrinal" },
    { key: "sihr",     ar: "سحر",         en: "sorcery",    group: "doctrinal" },
    { key: "sex",      ar: "جنس",         en: "sexual",     group: "moral" },
    { key: "naked",    ar: "تعرّي",        en: "nudity",     group: "moral" },
    { key: "lgbt",     ar: "شذوذ",        en: "lgbt",       group: "moral" },
    { key: "gore",     ar: "صادم",        en: "gore",       group: "moral" },
    { key: "vice",     ar: "مفاسد",       en: "vices",      group: "behavior" },
    { key: "addict",   ar: "إدمانيّات",    en: "addiction",  group: "behavior", gameOnly: true },
    { key: "p2w",      ar: "تبذير",       en: "p2w",        group: "behavior", gameOnly: true },
    { key: "loot",     ar: "قمار",        en: "lootbox",    group: "behavior", gameOnly: true },
  ];

  // severity 1=red(left) 2=orange 3=yellow 0=off(right) — RTL
  // visually we lay out 4 segments LTR in source order: 1,2,3,0
  // and let dir=rtl flip them so 1 sits on the LEFT edge.
  const SEGMENTS = [
    { sev: 1, label: "1" },
    { sev: 2, label: "2" },
    { sev: 3, label: "3" },
    { sev: 0, label: "—" },
  ];

  // demo: pre-pick a level per row so you can see all states
  const DEMO_LEVELS = {
    kufr: 1, sihr: 0, sex: 2, naked: 3, lgbt: 0,
    gore: 1, vice: 2, addict: 3, p2w: 0, loot: 1,
  };

  function renderRow(cat) {
    const active = DEMO_LEVELS[cat.key] ?? 0;
    const segs = SEGMENTS.map((s) => {
      const isActive = s.sev === active;
      return `
        <button type="button"
                class="seg seg--sev-${s.sev} ${isActive ? "is-active" : ""}"
                data-sev="${s.sev}"
                aria-label="severity ${s.label}">
          <span class="seg__dot"></span>
        </button>
      `;
    }).join("");

    return `
      <div class="srow" data-key="${cat.key}" data-group="${cat.group}" data-active="${active}">
        <div class="srow__label">
          <span class="srow__ar">${cat.ar}</span>
          <span class="srow__en">${cat.en}</span>
        </div>
        <div class="srow__track" role="radiogroup" aria-label="${cat.en}">
          <div class="srow__rail"></div>
          <div class="srow__fill" data-fill></div>
          ${segs}
        </div>
        <div class="srow__readout" data-readout>${active === 0 ? "—" : active}</div>
      </div>
    `;
  }

  const root = document.getElementById("sliders");
  if (root) {
    root.innerHTML = CATEGORIES.map(renderRow).join("");
    wireInteraction(root);
  }

  // ============================================================
  // interaction: click a segment, or drag the track. RTL aware:
  // segment 0 in source order is sev 1 (left visual edge).
  // ============================================================
  function wireInteraction(scope) {
    scope.querySelectorAll(".srow").forEach((row) => {
      const track = row.querySelector(".srow__track");
      const segs = [...row.querySelectorAll(".seg")];
      const readout = row.querySelector("[data-readout]");

      // click → snap
      segs.forEach((seg) => {
        seg.addEventListener("click", () => {
          const sev = Number(seg.dataset.sev);
          setLevel(row, sev, segs, readout);
        });
      });

      // drag → snap to nearest segment under pointer
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        const rect = track.getBoundingClientRect();
        // RTL: leftmost = sev 1, rightmost = sev 0. Map x to index.
        const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
        // 4 buckets: [0..0.25)=sev1, [0.25..0.5)=sev2, [0.5..0.75)=sev3, [0.75..1]=sev0
        const idx = Math.min(3, Math.floor(ratio * 4));
        const sev = [1, 2, 3, 0][idx];
        setLevel(row, sev, segs, readout, true);
      };
      const onUp = () => {
        dragging = false;
        track.classList.remove("is-dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };
      const onDown = (e) => {
        // ignore clicks on the segment buttons themselves — they handle it
        if (e.target.closest(".seg")) return;
        dragging = true;
        track.classList.add("is-dragging");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove, { passive: true });
        document.addEventListener("touchend", onUp);
        onMove(e);
      };
      track.addEventListener("mousedown", onDown);
      track.addEventListener("touchstart", onDown, { passive: true });
    });
  }

  function setLevel(row, sev, segs, readout, isDrag) {
    const current = Number(row.dataset.active);
    if (current === sev) return;
    row.dataset.active = String(sev);
    segs.forEach((s) => {
      s.classList.toggle("is-active", Number(s.dataset.sev) === sev);
    });
    if (readout) readout.textContent = sev === 0 ? "—" : String(sev);
    // tiny haptic-style flash on click (not drag, would be too noisy)
    if (!isDrag) {
      row.classList.add("is-flash");
      setTimeout(() => row.classList.remove("is-flash"), 240);
    }
  }
})();
