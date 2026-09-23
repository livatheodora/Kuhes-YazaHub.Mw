/* =========================================================
   KUHeS Yaza — app.js
   This app is backed by FIVE separate Supabase projects
   (free tier = 1GB storage each -> ~5GB combined). Fill in
   all 10 blanks below before deploying. See SETUP.md for the
   five schemas + storage buckets each project needs.
   ========================================================= */

const CONFIG = {
  // DB 1 - Resources (primary): documents / PPTX / DOCX / YouTube links
  resourcesA: {
    url: "https://crhgdlfgsdtxjcrqpceo.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyaGdkbGZnc2R0eGpjcnFwY2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzEzNTcsImV4cCI6MjEwMDUwNzM1N30.kNbDcorCh2d2_aTQbIf_wVd5115xoRY4CWkMkZ9oiZs",
  },
  // DB 2 - Resources (overflow): identical schema to DB 1. New documents
  // alternate between DB 1 and DB 2 automatically to spread storage load.
  resourcesB: {
    url: "https://ufzhwbalbewmaqcsqdrx.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmemh3YmFsYmV3bWFxY3NxZHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzAxOTUsImV4cCI6MjEwMDUwNjE5NX0.QN7onOSoWWZ9Vwd45cKTdnvdER9VAGeCXuWKIHa2UN8",
  },
  // DB 3 - Marketplace: listings + item photos
  market: {
    url: "https://axoaujikwxgeodpmwjid.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4b2F1amlrd3hnZW9kcG13amlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA1NTAsImV4cCI6MjEwMDUwNjU1MH0.fiJNgBWmL23J3MtFgNbpWhJxB1PqdkkHDyGr2lD_seI",
  },
  // DB 4 - E-Diagnosis: admin-curated disease / signs & symptoms dataset
  diagnosis: {
    url: "https://klzdjdiutlmvgtzkpzzf.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsemRqZGl1dGxtdmd0emtwenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA2MzMsImV4cCI6MjEwMDUwNjYzM30.yPf01NAB6xjPHyxusPMT49xj24vskYaXPN4Qr5zuzLg",
  },
  // DB 5 - Announcements: admin posts shown on the homepage
  announcements: {
    url: "https://tqvqbjbpzwzwgxezxpej.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxdnFiamJwend6d2d4ZXp4cGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA4ODQsImV4cCI6MjEwMDUwNjg4NH0.cibu20Ce5ziNI0Ur2uUvRO4DEobzPZPhrhfm8PIbbO4",
  },
  // OneSignal App ID (public — safe to ship, this is not a secret key).
  // Get this from onesignal.com after creating a free Web Push app.
  // See SETUP.md section 9.
  oneSignalAppId: "b9e73806-094d-4cf5-9556-8bc272dec753",
};

const sbResA = window.supabase.createClient(CONFIG.resourcesA.url, CONFIG.resourcesA.key);
const sbResB = window.supabase.createClient(CONFIG.resourcesB.url, CONFIG.resourcesB.key);
const sbMarket = window.supabase.createClient(CONFIG.market.url, CONFIG.market.key);
const sbDiag = window.supabase.createClient(CONFIG.diagnosis.url, CONFIG.diagnosis.key);
const sbAnnounce = window.supabase.createClient(CONFIG.announcements.url, CONFIG.announcements.key);

const RESOURCE_BUCKET = "resources"; // must exist in BOTH resourcesA and resourcesB projects

// ---------- Gemini (via Netlify function — key stays server-side) ----------
async function askGemini(promptText) {
  const res = await fetch("/.netlify/functions/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: promptText }] }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}). ${body.slice(0, 150)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("AI returned an empty response.");
  return text;
}

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- OneSignal (push notification delivery — see SETUP.md §9) ----------
if (CONFIG.oneSignalAppId && CONFIG.oneSignalAppId !== "YOUR_ONESIGNAL_APP_ID") {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: CONFIG.oneSignalAppId,
      // Reuse our own sw.js (which imports OneSignal's worker script) instead
      // of letting OneSignal register a second service worker at the root.
      serviceWorkerPath: "sw.js",
      serviceWorkerParam: { scope: "/" },
    });
  });
}

// ---------- State ----------
let allResources = [];
let allListings = [];
let allDiseases = [];
let allAnnouncements = [];
let activeCategory = "all";
let activeType = "all";
let activeProgramme = localStorage.getItem("yaza-programme") || "";
let chosenFile = null;
let resourceMode = "document"; // 'document' | 'youtube'

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = "toast " + type;
  toast.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.style.display = "none"), 3200);
}

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }

$$("[data-close]").forEach((btn) =>
  btn.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").classList.add("hidden");
  })
);
$$(".modal-overlay").forEach((overlay) =>
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  })
);

function fileExtType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["ppt", "pptx"].includes(ext)) return "pptx";
  if (["doc", "docx"].includes(ext)) return "docx";
  return ext;
}

function youtubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else if (u.pathname.includes("/embed/")) return url;
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- PDF cover thumbnails (first page, rendered on-device) ----------
// A resource card used to show a flat "PDF" icon for every document. This
// renders the document's actual first page instead — like a real book
// cover — the same way we render pages in the in-app reader. Generated
// lazily (only when a card scrolls into view) and cached in localStorage
// so we don't re-render every time the feed loads.
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}
const PDF_COVER_PREFIX = "yaza-cover-";

function getCachedCover(id) {
  try {
    return localStorage.getItem(PDF_COVER_PREFIX + id);
  } catch {
    return null;
  }
}
function setCachedCover(id, dataUrl) {
  try {
    localStorage.setItem(PDF_COVER_PREFIX + id, dataUrl);
  } catch {
    /* storage full or unavailable — cover just regenerates next time */
  }
}

async function renderPdfCoverDataUrl(url, targetWidth = 220) {
  const doc = await pdfjsLib.getDocument({ url }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}

let coverObserver = null;
function observeCoverThumb(el) {
  if (!window.pdfjsLib) return; // library failed to load — keep the icon fallback
  if (!coverObserver) {
    coverObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          coverObserver.unobserve(entry.target);
          generateAndApplyCover(entry.target);
        });
      },
      { rootMargin: "200px" }
    );
  }
  coverObserver.observe(el);
}

async function generateAndApplyCover(thumbEl) {
  const id = thumbEl.dataset.resId;
  const url = thumbEl.dataset.pdfUrl;
  if (!id || !url) return;
  try {
    const dataUrl = await renderPdfCoverDataUrl(url);
    setCachedCover(id, dataUrl);
    // The card may have been re-rendered (search/filter) since we started —
    // only touch it if it's still in the DOM.
    const live = document.getElementById("res-thumb-" + id);
    if (live) live.innerHTML = `<img class="res-thumb-cover" src="${dataUrl}" alt="">`;
  } catch {
    /* leave the icon fallback in place — some files (scans, odd encodings)
       won't render client-side, and that's fine, it's just a cover image */
  }
}

