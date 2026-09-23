/* =========================================================
   KUHeS Yaza — diagnosis.js
   Uses DB 4 (diagnosis) — the same project configured for
   "diagnosis" in app.js's CONFIG block. Fill in the same
   URL + anon key here.
   ========================================================= */

const CONFIG = {
  diagnosis: {
    url: "https://klzdjdiutlmvgtzkpzzf.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsemRqZGl1dGxtdmd0emtwenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzA2MzMsImV4cCI6MjEwMDUwNjYzM30.yPf01NAB6xjPHyxusPMT49xj24vskYaXPN4Qr5zuzLg",
  },
};

const sbDiag = window.supabase.createClient(CONFIG.diagnosis.url, CONFIG.diagnosis.key);

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

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }
$$(".close-btn").forEach((b) => b.addEventListener("click", () => b.closest(".modal-overlay").classList.add("hidden")));
$$(".modal-overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) o.classList.add("hidden"); }));

$("#logoBtn").addEventListener("click", () => (window.location.href = "index.html"));

// ---------- Theme (match main app) ----------
document.body.setAttribute("data-theme", localStorage.getItem("yaza-theme") || "dark");

// ---------- Splash screen ----------
function hideSplash() {
  const splash = $("#splashScreen");
  if (splash) splash.classList.add("hide");
}
window.addEventListener("load", () => setTimeout(hideSplash, 500));
setTimeout(hideSplash, 3000); // safety net

// ---------- First Aid & Health Tips (static content — no DB table needed) ----------
const FIRST_AID_TIPS = [
  {
    id: "bleeding",
    title: "Bleeding & Cuts",
    category: "Emergency",
    icon: "zap",
    summary: "Stop the bleeding and prevent infection.",
    steps: [
      "Wash your hands if possible before helping.",
      "Apply firm, direct pressure to the wound with a clean cloth or gauze.",
      "Keep pressing for several minutes without lifting the cloth to check.",
      "Raise the injured area above heart level if you can.",
      "Once bleeding slows, cover with a clean dressing and secure it.",
      "Seek medical care for deep wounds, embedded objects, or bleeding that won't stop after 10 minutes of pressure.",
    ],
  },
  {
    id: "burns",
    title: "Burns",
    category: "Emergency",
    icon: "zap",
    summary: "Cool it, cover it, don't pop blisters.",
    steps: [
      "Move away from the heat source.",
      "Cool the burn under cool (not ice-cold) running water for 10-20 minutes.",
      "Remove tight items like rings near the burn before it swells.",
      "Do not apply butter, toothpaste, or ice — this can worsen the injury.",
      "Do not burst any blisters that form.",
      "Cover loosely with a clean, non-fluffy cloth or dressing.",
      "Seek medical care for large, deep burns, or burns to the face, hands, or airway.",
    ],
  },
  {
    id: "choking",
    title: "Choking",
    category: "Emergency",
    icon: "zap",
    summary: "Encourage coughing, then back blows and abdominal thrusts.",
    steps: [
      "If the person can cough or speak, encourage them to keep coughing.",
      "If they cannot breathe, speak, or cough, stand behind them and give up to 5 sharp back blows between the shoulder blades.",
      "If that doesn't clear it, give up to 5 abdominal thrusts (Heimlich manoeuvre): fist above the navel, grasp with your other hand, and pull sharply inward and upward.",
      "Alternate back blows and abdominal thrusts until the object clears or the person can breathe.",
      "If the person becomes unresponsive, lower them to the ground and start CPR, calling for emergency help immediately.",
    ],
  },
  {
    id: "fainting",
    title: "Fainting / Loss of Consciousness",
    category: "Common",
    icon: "stethoscope",
    summary: "Lay them flat, raise the legs, check breathing.",
    steps: [
      "Lay the person flat on their back in a safe spot.",
      "Raise their legs about 30cm to help blood flow back to the brain, if there's no injury that prevents it.",
      "Loosen tight clothing around the neck.",
      "Ensure fresh air — open a window or move away from crowds.",
      "Check they are breathing normally; if not, begin CPR and get emergency help.",
      "Once they come round, let them rest lying down for a few minutes before sitting up slowly.",
      "Seek medical care if fainting is repeated, unexplained, or follows a head injury.",
    ],
  },
  {
    id: "fractures",
    title: "Fractures & Sprains",
    category: "Common",
    icon: "zap",
    summary: "Immobilise, don't try to realign, get help.",
    steps: [
      "Keep the injured area still — avoid moving or straightening it.",
      "Support the limb in the position it's in using a splint, folded cloth, or sling.",
      "Apply a cold pack wrapped in cloth to reduce swelling (never ice directly on skin).",
      "Elevate the limb if possible.",
      "Do not try to push a bone back into place.",
      "Get medical care, especially if there's an open wound, visible deformity, or loss of feeling.",
    ],
  },
  {
    id: "cpr",
    title: "CPR Basics (Adult)",
    category: "Emergency",
    icon: "zap",
    summary: "Call for help, push hard and fast on the chest centre.",
    steps: [
      "Check for danger, then check if the person responds and is breathing normally.",
      "If unresponsive and not breathing normally, call/send someone for emergency help immediately.",
      "Place the heel of one hand on the centre of the chest, other hand on top, fingers interlocked.",
      "Push hard and fast, about 5-6cm deep, at a rate of 100-120 compressions per minute.",
      "Allow the chest to fully recoil between compressions.",
      "If trained, give 30 compressions to 2 rescue breaths. If untrained, continue hands-only compressions until help arrives.",
    ],
  },
  {
    id: "snakebite",
    title: "Snake Bites",
    category: "Emergency",
    icon: "zap",
    summary: "Keep still, immobilise the limb, get to hospital.",
    steps: [
      "Keep the person calm and as still as possible — movement spreads venom faster.",
      "Remove tight clothing, rings, or watches near the bite before swelling starts.",
      "Immobilise the bitten limb with a splint, keeping it below heart level.",
      "Do not cut the wound, try to suck out venom, or apply a tight tourniquet.",
      "Note the snake's appearance if safely possible, but don't risk another bite trying to catch it.",
      "Get to a hospital as quickly and calmly as possible — antivenom is time-sensitive.",
    ],
  },
  {
    id: "poisoning",
    title: "Poisoning",
    category: "Emergency",
    icon: "zap",
    summary: "Don't induce vomiting, get medical help fast.",
    steps: [
      "Move the person away from the source of poison if it's a gas or fumes.",
      "Do not induce vomiting unless a health professional tells you to.",
      "If the substance is on skin or in eyes, rinse thoroughly with clean water.",
      "Try to identify what was taken and how much — keep the container or packaging if available.",
      "Get emergency medical help immediately, or contact your nearest poison control resource.",
      "If the person is unconscious but breathing, place them in the recovery position while waiting for help.",
    ],
  },
  {
    id: "handwashing",
    title: "Proper Handwashing",
    category: "Prevention",
    icon: "stethoscope",
    summary: "20 seconds, all surfaces, dry with a clean cloth.",
    steps: [
      "Wet hands with clean running water.",
      "Apply soap and lather well, covering the backs of hands, between fingers, and under nails.",
      "Scrub for at least 20 seconds.",
      "Rinse thoroughly under clean running water.",
      "Dry with a clean towel or air dry.",
      "Wash before eating or handling food, after using the toilet, and after coughing or sneezing.",
    ],
  },
  {
    id: "heatstroke",
    title: "Heat Exhaustion & Heat Stroke",
    category: "Prevention",
    icon: "zap",
    summary: "Cool the person down and rehydrate; heat stroke is an emergency.",
    steps: [
      "Move the person to a cool, shaded place and remove excess clothing.",
      "Cool the skin with a damp cloth or fan, especially neck, armpits, and groin.",
      "Give small sips of water if they are fully conscious and able to swallow.",
      "Heat exhaustion usually improves with rest, cooling, and fluids within 30 minutes.",
      "If confusion, very high body temperature, or loss of consciousness develop, this is heat stroke — treat as a medical emergency and get help immediately.",
    ],
  },
];

let activeTipCategory = "all";

function renderTips() {
  const grid = $("#tipsGrid");
  if (!grid) return;
  const items = activeTipCategory === "all" ? FIRST_AID_TIPS : FIRST_AID_TIPS.filter((t) => t.category === activeTipCategory);
  grid.innerHTML = items
    .map(
      (t) => `
    <div class="res-card" data-tip-id="${t.id}">
      <div class="res-card-top"><span class="res-cat-label">${escapeHTML(t.category)}</span></div>
      <div class="res-thumb"><span class="res-thumb-glyph">${ICON(t.icon, { size: 26 })}</span></div>
      <div class="res-title">${escapeHTML(t.title)}</div>
      <div class="res-meta"><span>${escapeHTML(t.summary)}</span></div>
    </div>`
    )
    .join("");

  $$("#tipsGrid .res-card").forEach((card) =>
    card.addEventListener("click", () => {
      const tip = FIRST_AID_TIPS.find((t) => t.id === card.dataset.tipId);
      if (!tip) return;
      $("#tipModalTitle").textContent = tip.title;
      $("#tipModalBody").innerHTML = `
        <ol class="tip-steps">${tip.steps.map((s) => `<li>${escapeHTML(s)}</li>`).join("")}</ol>
        <div class="tip-box" style="margin-top:14px;">
          <span class="tip-eyebrow">Reminder</span>
          <span>General first-aid guidance only — always get proper medical care for serious injuries.</span>
        </div>`;
      openModal("#tipModal");
    })
  );
}

$$("#tipFilterChips .chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    $$("#tipFilterChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeTipCategory = chip.dataset.cat;
    renderTips();
  })
);

