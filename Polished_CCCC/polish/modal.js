// ============================================================
// CCCC POLISH — modal.js
// Open/close the info modal. Renders a placeholder body for
// now; full category grid + grades land in the next turn.
// ============================================================

(function () {
  const trigger = document.getElementById("open-info-modal");
  const overlay = document.getElementById("info-modal");
  const closeBtn = document.getElementById("close-modal");
  const body = document.getElementById("modal-body");

  if (!trigger || !overlay || !closeBtn || !body) return;

  // full content data — mirrors the real index.html sections
  const CATEGORIES = [
    { key: "kufr",   ar: "كفريات",     en: "blasphemy", group: "theme",
      desc: "ترويج أو تشجيع على الكفر، سخرية من الأديان أو الإله، فلسفات وعقائد فاسدة." },
    { key: "sihr",   ar: "سحر",         en: "sorcery",   group: "theme",
      desc: "القوى والرموز والتعويذات المرتبطة بالسحر والتنجيم ورؤية المستقبل." },
    { key: "sex",    ar: "جنس",         en: "sexual",    group: "warning",
      desc: "مشاهد جنسية إيحائية أو مباشرة." },
    { key: "naked",  ar: "تعرّي",        en: "nudity",    group: "warning",
      desc: "ظهور أشخاص بجسد عاري كلياً أو جزئياً." },
    { key: "lgbt",   ar: "شذوذ",        en: "lgbt",      group: "warning",
      desc: "عرض وتمجيد العلاقات الجنسية المثليّة." },
    { key: "gore",   ar: "صادم",        en: "gore",      group: "warning",
      desc: "ظهور أشلاء وما يسبب الصدمات النفسية والتقزز للمشاهد." },
    { key: "vice",   ar: "مفاسد",       en: "vices",     group: "mechanic",
      desc: "ترويج أو تشجيع على القمار أو تعاطي المخدرات أو إظهارها بصفة إيجابية." },
    { key: "addict", ar: "إدمانيّات",    en: "addiction", group: "mechanic", gameOnly: true,
      desc: "(خاص للألعاب) مصممة للعودة المستمرة والمتابعة الدورية اليومية لتحقيق التقدم." },
    { key: "p2w",    ar: "تبذير",       en: "p2w",       group: "mechanic", gameOnly: true,
      desc: "(خاص للألعاب) مصممة لربط التقدم بالمال المنفق على أغراض داخل اللعبة." },
    { key: "loot",   ar: "قمار",        en: "lootbox",   group: "mechanic", gameOnly: true,
      desc: "(خاص للألعاب) مصممة لتشجيع شراء الصناديق ذات المحتوى العشوائي ونظام السحب." },
  ];

  const EXCEPTIONS = [
    { key: "music",  ar: "خال من الموسيقى",        en: "no music" },
    { key: "lang",   ar: "خال من الألفاظ النابية", en: "no profanity" },
    { key: "love",   ar: "خال من العلاقات الغرامية", en: "no romance" },
  ];

  const GRADES = [
    { sev: 1, ar: "الدرجة الأولى",  en: "level 1 · severe",
      story: "لا يمكن تخطي المحتوى دون التأثير على القصة. عدد مرات ظهور كثير، يفقد الفهم العام للقصة حين التخطي.",
      game:  "يستحيل إتمام اللعبة دون المرور عليه." },
    { sev: 2, ar: "الدرجة الثانية", en: "level 2 · moderate",
      story: "يمكن تخطي المحتوى دون التأثير على القصة. عدد مرّات ظهور كثير، يسبب انقطاعات متكررة في تسلسل العرض.",
      game:  "يصعّب إتمام اللعبة ويغيّر من تجربتها، لكن يمكن إتمامها بالكامل مع تخطّيه." },
    { sev: 3, ar: "الدرجة الثالثة", en: "level 3 · light",
      story: "يمكن تخطّي المحتوى دون التأثير على القصّة. ظهور قليل يمكن تخطيه بسهولة.",
      game:  "يمكن تجاهله أو استخدام طرق بديلة لإتمام اللعبة." },
  ];

  function renderCategory(c) {
    return `
      <div class="modal-item ${c.group}-card" data-group="${c.group}">
        <div class="modal-item__frame">
          <span class="modal-item__icon" data-group="${c.group}" aria-hidden="true">
            <span class="modal-item__icon-glyph"></span>
          </span>
        </div>
        <div class="item-text">
          <div class="item-text__head">
            <strong>${c.ar}</strong>
            <span class="item-text__en">${c.en}${c.gameOnly ? " · games" : ""}</span>
          </div>
          <p>${c.desc}</p>
        </div>
      </div>
    `;
  }

  function renderException(e) {
    return `
      <div class="modal-item mechanic-card except-card">
        <div class="modal-item__frame except-card__frame">
          <span class="modal-item__icon" data-group="mechanic" aria-hidden="true">
            <span class="modal-item__icon-glyph except-glyph"></span>
            <span class="except-slash" aria-hidden="true"></span>
          </span>
        </div>
        <div class="item-text">
          <div class="item-text__head">
            <strong>${e.ar}</strong>
            <span class="item-text__en">${e.en}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderGrade(g) {
    return `
      <div class="grade-card grade-sev-${g.sev}">
        <div class="grade-header">
          <div class="grade-badge grade-badge--sev-${g.sev}">${g.sev}</div>
          <div class="grade-title">
            <span class="grade-title__ar">${g.ar}</span>
            <span class="grade-title__en">${g.en}</span>
          </div>
        </div>
        <div class="grade-body">
          <div class="grade-desc">
            <div class="grade-desc-label">في القصصيّات <span class="grade-desc-label__en">stories</span></div>
            <p>${g.story}</p>
          </div>
          <div class="grade-desc">
            <div class="grade-desc-label">في الألعاب <span class="grade-desc-label__en">games</span></div>
            <p>${g.game}</p>
          </div>
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <section class="modal-section">
      <h3 class="modal-section__title">
        <span class="modal-section__title-ar">الموجودات</span>
        <span class="modal-section__title-en">categories</span>
      </h3>
      <div class="semantic-legend">
        <span class="legend-badge legend-badge--theme">
          <span class="legend-dot"></span>
          <span class="legend-badge__ar">محاذير عقدية وفكرية</span>
          <span class="legend-badge__en">doctrinal</span>
        </span>
        <span class="legend-badge legend-badge--warning">
          <span class="legend-dot"></span>
          <span class="legend-badge__ar">انحرافات أخلاقية وصادمة</span>
          <span class="legend-badge__en">moral</span>
        </span>
        <span class="legend-badge legend-badge--mechanic">
          <span class="legend-dot"></span>
          <span class="legend-badge__ar">استغلال مالي وسلوكي</span>
          <span class="legend-badge__en">behavioral</span>
        </span>
      </div>
      <div class="modal-grid">
        ${CATEGORIES.map(renderCategory).join("")}
      </div>
    </section>

    <section class="modal-section">
      <h3 class="modal-section__title">
        <span class="modal-section__title-ar">المستثنيات</span>
        <span class="modal-section__title-en">exceptions</span>
      </h3>
      <p class="exceptions-desc">يفترض التصنيف المحافظ أن جميع المحتويات الإبداعية تحتوي على الموسيقى والألفاظ النابية والعلاقات خارج إطار الزواج. عند خلو المحتوى منها، استخدم التالي:</p>
      <div class="modal-grid modal-grid--exceptions">
        ${EXCEPTIONS.map(renderException).join("")}
      </div>
    </section>

    <section class="modal-section">
      <h3 class="modal-section__title">
        <span class="modal-section__title-ar">القيم والدرجات</span>
        <span class="modal-section__title-en">grades</span>
      </h3>
      <div class="grades-container">
        ${GRADES.map(renderGrade).join("")}
      </div>
    </section>
  `;

  function open() {
    overlay.classList.remove("hidden", "is-closing");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeBtn.focus());
  }

  function close() {
    overlay.classList.add("is-closing");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("is-closing");
      document.body.style.overflow = "";
      trigger.focus();
    }, 200);
  }

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
  });
})();