// ---------- Theme ----------
const themeToggle = $("#themeToggle");
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("yaza-theme", theme);
}
applyTheme(localStorage.getItem("yaza-theme") || "dark");
themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// ---------- Bottom nav: Home / Market / About ----------
$("#navHome").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#navMarket").addEventListener("click", () => {
  window.location.href = "market-page.html";
});
const marketStatTile = $("#marketStatTile");
if (marketStatTile) marketStatTile.addEventListener("click", () => (window.location.href = "market-page.html"));

// ---------- Logo double-click -> admin ----------
$("#logoBtn").addEventListener("dblclick", () => {
  window.location.href = "admin.html";
});

// ---------- Splash screen ----------
function hideSplash() {
  const splash = $("#splashScreen");
  if (splash) splash.classList.add("hide");
}
window.addEventListener("load", () => setTimeout(hideSplash, 600));
setTimeout(hideSplash, 3000); // safety net

// ---------- Install app prompt ----------
let deferredInstallPrompt = null;
const installBanner = $("#installBanner");

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function installDismissed() {
  return localStorage.getItem("yaza-install-dismissed") === "true";
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isStandalone() && !installDismissed()) {
    installBanner.classList.remove("hidden");
  }
});

window.addEventListener("appinstalled", () => {
  installBanner.classList.add("hidden");
  deferredInstallPrompt = null;
  showToast("KUHeS Yaza installed! Find it on your home screen.");
});

$("#installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.classList.add("hidden");
});

$("#installDismiss").addEventListener("click", () => {
  installBanner.classList.add("hidden");
  localStorage.setItem("yaza-install-dismissed", "true");
});

if (isIOS() && !isStandalone() && !installDismissed()) {
  installBanner.classList.remove("hidden");
  installBanner.querySelector(".install-banner-text").innerHTML =
    "<strong>Install KUHeS Yaza</strong>Tap the Share icon, then \u201cAdd to Home Screen.\u201d";
  $("#installBtn").classList.add("hidden");
}

// ---------- About ----------
$("#navAbout").addEventListener("click", () => {
  window.location.href = "about-page.html";
});

// ---------- Refresh ----------
$("#refreshBtn").addEventListener("click", () => {
  fetchResources();
  fetchListings();
  fetchAnnouncements();
  checkNotifications();
});

// ---------- Diagnosis links ----------
const diagStatTile = $("#diagStatTile");
if (diagStatTile) diagStatTile.addEventListener("click", () => (window.location.href = "diagnosis.html"));
const diagBanner = $("#diagnosisBanner");
if (diagBanner) diagBanner.addEventListener("click", () => (window.location.href = "diagnosis.html"));

// ---------- Stream links ----------
const streamStatTile = $("#streamStatTile");
if (streamStatTile) streamStatTile.addEventListener("click", () => (window.location.href = "stream-page.html"));
const streamBanner = $("#streamBanner");
if (streamBanner) streamBanner.addEventListener("click", () => (window.location.href = "stream-page.html"));

// ---------- Connect links ----------
const connectStatTile = $("#connectStatTile");
if (connectStatTile) connectStatTile.addEventListener("click", () => (window.location.href = "connect-page.html"));
const connectBanner = $("#connectBanner");
if (connectBanner) connectBanner.addEventListener("click", () => (window.location.href = "connect-page.html"));

// =========================================================
// RESOURCES (Browse) — merged from DB1 (resourcesA) + DB2 (resourcesB)
// =========================================================
async function fetchResources() {
  const [a, b] = await Promise.all([
    sbResA.from("resources").select("*").eq("status", "active").order("created_at", { ascending: false }),
    sbResB.from("resources").select("*").eq("status", "active").order("created_at", { ascending: false }),
  ]);

  if (a.error && b.error) {
    console.error(a.error, b.error);
    $("#feed").innerHTML = emptyState("Couldn't load resources", "Check your connection and try again.");
    return;
  }

  const fromA = (a.data || []).map((r) => ({ ...r, _src: "A" }));
  const fromB = (b.data || []).map((r) => ({ ...r, _src: "B" }));
  allResources = [...fromA, ...fromB].sort(
    (x, y) => new Date(y.created_at) - new Date(x.created_at)
  );
  updateStats();
  renderResources();
  checkNotifications();
}

