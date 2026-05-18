// ============================================================
// CCCC POLISH — search.js
// Mock search results with keyboard nav (↑ ↓ Esc Enter).
// In the real app, api.js fetches from proxy.php; here we
// preview the dropdown chrome only.
// ============================================================

(function () {
  const wrapper = document.getElementById("search-demo");
  if (!wrapper) return;

  const input = wrapper.querySelector("#search-query");
  const list = wrapper.querySelector("#search-results");

  const MOCK = [
    { title: "Naruto",                year: 2002, type: "anime", score: "8.4" },
    { title: "Naruto: Shippuden",     year: 2007, type: "anime", score: "8.7" },
    { title: "Boruto: Naruto Next",   year: 2017, type: "anime", score: "5.9" },
    { title: "Attack on Titan",       year: 2013, type: "anime", score: "9.0" },
    { title: "Death Note",            year: 2006, type: "anime", score: "8.6" },
    { title: "One Piece",             year: 1999, type: "anime", score: "8.9" },
    { title: "Demon Slayer",          year: 2019, type: "anime", score: "8.5" },
  ];

  let focusIdx = -1;
  let timer;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) return close();
    showLoading();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const hits = MOCK.filter((m) => m.title.toLowerCase().includes(q));
      render(hits);
    }, 280);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) render(filter(input.value));
  });

  input.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll(".search-result")];
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); move(items, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(items, -1); }
    else if (e.key === "Escape") close();
    else if (e.key === "Enter" && focusIdx >= 0) {
      e.preventDefault();
      pick(items[focusIdx]);
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) close();
  });

  function filter(q) {
    q = q.trim().toLowerCase();
    return MOCK.filter((m) => m.title.toLowerCase().includes(q));
  }

  function showLoading() {
    list.classList.add("is-open");
    list.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="search-result is-loading">
        <div class="search-result__poster"></div>
        <div class="search-result__body">
          <div class="search-result__title"></div>
          <div class="search-result__sub"></div>
        </div>
        <div class="search-result__score"></div>
      </div>
    `).join("");
  }

  function render(hits) {
    if (!hits.length) {
      list.classList.add("is-open");
      list.innerHTML = `
        <div class="search-result" style="cursor:default">
          <div class="search-result__poster">—</div>
          <div class="search-result__body">
            <div class="search-result__title">لا نتائج</div>
            <div class="search-result__sub">no results</div>
          </div>
        </div>`;
      focusIdx = -1;
      return;
    }
    list.classList.add("is-open");
    list.innerHTML = hits.map((m) => `
      <div class="search-result" data-title="${m.title}">
        <div class="search-result__poster">${m.type.slice(0,3)}</div>
        <div class="search-result__body">
          <div class="search-result__title">${m.title}</div>
          <div class="search-result__sub">
            <span class="search-result__year">${m.year}</span>
            <span class="search-result__type">${m.type}</span>
          </div>
        </div>
        <div class="search-result__score">${m.score}</div>
      </div>
    `).join("");
    focusIdx = -1;
    list.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("click", () => pick(el));
    });
  }

  function move(items, dir) {
    if (focusIdx >= 0) items[focusIdx].classList.remove("is-focus");
    focusIdx = (focusIdx + dir + items.length) % items.length;
    items[focusIdx].classList.add("is-focus");
    items[focusIdx].scrollIntoView({ block: "nearest" });
  }

  function pick(el) {
    if (!el || !el.dataset.title) return;
    input.value = el.dataset.title;
    close();
  }

  function close() {
    list.classList.remove("is-open");
    focusIdx = -1;
  }
})();
