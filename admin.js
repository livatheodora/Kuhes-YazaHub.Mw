/* =========================================================
   KUHeS Yaza — admin.js
   Uses the SAME five Supabase projects configured in app.js.
   Fill in the identical URL + anon key for each of the 5
   blocks below (copy them from app.js's CONFIG).
   NOTE: This login check runs entirely in the browser. It is
   fine for keeping casual/uninvited users out of the panel,
   but it is NOT real security — anyone who reads this file
   can see the credentials. If this ever needs to be locked
   down properly, move the check to a Supabase Edge Function
   or use Supabase Auth with a role claim instead.
   ========================================================= */

const CONFIG = {
  resourcesA: { url: "https://crhgdlfgsdtxjcrqpceo.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyaGdkbGZnc2R0eGpjcnFwY2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzEzNTcsImV4cCI6MjEwMDUwNzM1N30.kNbDcorCh2d2_aTQbIf_wVd5115xoRY4CWkMkZ9oiZs" },
  resourcesB: { url: "https://ufzhwbalbewmaqcsqdrx.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmemh3YmFsYmV3bWFxY3NxZHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzAxOTUsImV4cCI6MjEwMDUwNjE5NX0.QN7onOSoWWZ9Vwd45cKTdnvdER9VAGeCXuWKIHa2UN8" },
  market: { url: "https://axoaujikwxgeodpmwjid.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4b2F1amlrd3hnZW9kcG13amlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA1NTAsImV4cCI6MjEwMDUwNjU1MH0.fiJNgBWmL23J3MtFgNbpWhJxB1PqdkkHDyGr2lD_seI" },
  diagnosis: { url: "https://klzdjdiutlmvgtzkpzzf.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsemRqZGl1dGxtdmd0emtwenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA2MzMsImV4cCI6MjEwMDUwNjYzM30.yPf01NAB6xjPHyxusPMT49xj24vskYaXPN4Qr5zuzLg" },
  announcements: { url: "https://tqvqbjbpzwzwgxezxpej.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxdnFiamJwend6d2d4ZXp4cGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA4ODQsImV4cCI6MjEwMDUwNjg4NH0.cibu20Ce5ziNI0Ur2uUvRO4DEobzPZPhrhfm8PIbbO4" },
};

const sbResA = window.supabase.createClient(CONFIG.resourcesA.url, CONFIG.resourcesA.key);
const sbResB = window.supabase.createClient(CONFIG.resourcesB.url, CONFIG.resourcesB.key);
const sbMarket = window.supabase.createClient(CONFIG.market.url, CONFIG.market.key);
const sbDiag = window.supabase.createClient(CONFIG.diagnosis.url, CONFIG.diagnosis.key);
const sbAnnounce = window.supabase.createClient(CONFIG.announcements.url, CONFIG.announcements.key);

const ADMIN_EMAIL = "admin@otechy.kuhes.ac.mw";
const ADMIN_PASSWORD = "admin@otechy.kuhes";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = "toast " + type;
  toast.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.style.display = "none"), 3000);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Auth gate ----------
function isLoggedIn() {
  return sessionStorage.getItem("yaza-admin") === "true";
}
function showAdmin() {
  $("#loginShell").style.display = "none";
  $("#adminShell").style.display = "block";
  loadResources();
  loadListings();
  loadDiseases();
  loadAnnouncements();
  loadViewers();
  loadReports();
}
function showLogin() {
  $("#loginShell").style.display = "flex";
  $("#adminShell").style.display = "none";
}

$("#loginBtn").addEventListener("click", () => {
  const email = $("#adminEmail").value.trim().toLowerCase();
  const password = $("#adminPassword").value;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    sessionStorage.setItem("yaza-admin", "true");
    $("#loginError").style.display = "none";
    showAdmin();
  } else {
    $("#loginError").style.display = "block";
  }
});
$("#adminPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#loginBtn").click();
});
$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("yaza-admin");
  showLogin();
});

if (isLoggedIn()) showAdmin(); else showLogin();

// ---------- Tabs ----------
const PANELS = {
  resources: "#resourcesPanel",
  market: "#marketPanelAdmin",
  diagnosis: "#diagnosisPanelAdmin",
  announcements: "#announcePanelAdmin",
  viewers: "#viewersPanelAdmin",
  reports: "#reportsPanelAdmin",
};
$$("[data-atab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$("[data-atab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.entries(PANELS).forEach(([key, sel]) => {
      $(sel).classList.toggle("hidden", key !== btn.dataset.atab);
    });
  })
);