renderTips();

// ---------- My Symptom Check History (local device only — localStorage, no account) ----------
const HISTORY_KEY = "yaza-diag-history";
const HISTORY_LIMIT = 20;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  const history = loadHistory();
  history.unshift({ ...entry, at: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  renderHistory();
}

function renderHistory() {
  const wrap = $("#historyList");
  if (!wrap) return;
  const history = loadHistory();
  if (history.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No checks yet</h3><p>Run the symptom checker or ask AI and your recent checks will show up here.</p></div>`;
    return;
  }
  wrap.innerHTML = history
    .map((h) => {
      const date = new Date(h.at);
      const dateLabel = date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return `
      <div class="res-card diag-result-card" style="margin-bottom:10px;">
        <div class="res-card-top"><span class="badge" style="background:rgba(255,255,255,.06);color:var(--text-muted)">${escapeHTML(dateLabel)}</span></div>
        <div class="res-title">${escapeHTML(h.result)}</div>
        <div class="res-meta"><span>${escapeHTML(h.symptoms)}</span></div>
      </div>`;
    })
    .join("");
}

const clearHistoryBtn = $("#clearHistoryBtn");
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast("History cleared");
  });
}

renderHistory();

let allDiseases = [];
let allSignsSorted = [];
let selectedSymptoms = new Set();

async function loadDiseases() {
  const { data, error } = await sbDiag.from("diseases").select("*").order("name", { ascending: true });
  if (error) {
    $("#symptomChips").innerHTML = `<div class="empty-state"><h3>Couldn't load data</h3><p>${escapeHTML(error.message)}</p></div>`;
    hideSplash();
    return;
  }
  allDiseases = (data || []).map((d) => ({ ...d, signs: Array.isArray(d.signs) ? d.signs : [] }));
  const allSigns = new Set();
  allDiseases.forEach((d) => d.signs.forEach((s) => allSigns.add(s)));
  allSignsSorted = [...allSigns].sort((a, b) => a.localeCompare(b));
  renderSymptomChips();
  hideSplash();
}

function updateSelectedCount() {
  const el = $("#selectedCount");
  if (!el) return;
  el.textContent = selectedSymptoms.size
    ? `${selectedSymptoms.size} symptom${selectedSymptoms.size === 1 ? "" : "s"} selected`
    : "";
}

function renderSymptomChips(filterTerm = "") {
  const wrap = $("#symptomChips");
  const term = filterTerm.trim().toLowerCase();
  const list = term ? allSignsSorted.filter((s) => s.toLowerCase().includes(term)) : allSignsSorted;

  if (allSignsSorted.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No symptoms available yet</h3><p>Admin hasn't set up the diagnosis dataset yet.</p></div>`;
    return;
  }
  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No matching symptoms</h3><p>Try a different search term.</p></div>`;
    return;
  }

  wrap.innerHTML = list
    .map(
      (s) =>
        `<button class="chip small${selectedSymptoms.has(s) ? " active" : ""}" data-sign="${escapeHTML(s)}">${escapeHTML(s)}</button>`
    )
    .join("");

  $$("#symptomChips .chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      const sign = chip.dataset.sign;
      if (selectedSymptoms.has(sign)) {
        selectedSymptoms.delete(sign);
        chip.classList.remove("active");
      } else {
        selectedSymptoms.add(sign);
        chip.classList.add("active");
      }
      updateSelectedCount();
    })
  );
  updateSelectedCount();
}

let symptomSearchDebounce;
const symptomSearchInput = $("#symptomSearch");
if (symptomSearchInput) {
  symptomSearchInput.addEventListener("input", () => {
    clearTimeout(symptomSearchDebounce);
    symptomSearchDebounce = setTimeout(() => renderSymptomChips(symptomSearchInput.value), 120);
  });
}

$("#diagnoseBtn").addEventListener("click", () => {
  if (selectedSymptoms.size === 0) {
    showToast("Please select at least one symptom", "error");
    return;
  }

  const matches = allDiseases
    .map((d) => {
      if (d.signs.length === 0) return null;
      const overlap = d.signs.filter((s) => selectedSymptoms.has(s)).length;
      if (overlap === 0) return null;
      const score = Math.round((overlap / d.signs.length) * 100);
      return { disease: d, overlap, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap)
    .slice(0, 5);

  renderResults(matches);
});

function renderResults(matches) {
  const box = $("#diagResults");
  if (matches.length === 0) {
    box.innerHTML = `<div class="empty-state"><h3>No clear match found</h3><p>Our dataset doesn't have a disease matching these signs yet. Try "Ask AI" above for general possibilities.</p></div>`;
    saveHistoryEntry({ symptoms: [...selectedSymptoms].join(", "), result: "No clear match found" });
    return;
  }

  box.innerHTML = `
    <h3 class="diag-section-title">Suggested possibilities</h3>
    ${matches
      .map(
        (m) => `
      <div class="res-card diag-result-card">
        <div class="res-card-top">
          <span class="badge" style="background:${m.score >= 70 ? "rgba(47,174,107,.15)" : "rgba(224,167,48,.15)"};color:${m.score >= 70 ? "var(--success)" : "var(--gold)"}">${m.score}% match</span>
        </div>
        <div class="res-title">${escapeHTML(m.disease.name)}</div>
        ${m.disease.programme ? `<div class="res-meta"><span>${escapeHTML(m.disease.programme)}</span></div>` : ""}
        <div class="res-meta"><span>Matched signs: ${m.overlap}/${m.disease.signs.length}</span></div>
      </div>`
      )
      .join("")}
    <div class="tip-box" style="margin-top:12px;">
      <span class="tip-eyebrow">Reminder</span>
      <span>This is not a medical diagnosis. Please see a qualified health worker for proper evaluation and treatment.</span>
    </div>
  `;
  saveHistoryEntry({ symptoms: [...selectedSymptoms].join(", "), result: `${matches[0].disease.name} (${matches[0].score}% match)` });
}

