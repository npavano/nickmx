(function(){
  "use strict";

  const THEME_KEY = "mixtape_theme_v2";

  function $(sel, root = document){ return root.querySelector(sel); }
  function safeText(s){ return String(s ?? "").trim(); }
  function normalize(s){ return safeText(s).toLowerCase(); }

  function applyTheme(theme){
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    const btn = $("#themeToggle");
    if(btn) btn.textContent = t === "light" ? "☀️ Light" : "🌙 Dark";
  }

  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === "light" || saved === "dark"){
      applyTheme(saved);
      return;
    }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }

  function toast(msg){
    const el = $("#toast");
    if(!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = "none"; }, 1600);
  }

  function updateToTopVisibility(){
    const wrap = $("#toTopWrap");
    if(!wrap) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if(y > 220) wrap.classList.add("show");
    else wrap.classList.remove("show");
  }

  const coverCache = new Map();
  async function fetchSpotifyCover(spotifyUrl){
    const url = safeText(spotifyUrl);
    if(!url) return "";
    if(coverCache.has(url)) return coverCache.get(url);

    const oembed = "https://open.spotify.com/oembed?url=" + encodeURIComponent(url);
    try{
      const res = await fetch(oembed, { method: "GET" });
      if(!res.ok) throw new Error("oEmbed fetch failed");
      const data = await res.json();
      const thumb = safeText(data.thumbnail_url);
      coverCache.set(url, thumb);
      return thumb;
    }catch{
      coverCache.set(url, "");
      return "";
    }
  }

  function platformSvgSpotify(){
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M7 10c4-1 8-.5 11 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M7.5 13c3-1 6-.6 9 .8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M8 16c2-.6 4-.4 6 .5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    `;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function escapeAttr(s){
    return String(s).replaceAll('"', "&quot;");
  }

  async function hydrateCommunityCovers(items){
    for(const it of items){
      if(safeText(it.coverUrl)) continue;
      if(!safeText(it.spotify)) continue;
      const cover = await fetchSpotifyCover(it.spotify);
      if(cover) it.coverUrl = cover;
    }
  }

  function uniqueValues(items, key){
    const set = new Set();
    for(const it of items){
      const v = safeText(it[key]);
      if(v) set.add(v);
    }
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  function fillSelect(sel, values, placeholder){
    const el = $(sel);
    if(!el) return;
    const current = el.value;
    el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values.map(v => `<option>${escapeHtml(v)}</option>`).join("");
    if(values.includes(current)) el.value = current;
  }

  function itemMatches(it, filters){
    if(filters.q){
      const blob =
        normalize(it.title) + " " +
        normalize(it.description) + " " +
        normalize(it.genre) + " " +
        normalize(it.mood) + " " +
        normalize(it.activity);
      if(!blob.includes(filters.q)) return false;
    }
    if(filters.genre && safeText(it.genre) !== filters.genre) return false;
    if(filters.mood && safeText(it.mood) !== filters.mood) return false;
    if(filters.activity && safeText(it.activity) !== filters.activity) return false;
    return true;
  }

  function renderMixCard(it, { pinned = false } = {}){
    const cover = safeText(it.coverUrl);
    const art = cover
      ? `<img src="${escapeAttr(cover)}" alt="${escapeHtml(it.title)} cover art" loading="lazy" />`
      : `<div style="font-family:var(--mono); font-size:12px; color:var(--mut)">NO COVER</div>`;

    const tags = [it.genre, it.mood, it.activity].map(safeText).filter(Boolean).slice(0, 3);

    return `
      <div class="mixCard ${pinned ? "featurePinned" : ""}">
        <div class="mixArt">${art}</div>
        <div class="mixMeta">
          <h3>${escapeHtml(it.title)}</h3>
          <p>${escapeHtml(it.description || "")}</p>

          <div class="tagRow">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>

          <div class="cardLinks">
            ${it.spotify ? `
              <a class="iconLink spotify" href="${escapeAttr(it.spotify)}" target="_blank" rel="noopener" title="Spotify">
                ${platformSvgSpotify()}
                <span>Spotify</span>
              </a>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }

  async function initCommunityPage(){
    const mountFeatured = $("#communityFeatured");
    const mountGrid = $("#communityGrid");
    if(!mountFeatured || !mountGrid) return;

    let items = [];
    try{
      const res = await fetch("./data/community.json", { cache: "no-store" });
      items = await res.json();
      if(!Array.isArray(items)) items = [];
    }catch{
      items = [];
    }

    await hydrateCommunityCovers(items);

    fillSelect("#genreFilter", uniqueValues(items, "genre"), "All genres");
    fillSelect("#moodFilter", uniqueValues(items, "mood"), "All moods");
    fillSelect("#activityFilter", uniqueValues(items, "activity"), "All activities");

    function getFilters(){
      return {
        q: normalize($("#cq")?.value || ""),
        genre: safeText($("#genreFilter")?.value || ""),
        mood: safeText($("#moodFilter")?.value || ""),
        activity: safeText($("#activityFilter")?.value || "")
      };
    }

    function render(){
      const f = getFilters();

      const filtered = items.filter(it => itemMatches(it, f));
      const featured = filtered.filter(it => Boolean(it.featured)).slice(0, 4);
      const rest = filtered.filter(it => !it.featured);

      const countEl = $("#communityCount");
      if(countEl) countEl.textContent = String(filtered.length);

      mountFeatured.innerHTML = featured.length
        ? `<div class="grid2">${featured.map(it => renderMixCard(it, { pinned:true })).join("")}</div>`
        : `<p class="hint" style="padding:10px; margin:0">No spotlighted mixes match your filters.</p>`;

      mountGrid.innerHTML = rest.length
        ? `<div class="grid2">${rest.map(it => renderMixCard(it)).join("")}</div>`
        : `<p class="hint" style="padding:10px; margin:0">No community mixes match your filters.</p>`;
    }

    ["cq","genreFilter","moodFilter","activityFilter"].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    const clearBtn = $("#clearCommunityFilters");
    if(clearBtn){
      clearBtn.addEventListener("click", () => {
        const q = $("#cq"); if(q) q.value = "";
        const g = $("#genreFilter"); if(g) g.value = "";
        const m = $("#moodFilter"); if(m) m.value = "";
        const a = $("#activityFilter"); if(a) a.value = "";
        render();
        toast("Cleared");
      });
    }

    render();
  }

  function initCommon(){
    initTheme();

    const themeBtn = $("#themeToggle");
    if(themeBtn){
      themeBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }

    const toTopBtn = $("#toTopBtn");
    if(toTopBtn){
      toTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      window.addEventListener("scroll", updateToTopVisibility, { passive:true });
      updateToTopVisibility();
    }
  }

  window.MixesApp = { initCommon, initCommunityPage, toast };
})();