// ---------- Resources (merged DB1 + DB2) ----------
let allResources = [];

function sbForRes(src) {
  return src === "B" ? sbResB : sbResA;
}

async function loadResources() {
  const [a, b] = await Promise.all([
    sbResA.from("resources").select("*").order("created_at", { ascending: false }),
    sbResB.from("resources").select("*").order("created_at", { ascending: false }),
  ]);
  if (a.error && b.error) {
    $("#resTableBody").innerHTML = `<tr><td colspan="9">Couldn't load resources: ${escapeHTML(a.error.message)}</td></tr>`;
    return;
  }
  const fromA = (a.data || []).map((r) => ({ ...r, _src: "A" }));
  const fromB = (b.data || []).map((r) => ({ ...r, _src: "B" }));
  allResources = [...fromA, ...fromB].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  renderResources();
}

function renderResources() {
  const term = $("#adminResSearch").value.trim().toLowerCase();
  const filtered = allResources.filter(
    (r) => !term || r.title.toLowerCase().includes(term) || (r.programme || "").toLowerCase().includes(term)
  );
  if (filtered.length === 0) {
    $("#resTableBody").innerHTML = `<tr><td colspan="9">No resources found.</td></tr>`;
    return;
  }
  $("#resTableBody").innerHTML = filtered
    .map(
      (r) => `
    <tr>
      <td>${escapeHTML(r.title)} ${r.verified ? '<span class="badge verified" title="Verified">' + ICON('check', {size: 11}) + '</span>' : ""}</td>
      <td>${escapeHTML(r.programme || "—")}</td>
      <td>${escapeHTML(r.year || "—")}</td>
      <td>${escapeHTML(r.type === "youtube" ? "Video" : (r.file_type || "").toUpperCase())}</td>
      <td>${escapeHTML(r.category || "—")}</td>
      <td>${r.views || 0}</td>
      <td>DB${r._src === "B" ? "2" : "1"}</td>
      <td><a href="${r.url}" target="_blank">Open</a></td>
      <td class="row-actions">
        <button class="text-link-btn" data-verify-res="${r.id}" data-src="${r._src}" data-current="${!!r.verified}">${r.verified ? "Unverify" : "Verify"}</button>
        <button class="text-link-btn danger" data-delete-res="${r.id}" data-src="${r._src}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-delete-res]").forEach((btn) =>
    btn.addEventListener("click", () => deleteResource(btn.dataset.deleteRes, btn.dataset.src))
  );
  $$("[data-verify-res]").forEach((btn) =>
    btn.addEventListener("click", () => toggleVerified(btn.dataset.verifyRes, btn.dataset.src, btn.dataset.current === "true"))
  );
}

async function toggleVerified(id, src, current) {
  const { error } = await sbForRes(src).from("resources").update({ verified: !current }).eq("id", id);
  if (error) {
    showToast("Couldn't update: " + error.message, "error");
    return;
  }
  showToast(current ? "Marked as unverified." : "Marked as verified.");
  loadResources();
}

async function deleteResource(id, src) {
  if (!confirm("Delete this resource? This cannot be undone.")) return;
  const { error } = await sbForRes(src).from("resources").delete().eq("id", id);
  if (error) {
    showToast("Couldn't delete: " + error.message, "error");
    return;
  }
  showToast("Resource deleted.");
  loadResources();
}

$("#adminResSearch").addEventListener("input", renderResources);

// ---------- Marketplace ----------
let allListings = [];

async function loadListings() {
  const { data, error } = await sbMarket.from("market_listings").select("*").order("created_at", { ascending: false });
  if (error) {
    $("#marketTableBody").innerHTML = `<tr><td colspan="7">Couldn't load listings: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  allListings = data || [];
  renderListings();
}

function renderListings() {
  const term = $("#adminMarketSearch").value.trim().toLowerCase();
  const filtered = allListings.filter((l) => !term || l.title.toLowerCase().includes(term));
  if (filtered.length === 0) {
    $("#marketTableBody").innerHTML = `<tr><td colspan="7">No listings found.</td></tr>`;
    return;
  }
  $("#marketTableBody").innerHTML = filtered
    .map(
      (l) => `
    <tr>
      <td>${escapeHTML(l.title)}</td>
      <td>${l.price ? "MWK " + Number(l.price).toLocaleString() : "—"}</td>
      <td>${escapeHTML(l.category || "—")}</td>
      <td>${escapeHTML(l.seller_name || "—")}</td>
      <td>${escapeHTML(l.seller_phone || "—")}</td>
      <td>${l.views || 0}</td>
      <td class="row-actions">
        <button class="text-link-btn danger" data-delete-listing="${l.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-delete-listing]").forEach((btn) =>
    btn.addEventListener("click", () => deleteListing(btn.dataset.deleteListing))
  );
}

async function deleteListing(id) {
  if (!confirm("Delete this listing? This cannot be undone.")) return;
  const { error } = await sbMarket.from("market_listings").delete().eq("id", id);
  if (error) {
    showToast("Couldn't delete: " + error.message, "error");
    return;
  }
  showToast("Listing deleted.");
  loadListings();
}

$("#adminMarketSearch").addEventListener("input", renderListings);

// ---------- Diagnosis dataset ----------
let allDiseases = [];

async function loadDiseases() {
  const { data, error } = await sbDiag.from("diseases").select("*").order("name", { ascending: true });
  if (error) {
    $("#diagTableBody").innerHTML = `<tr><td colspan="4">Couldn't load: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  allDiseases = (data || []).map((d) => ({ ...d, signs: Array.isArray(d.signs) ? d.signs : [] }));
  renderDiseases();
}

function renderDiseases() {
  const term = $("#adminDiagSearch").value.trim().toLowerCase();
  const filtered = allDiseases.filter((d) => !term || d.name.toLowerCase().includes(term));
  if (filtered.length === 0) {
    $("#diagTableBody").innerHTML = `<tr><td colspan="4">No diseases added yet.</td></tr>`;
    return;
  }
  $("#diagTableBody").innerHTML = filtered
    .map(
      (d) => `
    <tr>
      <td>${escapeHTML(d.name)}</td>
      <td>${escapeHTML(d.programme || "All")}</td>
      <td>${escapeHTML(d.signs.join(", "))}</td>
      <td class="row-actions">
        <button class="text-link-btn danger" data-delete-diag="${d.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-delete-diag]").forEach((btn) =>
    btn.addEventListener("click", () => deleteDisease(btn.dataset.deleteDiag))
  );
}

$("#diagAddBtn").addEventListener("click", async () => {
  const name = $("#diagName").value.trim();
  const programme = $("#diagProgramme").value;
  const signsRaw = $("#diagSigns").value.trim();
  if (!name) return showToast("Please add a disease name", "error");
  if (!signsRaw) return showToast("Please add at least one sign/symptom", "error");

  const signs = signsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const { error } = await sbDiag.from("diseases").insert([{ name, programme: programme || null, signs }]);
  if (error) {
    showToast("Couldn't add: " + error.message, "error");
    return;
  }
  showToast("Disease added.");
  $("#diagName").value = "";
  $("#diagSigns").value = "";
  $("#diagProgramme").value = "";
  loadDiseases();
});

async function deleteDisease(id) {
  if (!confirm("Delete this disease entry? This cannot be undone.")) return;
  const { error } = await sbDiag.from("diseases").delete().eq("id", id);
  if (error) {
    showToast("Couldn't delete: " + error.message, "error");
    return;
  }
  showToast("Disease deleted.");
  loadDiseases();
}

$("#adminDiagSearch").addEventListener("input", renderDiseases);

// ---------- Announcements ----------
let allAnn = [];

async function loadAnnouncements() {
  const { data, error } = await sbAnnounce.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) {
    $("#annTableBody").innerHTML = `<tr><td colspan="5">Couldn't load: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  allAnn = data || [];
  renderAnnouncements();
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderAnnouncements() {
  if (allAnn.length === 0) {
    $("#annTableBody").innerHTML = `<tr><td colspan="5">No announcements posted yet.</td></tr>`;
    return;
  }
  $("#annTableBody").innerHTML = allAnn
    .map(
      (a) => `
    <tr>
      <td>${escapeHTML(a.title)}</td>
      <td>${escapeHTML(a.programme || "All")}</td>
      <td>${fmtDate(a.start_at)}</td>
      <td>${fmtDate(a.expire_at)}</td>
      <td class="row-actions">
        <button class="text-link-btn danger" data-delete-ann="${a.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-delete-ann]").forEach((btn) =>
    btn.addEventListener("click", () => deleteAnnouncement(btn.dataset.deleteAnn))
  );
}

$("#annAddBtn").addEventListener("click", async () => {
  const title = $("#annTitle").value.trim();
  const body = $("#annBody").value.trim();
  const programme = $("#annProgramme").value;
  const startVal = $("#annStart").value;
  const expireVal = $("#annExpire").value;

  if (!title) return showToast("Please add a title", "error");
  if (!expireVal) return showToast("Please set an expiry date/time", "error");

  const start_at = startVal ? new Date(startVal).toISOString() : new Date().toISOString();
  const expire_at = new Date(expireVal).toISOString();

  if (new Date(expire_at) <= new Date(start_at)) {
    return showToast("Expiry must be after the show-from time", "error");
  }

  const { error } = await sbAnnounce.from("announcements").insert([{ title, body, programme, start_at, expire_at }]);
  if (error) {
    showToast("Couldn't post: " + error.message, "error");
    return;
  }
  showToast("Announcement posted.");
  $("#annTitle").value = "";
  $("#annBody").value = "";
  $("#annStart").value = "";
  $("#annExpire").value = "";
  loadAnnouncements();
});

async function deleteAnnouncement(id) {
  if (!confirm("Delete this announcement? This cannot be undone.")) return;
  const { error } = await sbAnnounce.from("announcements").delete().eq("id", id);
  if (error) {
    showToast("Couldn't delete: " + error.message, "error");
    return;
  }
  showToast("Announcement deleted.");
  loadAnnouncements();
}

// ---------- Viewers (delete-only — admin cannot add these) ----------
let allViewers = [];

async function loadViewers() {
  const { data, error } = await sbMarket.from("viewers").select("*").order("created_at", { ascending: false });
  if (error) {
    $("#viewerTableBody").innerHTML = `<tr><td colspan="4">Couldn't load: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  allViewers = data || [];
  renderViewers();
}

function renderViewers() {
  const term = $("#adminViewerSearch").value.trim().toLowerCase();
  const filtered = allViewers.filter((v) => !term || v.name.toLowerCase().includes(term));
  if (filtered.length === 0) {
    $("#viewerTableBody").innerHTML = `<tr><td colspan="4">No viewers yet.</td></tr>`;
    return;
  }
  $("#viewerTableBody").innerHTML = filtered
    .map(
      (v) => `
    <tr>
      <td>${v.photo_url ? `<img src="${v.photo_url}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : "—"}</td>
      <td>${escapeHTML(v.name)}</td>
      <td>${fmtDate(v.created_at)}</td>
      <td class="row-actions">
        <button class="text-link-btn danger" data-delete-viewer="${v.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-delete-viewer]").forEach((btn) =>
    btn.addEventListener("click", () => deleteViewer(btn.dataset.deleteViewer))
  );
}

async function deleteViewer(id) {
  if (!confirm("Remove this viewer? This cannot be undone.")) return;
  const { error } = await sbMarket.from("viewers").delete().eq("id", id);
  if (error) {
    showToast("Couldn't delete: " + error.message, "error");
    return;
  }
  showToast("Viewer removed.");
  loadViewers();
}

$("#adminViewerSearch").addEventListener("input", renderViewers);

// ---------- Reports (view + dismiss) ----------
let allReports = [];

async function loadReports() {
  const { data, error } = await sbMarket.from("reports").select("*").order("created_at", { ascending: false });
  if (error) {
    $("#reportTableBody").innerHTML = `<tr><td colspan="5">Couldn't load: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }
  allReports = data || [];
  renderReports();
}

function renderReports() {
  if (allReports.length === 0) {
    $("#reportTableBody").innerHTML = `<tr><td colspan="5">No reports — all clear.</td></tr>`;
    return;
  }
  $("#reportTableBody").innerHTML = allReports
    .map(
      (r) => `
    <tr>
      <td>${escapeHTML(r.item_title || r.item_id)}</td>
      <td>${escapeHTML(r.item_type)}</td>
      <td>${escapeHTML(r.reason)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td class="row-actions">
        <button class="text-link-btn danger" data-dismiss-report="${r.id}">Dismiss</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-dismiss-report]").forEach((btn) =>
    btn.addEventListener("click", () => dismissReport(btn.dataset.dismissReport))
  );
}

async function dismissReport(id) {
  const { error } = await sbMarket.from("reports").delete().eq("id", id);
  if (error) {
    showToast("Couldn't dismiss: " + error.message, "error");
    return;
  }
  showToast("Report dismissed.");
  loadReports();
}