function sbFor(src) {
  return src === "B" ? sbResB : sbResA;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><h3>${title}</h3><p>${sub}</p></div>`;
}

function renderResources() {
  const term = $("#searchInput").value.trim().toLowerCase();
  let filtered = allResources.filter((r) => {
    const matchesTerm =
      !term ||
      r.title.toLowerCase().includes(term) ||
      (r.programme || "").toLowerCase().includes(term) ||
      (r.category || "").toLowerCase().includes(term);
    const matchesCat = activeCategory === "all" || r.category === activeCategory;
    const matchesType =
      activeType === "all" ||
      (activeType === "youtube" ? r.type === "youtube" : r.file_type === activeType);
    const matchesProgramme = !activeProgramme || r.programme === activeProgramme;
    return matchesTerm && matchesCat && matchesType && matchesProgramme;
  });

  // Rank: title-starts-with beats title-contains beats programme/category match,
  // then fall back to newest first.
  if (term) {
    filtered = filtered
      .map((r) => {
        const title = r.title.toLowerCase();
        let score = 3;
        if (title.startsWith(term)) score = 0;
        else if (title.includes(term)) score = 1;
        else score = 2;
        return { r, score };
      })
      .sort((a, b) => a.score - b.score || new Date(b.r.created_at) - new Date(a.r.created_at))
      .map((x) => x.r);
  }

  if (filtered.length === 0) {
    $("#feed").innerHTML = emptyState(
      "Palibe kanthu pano yet",
      "Nothing matches that filter yet — try a different search, or be the first to share it."
    );
    return;
  }

  $("#feed").innerHTML = filtered.map(resourceCardHTML).join("");

  filtered.forEach((r) => {
    const card = document.getElementById("res-" + r.id);
    if (card) card.addEventListener("click", (e) => {
      if (e.target.closest(".card-share-btn")) return;
      openViewer(r);
    });
    const dlBtn = document.getElementById("dl-" + r.id);
    if (dlBtn) {
      dlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (r.type === "youtube") openViewer(r);
        else promptDownload(r);
      });
    }
    const shareBtn = document.getElementById("share-" + r.id);
    if (shareBtn) {
      shareBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        shareItem(r.title, r.url);
      });
    }
  });

  $$("#feed .res-thumb[data-pdf-url]").forEach(observeCoverThumb);
}

const RES_THUMB_ICON = { pdf: ICON("fileText", {size:32}), pptx: ICON("barChart", {size:32}), docx: ICON("file", {size:32}), youtube: ICON("film", {size:32}) };
const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "aac"];
AUDIO_EXTS.forEach((ext) => { RES_THUMB_ICON[ext] = ICON("music", {size:32}); });
function isAudioResource(r) { return !!r.file_type && AUDIO_EXTS.includes(r.file_type); }

function youtubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/embed\/([^/?]+)/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

function resourceThumbHTML(r) {
  const isYoutube = r.type === "youtube";

  // Videos get a real cover — the actual YouTube thumbnail image.
  if (isYoutube) {
    const vid = youtubeVideoId(r.url);
    if (vid) {
      return `<img src="https://img.youtube.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy"
                onerror="this.remove()">
               <span class="res-thumb-glyph" style="position:absolute;z-index:1;">${ICON("film",{size:32})}</span>`;
    }
  }

  // PDFs: use the document's own first page as its cover once we've
  // rendered/cached it (see observeCoverThumb). Until then, fall through
  // to the icon-based "book cover" look below.
  if (r.file_type === "pdf") {
    const cached = getCachedCover(r.id);
    if (cached) return `<img class="res-thumb-cover" src="${cached}" alt="">`;
  }

  // Documents don't have a stored cover image, so build an attractive
  // "book cover" look instead of a flat icon: big glyph + file-type tag.
  const thumbIcon = RES_THUMB_ICON[isYoutube ? "youtube" : r.file_type] || ICON("folder", {size:32});
  const typeLabel = isYoutube ? "VIDEO" : (r.file_type || "FILE").toUpperCase();
  return `<span class="res-thumb-glyph">${thumbIcon}</span><span class="res-thumb-type">${typeLabel}</span>`;
}

function resourceCardHTML(r) {
  const isYoutube = r.type === "youtube";
  const badgeLabel = isYoutube ? "VIDEO" : (r.file_type || "FILE").toUpperCase();
  const needsCover = r.file_type === "pdf" && !getCachedCover(r.id);
  const thumbAttrs = needsCover ? ` data-res-id="${r.id}" data-pdf-url="${escapeHTML(r.url)}"` : "";
  return `
    <div class="res-card" data-cat="${escapeHTML(r.category || "Other")}" id="res-${r.id}">
      <div class="res-card-top">
        <span class="res-cat-label">${escapeHTML(r.category || badgeLabel)}</span>
        <span class="badge" style="background:rgba(47,174,107,.15);color:var(--success)">FREE</span>
      </div>
      <div class="res-thumb" id="res-thumb-${r.id}"${thumbAttrs}>${resourceThumbHTML(r)}</div>
      <div class="res-title">${escapeHTML(r.title)}</div>
      <div class="res-meta">
        ${r.verified ? `<span class="badge verified" title="Verified by admin">${ICON("check",{size:11})} Verified</span>` : ""}
        ${r.programme ? `<span>${escapeHTML(r.programme)}</span>` : ""}
        ${r.year ? `<span>${escapeHTML(r.year)}</span>` : ""}
      </div>
      <div class="res-card-footer">
        <span class="res-views">${ICON("eye",{size:13})} ${r.views || 0} view${r.views === 1 ? "" : "s"}</span>
        <button class="card-share-btn" id="share-${r.id}" aria-label="Share" title="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
      </div>
      <button class="card-download-btn-full" id="dl-${r.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
        ${isYoutube ? "Watch" : "Download"}
      </button>
    </div>`;
}

function updateStats() {
  $("#statResources").textContent = allResources.length;
  const programmeSet = new Set(allResources.map((r) => r.programme).filter(Boolean));
  $("#statProgrammes").textContent = programmeSet.size;
  $("#statListings").textContent = allListings.length;
  const diagStat = $("#statDiagnosis");
  if (diagStat) diagStat.textContent = allDiseases.length;
  const streamStat = $("#statStream");
  if (streamStat) streamStat.textContent = allResources.filter((r) => r.type === "youtube" || isAudioResource(r)).length;
}

// Filters — chip rows scroll continuously and repeat their button list once
// for a seamless loop, so every click updates ALL matching chips (both
// copies) but only the first copy needs a listener attached.
const categoryChipCount = 6; // All, Past Paper, Notes, Textbook, Research, Other
const typeChipCount = 5; // All types, PDF, PPTX, Word, Video

$$("#categoryChips .chip").forEach((chip, i) => {
  if (i >= categoryChipCount) return;
  chip.addEventListener("click", () => {
    $$("#categoryChips .chip").forEach((c) => c.classList.remove("active"));
    $$(`#categoryChips .chip[data-cat="${CSS.escape(chip.dataset.cat)}"]`).forEach((c) => c.classList.add("active"));
    activeCategory = chip.dataset.cat;
    renderResources();
  });
});
$$("#typeChips .chip").forEach((chip, i) => {
  if (i >= typeChipCount) return;
  chip.addEventListener("click", () => {
    $$("#typeChips .chip").forEach((c) => c.classList.remove("active"));
    $$(`#typeChips .chip[data-type="${CSS.escape(chip.dataset.type)}"]`).forEach((c) => c.classList.add("active"));
    activeType = chip.dataset.type;
    renderResources();
  });
});
let searchDebounce;
$("#searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(renderResources, 150);
});
function focusSearch() {
  const row = $("#browsePanel .search-row");
  if (row) {
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("pulse");
    setTimeout(() => row.classList.remove("pulse"), 900);
  }
  setTimeout(() => $("#searchInput").focus(), 250);
}
$("#navSearchBtn").addEventListener("click", focusSearch);
$$(".search-row .search-icon").forEach((icon) =>
  icon.addEventListener("click", () => {
    const input = icon.closest(".search-row").querySelector("input");
    if (input) input.focus();
  })
);

// ---------- Programme quick-pick ----------
const myProgrammeSelect = $("#myProgramme");
if (myProgrammeSelect) {
  myProgrammeSelect.value = activeProgramme;
  myProgrammeSelect.addEventListener("change", () => {
    activeProgramme = myProgrammeSelect.value;
    localStorage.setItem("yaza-programme", activeProgramme);
    renderResources();
  });
}