// ---------- Ask AI (always available as its own option, not just a fallback) ----------
$("#askAiDiagBtn").addEventListener("click", () => {
  const typed = $("#aiSymptomInput").value.trim();
  if (!typed) {
    showToast("Please describe your symptoms first", "error");
    return;
  }
  runAiFallback(typed);
});

async function runAiFallback(symptoms) {
  const btn = $("#askAiDiagBtn");
  const resultBox = $("#aiDiagResult");
  btn.disabled = true;
  resultBox.innerHTML = `<div class="ai-loading"><span class="spin"></span> Thinking…</div>`;
  try {
    const prompt =
      `A student on a Malawian health-sciences campus described these signs & symptoms in a self-check tool, in their own words: "${symptoms}". ` +
      `Give 2-4 general possibilities that could involve these signs, in plain language, ` +
      `as a short bullet list (no markdown symbols, just short lines). Keep it brief. Do not give a definitive diagnosis, dosages, or ` +
      `medication names. End with one short sentence advising the person to see a qualified health worker for proper evaluation.`;
    const text = await askGemini(prompt);
    resultBox.innerHTML = `<div class="ai-answer">${escapeHTML(text)}</div><div class="ai-disclaimer">AI-generated — not a medical diagnosis. Please consult a qualified health worker.</div>`;
    saveHistoryEntry({ symptoms: symptoms, result: "AI: " + text.slice(0, 80).trim() + (text.length > 80 ? "…" : "") });
  } catch (err) {
    resultBox.innerHTML = `<div class="ai-answer error">${escapeHTML(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

loadDiseases();