// ---------- Share / report ----------
async function shareItem(title, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch {
      /* user cancelled — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard");
  } catch {
    showToast("Couldn't share — copy the link manually", "error");
  }
}

async function submitReport(itemType, itemId, itemTitle, reason) {
  const { error } = await sbMarket.from("reports").insert([{
    item_type: itemType, item_id: String(itemId), item_title: itemTitle, reason,
  }]);
  if (error) {
    showToast("Couldn't send report: " + error.message, "error");
    return;
  }
  showToast("Thanks — report sent to admin.");
}

// ---------- Viewer ----------
function openViewer(r) {
  $("#viewerTitle").textContent = r.title;
  let body = "";
  if (r.type === "youtube") {
    body = `<iframe src="${youtubeEmbedUrl(r.url)}" allowfullscreen></iframe>`;
  } else if (r.file_type === "pdf") {
    // Rendered ourselves onto a canvas (see setupPdfReader below) — this is
    // what actually opens the document inside the app on phones. Pointing
    // an iframe straight at the raw file used to make mobile browsers treat
    // it as a download instead of a preview.
    body = `
      <div class="pdf-reader" id="pdfReader">
        <div class="pdf-reader-canvas-wrap" id="pdfCanvasWrap">
          <canvas id="pdfCanvas"></canvas>
          <div class="pdf-reader-loading" id="pdfLoading">Opening document…</div>
        </div>
        <div class="pdf-reader-nav">
          <button id="pdfPrev" aria-label="Previous page">‹</button>
          <span id="pdfPageIndicator">–</span>
          <button id="pdfNext" aria-label="Next page">›</button>
        </div>
      </div>`;
  } else if (r.file_type === "pptx") {
    // Rendered ourselves on a canvas via PptxViewJS — no Microsoft Office
    // Online iframe involved, so nothing here depends on an external site
    // being reachable/willing to embed our file.
    body = `
      <div class="pptx-reader" id="pptxReader">
        <div class="pptx-reader-canvas-wrap" id="pptxCanvasWrap">
          <canvas id="pptxCanvas"></canvas>
          <div class="pdf-reader-loading" id="pptxLoading">Opening presentation…</div>
        </div>
        <div class="pdf-reader-nav">
          <button id="pptxPrev" aria-label="Previous slide">‹</button>
          <span id="pptxPageIndicator">–</span>
          <button id="pptxNext" aria-label="Next slide">›</button>
        </div>
      </div>`;
  } else if (r.file_type === "docx") {
    // Rendered ourselves via mammoth.js (docx -> HTML) — same reasoning as
    // pptx above: fully in-app, no external viewer dependency.
    body = `
      <div class="docx-reader" id="docxReader">
        <div class="docx-content" id="docxContent">
          <div class="pdf-reader-loading" id="docxLoading">Opening document…</div>
        </div>
      </div>`;
  } else if (isAudioResource(r)) {
    body = `
      <div class="audio-reader">
        <div class="audio-reader-art">${ICON("music", {size:56})}</div>
        <audio controls autoplay style="width:100%;margin-top:18px;" src="${escapeHTML(r.url)}"></audio>
      </div>`;
  } else if (r.isLocalFile) {
    // Opened via the OS "Open with → KUHeS Yaza" flow, and it's a type we
    // don't have an in-app renderer for — offer the local copy back out.
    body = `<div class="empty-state"><h3>Preview unavailable for this file type</h3><p>KUHeS Yaza can open PDF, PPTX and DOCX files directly. For ${escapeHTML((r.file_type || "this").toUpperCase())} files, use the button below to open it in another app.</p></div>`;
  } else {
    body = `<div class="empty-state"><h3>Preview unavailable</h3><p><a href="${r.url}" target="_blank" style="color:var(--gold)">Open the file directly</a></p></div>`;
  }
  $("#viewerBody").innerHTML = body;
  if (r.file_type === "pdf") setupPdfReader(r.isLocalFile ? r.localArrayBuffer : r.url);
  if (r.file_type === "pptx") setupPptxReader(r.isLocalFile ? r.localFile : r.url);
  if (r.file_type === "docx") setupDocxReader(r.isLocalFile ? r.localFile : r.url);

  const downloadBtn = $("#viewerDownload");
  const shareBtn = $("#viewerShare");
  const reportBtn = $("#viewerReport");

  if (r.isLocalFile) {
    // Local file: no server copy to fetch, no report-to-admin target, and
    // sharing (if supported) hands the in-memory file back out again.
    downloadBtn.classList.remove("hidden");
    downloadBtn.textContent = "Open in another app";
    downloadBtn.onclick = () => openLocalFileExternally(r);
    shareBtn.onclick = async () => {
      if (navigator.canShare && navigator.canShare({ files: [r.localFile] })) {
        try {
          await navigator.share({ files: [r.localFile], title: r.title });
        } catch {
          /* user cancelled */
        }
      } else {
        openLocalFileExternally(r);
      }
    };
    reportBtn.classList.add("hidden");
    setupViewerAi(null); // no metadata to ground an AI answer in
    openModal("#viewerModal");
    return; // nothing to log server-side for a local file
  }

  downloadBtn.classList.toggle("hidden", r.type === "youtube");
  downloadBtn.textContent = "Download";
  downloadBtn.onclick = () => promptDownload(r);
  reportBtn.classList.remove("hidden");

  shareBtn.onclick = () => shareItem(r.title, r.url);
  reportBtn.onclick = () => {
    const reason = prompt("What's the issue with this resource? (e.g. wrong file, offensive, spam)");
    if (reason && reason.trim()) submitReport("resource", r.id, r.title, reason.trim());
  };

  setupViewerAi(r);

  openModal("#viewerModal");
  incrementViews(sbFor(r._src), "resources", r.id, r);
}

// Hand a locally-opened file back to the OS so the phone's own "Open with"
// chooser can offer a native app (Word, PowerPoint, another PDF app, etc).
function openLocalFileExternally(r) {
  const blobUrl = URL.createObjectURL(r.localFile);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = r.localFile.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

// ---------- In-app PDF reader (page-by-page, rendered on-device) ----------
// `source` is either a hosted URL string (normal library resources) or
// an ArrayBuffer (a file opened locally via the OS "Open with" flow — see
// setupFileHandlerLaunch below), so pdf.js can render both the same way.
let pdfReaderState = { doc: null, page: 1, rendering: false, source: null };

async function setupPdfReader(source) {
  const wrap = $("#pdfCanvasWrap");
  const canvas = $("#pdfCanvas");
  const loading = $("#pdfLoading");
  const indicator = $("#pdfPageIndicator");
  const prevBtn = $("#pdfPrev");
  const nextBtn = $("#pdfNext");
  pdfReaderState = { doc: null, page: 1, rendering: false, source };
  const isLocal = source instanceof ArrayBuffer;
  const fallbackHref = isLocal ? null : source;

  if (!window.pdfjsLib) {
    loading.innerHTML = fallbackHref
      ? `Couldn't load the reader. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Open the file directly</a> instead.`
      : `Couldn't load the reader for this file.`;
    return;
  }

  async function renderPdfPage(num) {
    if (!pdfReaderState.doc || pdfReaderState.rendering || pdfReaderState.source !== source) return;
    pdfReaderState.rendering = true;
    try {
      const page = await pdfReaderState.doc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      const containerWidth = Math.max(wrap.clientWidth - 28, 240);
      const viewport = page.getViewport({ scale: containerWidth / base.width });
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      pdfReaderState.page = num;
      indicator.textContent = `${num} / ${pdfReaderState.doc.numPages}`;
      prevBtn.disabled = num <= 1;
      nextBtn.disabled = num >= pdfReaderState.doc.numPages;
    } finally {
      pdfReaderState.rendering = false;
    }
  }

  prevBtn.onclick = () => renderPdfPage(Math.max(1, pdfReaderState.page - 1));
  nextBtn.onclick = () =>
    renderPdfPage(Math.min(pdfReaderState.doc ? pdfReaderState.doc.numPages : 1, pdfReaderState.page + 1));

  // Swipe left/right to turn pages on touch devices.
  let touchStartX = null;
  wrap.ontouchstart = (e) => (touchStartX = e.touches[0].clientX);
  wrap.ontouchend = (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) nextBtn.click();
    else prevBtn.click();
  };

  try {
    const loadingTask = isLocal ? pdfjsLib.getDocument({ data: source }) : pdfjsLib.getDocument({ url: source });
    const doc = await loadingTask.promise;
    if (pdfReaderState.source !== source) return; // viewer was closed/switched while loading
    pdfReaderState.doc = doc;
    loading.classList.add("hidden");
    await renderPdfPage(1);
  } catch {
    loading.innerHTML = fallbackHref
      ? `Couldn't open this document. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Try opening it directly</a>.`
      : `Couldn't open this document — it may be corrupted or password-protected.`;
  }
}

// ---------- In-app PPTX reader (canvas, via PptxViewJS — no Office iframe) ----------
let pptxReaderState = { source: null };

async function setupPptxReader(source) {
  const wrap = $("#pptxCanvasWrap");
  const canvas = $("#pptxCanvas");
  const loading = $("#pptxLoading");
  const indicator = $("#pptxPageIndicator");
  const prevBtn = $("#pptxPrev");
  const nextBtn = $("#pptxNext");
  pptxReaderState = { source };
  const isFile = source instanceof File;
  const fallbackHref = isFile ? null : source;

  if (!window.PptxViewJS) {
    loading.innerHTML = fallbackHref
      ? `Couldn't load the reader. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Open the file directly</a> instead.`
      : `Couldn't load the reader for this file.`;
    return;
  }

  try {
    const viewer = new PptxViewJS.PPTXViewer({ canvas });
    viewer.on("slideChanged", (index) => {
      if (pptxReaderState.source !== source) return;
      indicator.textContent = `${index + 1} / ${pptxReaderState.slideCount || "?"}`;
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = pptxReaderState.slideCount ? index >= pptxReaderState.slideCount - 1 : false;
    });
    viewer.on("loadComplete", ({ slideCount }) => {
      if (pptxReaderState.source !== source) return;
      pptxReaderState.slideCount = slideCount;
      viewer.render(canvas);
    });

    if (isFile) await viewer.loadFile(source);
    else await viewer.loadFromUrl(source);
    if (pptxReaderState.source !== source) return; // viewer closed/switched mid-load

    loading.classList.add("hidden");
    prevBtn.onclick = () => viewer.previousSlide(canvas);
    nextBtn.onclick = () => viewer.nextSlide(canvas);

    let touchStartX = null;
    wrap.ontouchstart = (e) => (touchStartX = e.touches[0].clientX);
    wrap.ontouchend = (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) nextBtn.click();
      else prevBtn.click();
    };
  } catch {
    loading.innerHTML = fallbackHref
      ? `Couldn't open this presentation. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Try opening it directly</a>.`
      : `Couldn't open this presentation — it may be corrupted.`;
  }
}

// ---------- In-app DOCX reader (docx -> HTML via mammoth.js) ----------
let docxReaderState = { source: null };

async function setupDocxReader(source) {
  const container = $("#docxContent");
  const loading = $("#docxLoading");
  docxReaderState = { source };
  const isFile = source instanceof File;
  const fallbackHref = isFile ? null : source;

  if (!window.mammoth) {
    loading.innerHTML = fallbackHref
      ? `Couldn't load the reader. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Open the file directly</a> instead.`
      : `Couldn't load the reader for this file.`;
    return;
  }

  try {
    const arrayBuffer = isFile ? await source.arrayBuffer() : await (await fetch(source)).arrayBuffer();
    if (docxReaderState.source !== source) return; // viewer closed/switched mid-load
    const result = await mammoth.convertToHtml({ arrayBuffer });
    if (docxReaderState.source !== source) return;
    container.innerHTML = result.value || "<p>This document appears to be empty.</p>";
  } catch {
    loading.innerHTML = fallbackHref
      ? `Couldn't open this document. <a href="${fallbackHref}" target="_blank" style="color:var(--gold)">Try opening it directly</a>.`
      : `Couldn't open this document — it may be corrupted.`;
  }
}

// ---------- Ask AI about this document ----------
function setupViewerAi(r) {
  const modal = $("#viewerModal .modal-full");
  const panel = $("#viewerAiPanel");
  const thread = $("#viewerAiThread");
  const input = $("#viewerAiInput");
  const askBtn = $("#viewerAskAi");
  const sendBtn = $("#viewerAiSend");

  thread.innerHTML = "";
  panel.classList.add("hidden");
  if (modal) modal.classList.remove("ai-panel-open");
  input.value = "";

  if (!r) {
    // Local file opened via "Open with" — no title/metadata to ground an
    // AI answer in, so hide the entry point entirely rather than show it
    // and fail on first use.
    askBtn.classList.add("hidden");
    askBtn.onclick = null;
    return;
  }
  askBtn.classList.remove("hidden");

  askBtn.onclick = () => {
    const nowOpen = panel.classList.toggle("hidden");
    if (modal) modal.classList.toggle("ai-panel-open", !nowOpen);
    if (!nowOpen) input.focus();
  };

  function addMsg(role, text) {
    const div = document.createElement("div");
    div.className = "ai-doc-msg " + role;
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
    return div;
  }

  async function send() {
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    addMsg("user", question);
    const loadingMsg = addMsg("ai", "Thinking…");
    sendBtn.disabled = true;
    try {
      const context =
        `Resource title: "${r.title}". Type: ${r.type === "youtube" ? "YouTube video" : (r.file_type || "document")}. ` +
        `Programme: ${r.programme || "unspecified"}. Category: ${r.category || "unspecified"}. Year of study: ${r.year || "unspecified"}.`;
      const prompt =
        `You are a study helper inside a Malawian health-sciences resource-sharing app called KUHeS Yaza. ` +
        `A student is looking at this shared resource:\n${context}\n\n` +
        `You cannot open or read the actual file, only its title and metadata above. The student asks: "${question}"\n` +
        `Answer helpfully and honestly using only the title/metadata as context. If the question needs the actual file content, ` +
        `say plainly that you can only go by the title and details shown, then still give your best general guidance on the likely topic. ` +
        `Keep the answer under 120 words, plain text, no markdown symbols.`;
      const text = await askGemini(prompt);
      loadingMsg.textContent = text;
    } catch (err) {
      loadingMsg.textContent = err.message;
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.onclick = send;
  input.onkeydown = (e) => {
    if (e.key === "Enter") send();
  };
}

async function incrementViews(db, table, id, localRow) {
  const nextViews = (localRow.views || 0) + 1;
  localRow.views = nextViews; // optimistic local update
  const { error } = await db.from(table).update({ views: nextViews }).eq("id", id);
  if (error) console.warn("Couldn't record view:", error.message);
}

function resourceFileName(r) {
  const safeTitle = (r.title || "resource").replace(/[\\/:*?"<>|]+/g, " ").trim();
  const ext = r.file_type ? "." + r.file_type : "";
  return ext && !safeTitle.toLowerCase().endsWith(ext) ? safeTitle + ext : safeTitle;
}

function ensureExtension(name, ext) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  if (!ext) return trimmed;
  return trimmed.toLowerCase().endsWith("." + ext) ? trimmed : trimmed + "." + ext;
}

// Asks the student what to name the file before downloading it, so it's
// easy to find again on their phone afterwards.
function promptDownload(r) {
  if (r.type === "youtube" || !r.url) return;
  const input = $("#saveAsInput");
  const hint = $("#saveAsHint");
  input.value = resourceFileName(r);
  hint.textContent = window.showSaveFilePicker
    ? "You'll be able to pick a folder and rename it on the next screen."
    : "This is the name you'll see when you look for it on your phone.";
  openModal("#saveAsModal");
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  input.onkeydown = (e) => {
    if (e.key === "Enter") $("#saveAsConfirm").click();
  };

  $("#saveAsConfirm").onclick = async () => {
    const chosen = ensureExtension(input.value, r.file_type);
    if (!chosen) {
      showToast("Give the file a name first.", "error");
      return;
    }
    closeModal("#saveAsModal");
    await downloadResource(r, chosen);
  };
}

async function downloadResource(r, filename) {
  if (r.type === "youtube" || !r.url) return;
  filename = filename || resourceFileName(r);

  // Desktop browsers that support the File System Access API (Chrome,
  // Edge) get a genuine "Save As" dialog — the student picks the folder
  // and can rename the file right there.
  if (window.showSaveFilePicker) {
    try {
      showToast("Preparing download…");
      const res = await fetch(r.url);
      if (!res.ok) throw new Error("Network error");
      const blob = await res.blob();
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast("Saved.");
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // student cancelled the picker
      console.warn("Save As picker failed, falling back to a normal download:", err);
      // fall through to the standard download below
    }
  }

  // Phones, and any browser without the picker: trigger a normal download
  // using the name the student chose in the "Save file as" prompt — that's
  // the only naming control the platform gives a website on mobile.
  try {
    showToast("Preparing download…");
    const res = await fetch(r.url);
    if (!res.ok) throw new Error("Network error");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    showToast("Download started.");
  } catch (err) {
    console.error(err);
    // Fallback: open the file directly so the user can save it manually
    window.open(r.url, "_blank");
  }
}

// =========================================================
// UPLOAD FLOW
// =========================================================
$("#fabUpload").addEventListener("click", () => openModal("#uploadPickerModal"));

$("#pickDocument").addEventListener("click", () => {
  closeModal("#uploadPickerModal");
  resourceMode = "document";
  $("#resourceModalTitle").textContent = "Upload a Document";
  $("#dropZone").classList.remove("hidden");
  $("#youtubeField").classList.add("hidden");
  resetResourceForm();
  $("#dropZone").querySelector("p").innerHTML = 'Drag &amp; drop a PDF, PPTX or Word file<br><span class="muted-text">or click to browse</span>';
  openModal("#resourceModal");
});

$("#pickYoutube").addEventListener("click", () => {
  closeModal("#uploadPickerModal");
  resourceMode = "youtube";
  $("#resourceModalTitle").textContent = "Share a YouTube Link";
  $("#dropZone").classList.add("hidden");
  $("#youtubeField").classList.remove("hidden");
  resetResourceForm();
  openModal("#resourceModal");
});

$("#pickAudio").addEventListener("click", () => {
  closeModal("#uploadPickerModal");
  resourceMode = "document";
  $("#resourceModalTitle").textContent = "Upload Audio";
  $("#dropZone").classList.remove("hidden");
  $("#youtubeField").classList.add("hidden");
  resetResourceForm();
  $("#dropZone").querySelector("p").innerHTML = 'Drag &amp; drop an audio file<br><span class="muted-text">MP3, WAV, M4A, OGG or click to browse</span>';
  openModal("#resourceModal");
});

function resetResourceForm() {
  chosenFile = null;
  $("#fileChosen").classList.add("hidden");
  $("#fileChosen").textContent = "";
  $("#progressBarWrap").classList.add("hidden");
  $("#progress").style.width = "0%";
  $("#resTitle").value = "";
  $("#resProgramme").value = "";
  $("#resProgrammeOther").value = "";
  $("#resProgrammeOther").classList.add("hidden");
  $("#resYear").value = "";
  $("#resCategory").value = "Notes";
  $("#youtubeUrl").value = "";
}

$("#resProgramme").addEventListener("change", () => {
  $("#resProgrammeOther").classList.toggle("hidden", $("#resProgramme").value !== "__other");
});

// Drag & drop
const dropZone = $("#dropZone");
const fileInput = $("#fileInput");
dropZone.addEventListener("click", (e) => {
  if (e.target.tagName !== "INPUT") fileInput.click();
});
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFileChosen(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFileChosen(fileInput.files[0]);
});

function handleFileChosen(file) {
  const validExt = ["pdf", "ppt", "pptx", "doc", "docx", ...AUDIO_EXTS];
  const ext = file.name.split(".").pop().toLowerCase();
  if (!validExt.includes(ext)) {
    showToast("Please choose a PDF, PPTX, Word or audio file", "error");
    return;
  }
  chosenFile = file;
  $("#fileChosen").innerHTML = ICON("paperclip", {size:13}) + " " + escapeHTML(file.name);
  $("#fileChosen").classList.remove("hidden");
  if (!$("#resTitle").value) {
    $("#resTitle").value = file.name.replace(/\.[^/.]+$/, "");
  }
}

$("#publishBtn").addEventListener("click", async () => {
  const title = $("#resTitle").value.trim();
  const programme =
    $("#resProgramme").value === "__other"
      ? $("#resProgrammeOther").value.trim()
      : $("#resProgramme").value;
  const year = $("#resYear").value;
  const category = $("#resCategory").value;

  if (!title) return showToast("Please add a title", "error");
  if (!programme) return showToast("Please select a programme", "error");
  if (!year) return showToast("Please select the year of study", "error");

  if (resourceMode === "document") {
    if (!chosenFile) return showToast("Please choose a file", "error");
    await uploadDocument({ title, programme, year, category });
  } else {
    const url = $("#youtubeUrl").value.trim();
    if (!url) return showToast("Please paste a YouTube URL", "error");
    // YouTube links carry no file weight, so they always go to DB1 for simplicity.
    await publishResource(sbResA, { title, programme, year, category, type: "youtube", file_type: null, url });
  }
});

// Pick whichever resource DB currently holds fewer items, so storage use
// stays roughly balanced between the two accounts as the collection grows.
function pickResourceDb() {
  const countA = allResources.filter((r) => r._src === "A").length;
  const countB = allResources.filter((r) => r._src === "B").length;
  return countB < countA ? sbResB : sbResA;
}

async function uploadDocument({ title, programme, year, category }) {
  const btn = $("#publishBtn");
  btn.disabled = true;
  $("#progressBarWrap").classList.remove("hidden");
  $("#progress").style.width = "10%";

  try {
    const targetDb = pickResourceDb();
    const ext = chosenFile.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await targetDb.storage
      .from(RESOURCE_BUCKET)
      .upload(path, chosenFile, { cacheControl: "3600", upsert: false });

    if (uploadError) throw uploadError;
    $("#progress").style.width = "70%";

    const { data: publicUrlData } = targetDb.storage.from(RESOURCE_BUCKET).getPublicUrl(path);

    await publishResource(targetDb, {
      title, programme, year, category,
      type: "document",
      file_type: fileExtType(chosenFile.name),
      url: publicUrlData.publicUrl,
    });
    $("#progress").style.width = "100%";
  } catch (err) {
    console.error(err);
    showToast("Upload failed: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function publishResource(db, fields) {
  const { error } = await db.from("resources").insert([{ ...fields, status: "active" }]);
  if (error) {
    showToast("Couldn't publish: " + error.message, "error");
    return;
  }
  showToast("Resource shared successfully!");
  closeModal("#resourceModal");
  fetchResources();
}

// =========================================================
// MARKETPLACE — the browsing/selling UI now lives entirely on
// market-page.html. index.html only needs the listing count, for the
// homepage stat tile and the notification bell feed.
// =========================================================
async function fetchListings() {
  const { data, error } = await sbMarket
    .from("market_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  allListings = data || [];
  updateStats();
  checkNotifications();
}

// =========================================================
// ANNOUNCEMENTS (homepage slideshow: live admin posts, or a
// Chichewa fallback when there are none). One slide shown at a
// time with prev/next chevrons + tappable dots.
// =========================================================
const FALLBACK_SLIDES = [
  "Mwambi wathu walero nawu; Yalo ndi khumbo lafinali",
  "Mwambi wathu walero nawu; Nkhwezi zikadwala sidzimwa pelencilin",
];
let announceSlideIndex = 0;
let announceSlideTimer = null;

async function fetchAnnouncements() {
  const nowIso = new Date().toISOString();
  const { data, error } = await sbAnnounce
    .from("announcements")
    .select("*")
    .lte("start_at", nowIso)
    .gt("expire_at", nowIso)
    .order("start_at", { ascending: false });

  if (error) {
    console.error(error);
    allAnnouncements = [];
  } else {
    allAnnouncements = data || [];
  }
  announceSlideIndex = 0;
  renderAnnouncementBox();
}

function announceSlideHTML(isLive, slide) {
  if (isLive) {
    return `
      <div class="announce-card">
        <div class="announce-top">
          <span class="badge">${ICON("megaphone",{size:11})} ${escapeHTML(slide.programme || "All Programmes")}</span>
        </div>
        <div class="announce-title">${escapeHTML(slide.title)}</div>
        ${slide.body ? `<p class="announce-body">${escapeHTML(slide.body)}</p>` : ""}
      </div>`;
  }
  return `
    <div class="announce-card fallback">
      <p class="fallback-text">${escapeHTML(slide)}</p>
    </div>`;
}

function renderAnnouncementBox() {
  const box = $("#announcementBox");
  if (!box) return;
  clearInterval(announceSlideTimer);

  const isLive = allAnnouncements.length > 0;
  const slides = isLive ? allAnnouncements : FALLBACK_SLIDES;
  box.classList.toggle("fallback-mode", !isLive);

  box.innerHTML = `
    <div class="announce-carousel">
      <button class="announce-nav" id="announcePrev" aria-label="Previous announcement">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="announce-slide-wrap" id="announceSlideWrap"></div>
      <button class="announce-nav" id="announceNext" aria-label="Next announcement">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    ${slides.length > 1 ? `<div class="fallback-dots" id="announceDots"></div>` : ""}
  `;

  function goTo(i) {
    announceSlideIndex = (i + slides.length) % slides.length;
    renderAnnounceSlide(isLive, slides);
  }
  renderAnnounceSlide(isLive, slides);

  $("#announcePrev").addEventListener("click", () => goTo(announceSlideIndex - 1));
  $("#announceNext").addEventListener("click", () => goTo(announceSlideIndex + 1));

  if (slides.length > 1) {
    announceSlideTimer = setInterval(() => goTo(announceSlideIndex + 1), 6000);
  }
}

function renderAnnounceSlide(isLive, slides) {
  const wrap = $("#announceSlideWrap");
  if (!wrap) return;
  wrap.innerHTML = announceSlideHTML(isLive, slides[announceSlideIndex]);

  const dots = $("#announceDots");
  if (dots) {
    dots.innerHTML = slides
      .map((_, i) => `<button class="dot ${i === announceSlideIndex ? "active" : ""}" data-i="${i}" aria-label="Go to slide ${i + 1}"></button>`)
      .join("");
    $$("#announceDots .dot").forEach((d) =>
      d.addEventListener("click", () => {
        clearInterval(announceSlideTimer);
        announceSlideIndex = parseInt(d.dataset.i, 10);
        renderAnnounceSlide(isLive, slides);
        if (slides.length > 1) announceSlideTimer = setInterval(() => {
          announceSlideIndex = (announceSlideIndex + 1) % slides.length;
          renderAnnounceSlide(isLive, slides);
        }, 6000);
      })
    );
  }
}

// =========================================================
// NOTIFICATIONS BELL
// =========================================================
function latestTimestamp() {
  const times = [
    ...allResources.map((r) => r.created_at),
    ...allListings.map((l) => l.created_at),
    ...allAnnouncements.map((a) => a.created_at),
  ].filter(Boolean);
  if (times.length === 0) return null;
  return times.reduce((max, t) => (new Date(t) > new Date(max) ? t : max), times[0]);
}

function checkNotifications() {
  const bellDot = $("#notifDot");
  if (!bellDot) return;
  const latest = latestTimestamp();
  const lastSeen = localStorage.getItem("yaza-last-seen");
  const hasNew = latest && (!lastSeen || new Date(latest) > new Date(lastSeen));
  bellDot.classList.toggle("hidden", !hasNew);
}

function renderNotifDropdown() {
  const list = $("#notifList");
  if (!list) return;
  const items = [
    ...allResources.slice(0, 5).map((r) => ({ label: r.title, type: r.type === "youtube" ? ICON("film",{size:12}) + " Video" : ICON("fileText",{size:12}) + " Document", created_at: r.created_at })),
    ...allListings.slice(0, 5).map((l) => ({ label: l.title, type: ICON("shoppingCart",{size:12}) + " Marketplace", created_at: l.created_at })),
    ...allAnnouncements.slice(0, 5).map((a) => ({ label: a.title, type: ICON("megaphone",{size:12}) + " Announcement", created_at: a.created_at })),
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  if (items.length === 0) {
    list.innerHTML = `<div class="notif-empty">Nothing new yet.</div>`;
    return;
  }
  list.innerHTML = items
    .map((i) => `<div class="notif-item"><span class="notif-type">${i.type}</span><span class="notif-label">${escapeHTML(i.label)}</span></div>`)
    .join("");
}

const notifBtn = $("#notifBtn");
const notifDropdown = $("#notifDropdown");
const notifBackdrop = $("#notifBackdrop");
function closeNotifDropdown() {
  notifDropdown.classList.add("hidden");
  if (notifBackdrop) notifBackdrop.classList.add("hidden");
}
if (notifBtn && notifDropdown) {
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    renderNotifDropdown();
    const nowHidden = notifDropdown.classList.toggle("hidden");
    if (notifBackdrop) notifBackdrop.classList.toggle("hidden", nowHidden);
    if (!nowHidden) {
      localStorage.setItem("yaza-last-seen", new Date().toISOString());
      $("#notifDot").classList.add("hidden");
    }
  });
  if (notifBackdrop) notifBackdrop.addEventListener("click", closeNotifDropdown);
  document.addEventListener("click", (e) => {
    if (!notifDropdown.classList.contains("hidden") && !notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
      closeNotifDropdown();
    }
  });
}

// ---------- Diagnosis dataset count (for homepage stat only) ----------
async function fetchDiagnosisCount() {
  const { data, error } = await sbDiag.from("diseases").select("id");
  if (!error) allDiseases = data || [];
  updateStats();
}

// ---------- Init ----------
fetchResources();
fetchListings();
fetchAnnouncements();
fetchDiagnosisCount();

// =========================================================
// PUSH NOTIFICATIONS — real notification-tray alerts, via OneSignal
// (NOT Supabase — the previous hand-rolled VAPID/web-push implementation
// was unreliable, so delivery now goes through OneSignal's own
// infrastructure. Supabase Database Webhooks still just *trigger* a send —
// see the Netlify function in netlify/functions/send-push.js — but nothing
// about actually delivering the notification touches Supabase. See
// SETUP.md §9.)
// =========================================================
function getOneSignal() {
  return window.OneSignalDeferred || (window.OneSignalDeferred = []);
}

// If OneSignal's script is blocked (ad blockers / data-saver browsers commonly
// block cdn.onesignal.com) or the network is just slow, waiting on it forever
// with no feedback is what made this look like "nothing happens when tapped".
// Give it 8 seconds, then surface a real error instead of hanging silently.
function withOneSignal(callback) {
  return Promise.race([
    new Promise((resolve, reject) => {
      getOneSignal().push(async (OneSignal) => {
        try {
          resolve(await callback(OneSignal));
        } catch (err) {
          reject(err);
        }
      });
    }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Notifications service didn't respond. If you're using an ad blocker, data-saver mode, or a VPN, try turning it off for this site.")),
        8000
      )
    ),
  ]);
}

async function getPushSubscriptionState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!CONFIG.oneSignalAppId || CONFIG.oneSignalAppId === "YOUR_ONESIGNAL_APP_ID") return "not-configured";
  try {
    const optedIn = await withOneSignal((OneSignal) => OneSignal.User.PushSubscription.optedIn);
    return optedIn ? "subscribed" : "unsubscribed";
  } catch {
    // Covers both "SDK never loaded" (timeout) and any OneSignal-side error —
    // either way we can't confirm a subscription, so fall back to the
    // "not yet enabled" state rather than leaving the button stuck loading.
    return "unsubscribed";
  }
}

async function refreshEnablePushBtn() {
  const btn = $("#enablePushBtn");
  if (!btn) return;
  const state = await getPushSubscriptionState();
  if (state === "unsupported") {
    btn.textContent = "Notifications aren't supported on this browser";
    btn.disabled = true;
  } else if (state === "not-configured") {
    btn.textContent = "Notifications aren't set up yet";
    btn.disabled = true;
  } else if (state === "subscribed") {
    btn.innerHTML = ICON("checkCircle", {size:14}) + " Notifications enabled on this phone";
    btn.classList.add("enabled");
  } else {
    btn.innerHTML = ICON("bell", {size:14}) + " Enable notifications on this phone";
    btn.classList.remove("enabled");
  }
}

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Notifications aren't supported on this browser", "error");
    return;
  }
  if (!CONFIG.oneSignalAppId || CONFIG.oneSignalAppId === "YOUR_ONESIGNAL_APP_ID") {
    showToast("Notifications aren't set up yet — admin needs to add a OneSignal App ID.", "error");
    return;
  }
  const btn = $("#enablePushBtn");
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Connecting…";
  }
  try {
    await withOneSignal(async (OneSignal) => {
      await OneSignal.Notifications.requestPermission();
      if (OneSignal.Notifications.permission) {
        await OneSignal.User.PushSubscription.optIn();
      }
    });
    const state = await getPushSubscriptionState();
    if (state !== "subscribed") {
      showToast("Notifications permission was not granted", "error");
      return;
    }
    showToast("Notifications enabled on this phone!");
  } catch (err) {
    console.error(err);
    showToast("Couldn't enable notifications: " + (err.message || err), "error");
  } finally {
    if (btn) btn.disabled = false;
    refreshEnablePushBtn();
  }
}

const enablePushBtn = $("#enablePushBtn");
if (enablePushBtn) {
  enablePushBtn.addEventListener("click", enablePush);
  refreshEnablePushBtn();
}

// ---------- "Open with KUHeS Yaza" (File Handling API) ----------
// Lets an installed copy of the app show up in the phone's/desktop's native
// "Open with" chooser for .pdf/.pptx/.docx files and genuinely view them —
// see file_handlers in manifest.json. Supported on Chromium-based browsers
// (Chrome/Edge on Android, ChromeOS, and desktop) for installed PWAs only;
// iOS Safari does not yet support the File Handling API, so on iPhone the
// app just won't appear in that menu — there's no in-app workaround for that.
function extToFileType(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "pptx") return "pptx";
  if (ext === "docx") return "docx";
  return ext;
}

async function handleLaunchFiles(fileHandles) {
  if (!fileHandles || !fileHandles.length) return;
  try {
    const handle = fileHandles[0];
    const file = await handle.getFile();
    const fileType = extToFileType(file.name);
    const resource = {
      title: file.name,
      type: fileType,
      file_type: fileType,
      isLocalFile: true,
      localFile: file,
      localArrayBuffer: fileType === "pdf" ? await file.arrayBuffer() : null,
    };
    openViewer(resource);
  } catch (err) {
    console.error("Couldn't open launched file:", err);
    showToast("Couldn't open that file.", "error");
  }
}

if ("launchQueue" in window) {
  window.launchQueue.setConsumer((launchParams) => {
    if (launchParams.files && launchParams.files.length) {
      handleLaunchFiles(launchParams.files);
    }
  });
}

// Deep-link from stream-page.html's "Add video" / "Add audio" buttons —
// same ?param pattern market-page.html uses for ?sell=1. Placed at the end
// of the file so the #pickYoutube / #pickAudio click listeners above are
// already attached by the time this fires.
const uploadIntent = new URLSearchParams(window.location.search).get("upload");
if (uploadIntent === "youtube") $("#pickYoutube")?.click();
if (uploadIntent === "audio") $("#pickAudio")?.click();
