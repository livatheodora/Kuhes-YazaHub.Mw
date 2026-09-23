/* =========================================================
   KUHeS Yaza — connect.js
   Needs its OWN Supabase project (separate from the other 5).
   Run this SQL in that new project's SQL editor, then paste
   the project's URL + anon key into CONFIG below:

   create table chat_users (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     avatar_url text,
     created_at timestamptz not null default now(),
     last_seen timestamptz not null default now()
   );

   create table conversations (
     id uuid primary key default gen_random_uuid(),
     user_a uuid not null references chat_users(id) on delete cascade,
     user_b uuid not null references chat_users(id) on delete cascade,
     created_at timestamptz not null default now(),
     unique (user_a, user_b)
   );

   create table messages (
     id bigint generated always as identity primary key,
     conversation_id uuid not null references conversations(id) on delete cascade,
     sender_id uuid not null references chat_users(id) on delete cascade,
     body text not null,
     created_at timestamptz not null default now(),
     read_at timestamptz
   );

   create index messages_conversation_idx on messages (conversation_id, created_at);

   alter table chat_users enable row level security;
   alter table conversations enable row level security;
   alter table messages enable row level security;

   create policy "anon read chat_users" on chat_users for select using (true);
   create policy "anon insert chat_users" on chat_users for insert with check (true);
   create policy "anon update chat_users" on chat_users for update using (true);

   create policy "anon read conversations" on conversations for select using (true);
   create policy "anon insert conversations" on conversations for insert with check (true);

   create policy "anon read messages" on messages for select using (true);
   create policy "anon insert messages" on messages for insert with check (true);
   create policy "anon update messages" on messages for update using (true);

   Same open-anon RLS model the rest of Yaza uses — there's no login, so
   there's no server-side way to check "is this really you". That's a
   deliberate trade-off, same one the resources/market/diagnosis projects
   already make. Fine for a small trusted campus app; just know a
   conversation is only private by not knowing its ID, not by real access
   control.
   ========================================================= */

const CONFIG = {
  connect: {
    url: "https://xhpqlwvricuvqumfxjhi.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHFsd3ZyaWN1dnF1bWZ4amhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODcwMzMsImV4cCI6MjEwMTk2MzAzM30.1HhRVg7hw9_cOaLbx8b0KoFcOE4ao-wkHs3hks2MoG4",
  },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---- Splash safety net FIRST, before anything that could throw ----
// createClient() below throws synchronously on a placeholder URL like
// "YOUR_CONNECT_SUPABASE_URL" (it's not a valid absolute URL). If that
// throw happened before these timers were registered, the splash screen
// would spin forever with no way to clear itself — which is exactly what
// you saw. Registering the timers first guarantees the splash always
// clears, configured or not.
function hideSplash() {
  const splash = $("#splashScreen");
  if (splash) splash.classList.add("hide");
}
window.addEventListener("load", () => setTimeout(hideSplash, 400));
setTimeout(hideSplash, 3000);

// ---- Detect "not configured yet" instead of crashing ----
const CONNECT_CONFIGURED = !CONFIG.connect.url.startsWith("YOUR_") && !CONFIG.connect.key.startsWith("YOUR_");

let sbConnect = null;
if (CONNECT_CONFIGURED) {
  try {
    sbConnect = window.supabase.createClient(CONFIG.connect.url, CONFIG.connect.key);
  } catch (err) {
    console.error("Connect: couldn't create the Supabase client.", err);
  }
}

function showNotConfiguredState() {
  hideSplash();
  const gate = $("#nameGateOverlay");
  if (gate) gate.classList.add("hidden"); // don't prompt for a name if there's nowhere to save it
  const chip = $("#chatFilterChips");
  if (chip) chip.style.display = "none";
  const newChatBtn = $("#newChatBtn");
  if (newChatBtn) newChatBtn.style.display = "none";
  const list = $("#chatList");
  if (list) {
    list.innerHTML = `<div class="empty-state"><h3>Connect isn't set up yet</h3><p>This page is waiting on a Supabase project — see the setup comment at the top of connect.js for the SQL to run, then paste the project's URL and anon key into the CONFIG block near the top of that file.</p></div>`;
  }
}

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
document.body.setAttribute("data-theme", localStorage.getItem("yaza-theme") || "dark");

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
const ONLINE_WINDOW_MS = 60 * 1000; // "online" = active in the last 60s
function isOnline(lastSeenIso) {
  return lastSeenIso && Date.now() - new Date(lastSeenIso).getTime() < ONLINE_WINDOW_MS;
}

// ---------- Identity (device display name — not a login) ----------
let myId = localStorage.getItem("yaza-chat-id");
let myName = localStorage.getItem("yaza-chat-name");

function showNameGate() { $("#nameGateOverlay").classList.remove("hidden"); }
function hideNameGate() { $("#nameGateOverlay").classList.add("hidden"); }

if (!CONNECT_CONFIGURED) {
  showNotConfiguredState();
} else if (myId && myName) {
  hideNameGate();
} else {
  showNameGate();
}

$("#nameGateSaveBtn").addEventListener("click", async () => {
  if (!sbConnect) {
    showToast("Connect isn't set up yet — see connect.js for setup steps", "error");
    return;
  }
  const name = $("#nameGateInput").value.trim();
  if (!name) {
    showToast("Please enter a name", "error");
    return;
  }
  $("#nameGateSaveBtn").disabled = true;
  try {
    const { data, error } = await sbConnect.from("chat_users").insert({ name }).select().single();
    if (error) throw error;
    myId = data.id;
    myName = data.name;
    localStorage.setItem("yaza-chat-id", myId);
    localStorage.setItem("yaza-chat-name", myName);
    hideNameGate();
    startApp();
  } catch (err) {
    showToast("Couldn't save your name: " + err.message, "error");
  } finally {
    $("#nameGateSaveBtn").disabled = false;
  }
});

// ---------- Data ----------
let allChatUsers = [];
let conversationSummaries = []; // {conversation, otherUser, lastMessage, unreadCount}
let activeConversationId = null;
let activeOtherUser = null;
let activeChatFilter = "all";

function pairKey(idA, idB) {
  return [idA, idB].sort();
}

async function getOrCreateConversation(otherId) {
  const [a, b] = pairKey(myId, otherId);
  const { data: existing, error: findErr } = await sbConnect
    .from("conversations")
    .select("*")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;
  const { data: created, error: createErr } = await sbConnect
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select()
    .single();
  if (createErr) throw createErr;
  return created;
}

async function loadChatUsers() {
  const { data, error } = await sbConnect.from("chat_users").select("*").order("name", { ascending: true });
  if (error) { console.error(error); return; }
  allChatUsers = (data || []).filter((u) => u.id !== myId);
}

async function loadConversations() {
  const { data: convos, error } = await sbConnect
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);
  if (error) {
    $("#chatList").innerHTML = `<div class="empty-state"><h3>Couldn't load chats</h3><p>${escapeHTML(error.message)}</p></div>`;
    return;
  }

  const usersById = new Map(allChatUsers.map((u) => [u.id, u]));

  const summaries = await Promise.all(
    (convos || []).map(async (c) => {
      const otherId = c.user_a === myId ? c.user_b : c.user_a;
      const otherUser = usersById.get(otherId) || { id: otherId, name: "Unknown" };
      const { data: msgs } = await sbConnect
        .from("messages")
        .select("*")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(30);
      const lastMessage = (msgs || [])[0] || null;
      const unreadCount = (msgs || []).filter((m) => m.sender_id !== myId && !m.read_at).length;
      return { conversation: c, otherUser, lastMessage, unreadCount };
    })
  );

  summaries.sort((x, y) => {
    const tx = x.lastMessage ? new Date(x.lastMessage.created_at).getTime() : new Date(x.conversation.created_at).getTime();
    const ty = y.lastMessage ? new Date(y.lastMessage.created_at).getTime() : new Date(y.conversation.created_at).getTime();
    return ty - tx;
  });

  conversationSummaries = summaries;
  renderChatList();
}

function renderChatList() {
  const wrap = $("#chatList");
  let items = conversationSummaries;
  if (activeChatFilter === "unread") items = items.filter((s) => s.unreadCount > 0);
  if (activeChatFilter === "online") items = items.filter((s) => isOnline(s.otherUser.last_seen));

  if (items.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No chats yet</h3><p>Tap "Start a New Chat" to message another Yaza student.</p></div>`;
    return;
  }

  wrap.innerHTML = items
    .map((s) => {
      const online = isOnline(s.otherUser.last_seen);
      return `
      <div class="chat-list-item" data-conv-id="${s.conversation.id}" data-other-id="${s.otherUser.id}">
        <div class="chat-avatar">
          ${s.otherUser.avatar_url ? `<img src="${escapeHTML(s.otherUser.avatar_url)}" alt="">` : escapeHTML(initials(s.otherUser.name))}
          ${online ? `<span class="chat-online-dot"></span>` : ""}
        </div>
        <div class="chat-list-body">
          <div class="chat-list-name">${escapeHTML(s.otherUser.name)}</div>
          <div class="chat-list-preview">${s.lastMessage ? (s.lastMessage.sender_id === myId ? "You: " : "") + escapeHTML(s.lastMessage.body) : "Say hello 👋"}</div>
        </div>
        <div class="chat-list-meta">
          <span class="chat-list-time">${s.lastMessage ? fmtTime(s.lastMessage.created_at) : ""}</span>
          ${s.unreadCount > 0 ? `<span class="chat-unread-badge">${s.unreadCount}</span>` : ""}
        </div>
      </div>`;
    })
    .join("");

  $$(".chat-list-item").forEach((el) =>
    el.addEventListener("click", () => openThread(el.dataset.convId, el.dataset.otherId))
  );
}

$$("#chatFilterChips .chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    $$("#chatFilterChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeChatFilter = chip.dataset.filter;
    renderChatList();
  })
);

// ---------- New chat directory ----------
$("#newChatBtn").addEventListener("click", () => {
  renderDirectory();
  openModal("#directoryModal");
});
$("#directorySearch").addEventListener("input", () => renderDirectory($("#directorySearch").value));

function renderDirectory(term = "") {
  const wrap = $("#directoryList");
  const t = term.trim().toLowerCase();
  const list = t ? allChatUsers.filter((u) => u.name.toLowerCase().includes(t)) : allChatUsers;
  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><h3>No one here yet</h3><p>You'll be the first — share the app so others can join!</p></div>`;
    return;
  }
  wrap.innerHTML = list
    .map(
      (u) => `
    <div class="directory-item" data-id="${u.id}">
      <div class="chat-avatar">${u.avatar_url ? `<img src="${escapeHTML(u.avatar_url)}" alt="">` : escapeHTML(initials(u.name))}${isOnline(u.last_seen) ? `<span class="chat-online-dot"></span>` : ""}</div>
      <div class="chat-list-body"><div class="chat-list-name">${escapeHTML(u.name)}</div></div>
    </div>`
    )
    .join("");
  $$(".directory-item").forEach((el) =>
    el.addEventListener("click", async () => {
      closeModal("#directoryModal");
      try {
        const convo = await getOrCreateConversation(el.dataset.id);
        await loadChatUsers();
        await loadConversations();
        openThread(convo.id, el.dataset.id);
      } catch (err) {
        showToast("Couldn't start chat: " + err.message, "error");
      }
    })
  );
}

// ---------- Thread view ----------
async function openThread(conversationId, otherId) {
  activeConversationId = conversationId;
  activeOtherUser = allChatUsers.find((u) => u.id === otherId) || { id: otherId, name: "Unknown" };

  $("#listView").style.display = "none";
  $("#threadView").classList.add("active");
  $("#threadName").textContent = activeOtherUser.name;
  $("#threadAvatar").innerHTML = activeOtherUser.avatar_url
    ? `<img src="${escapeHTML(activeOtherUser.avatar_url)}" alt="">`
    : escapeHTML(initials(activeOtherUser.name));
  $("#threadStatus").textContent = isOnline(activeOtherUser.last_seen) ? "Online" : "Offline";

  await refreshThread();
  await markThreadRead();
}

$("#threadBackBtn").addEventListener("click", () => {
  activeConversationId = null;
  activeOtherUser = null;
  $("#threadView").classList.remove("active");
  $("#listView").style.display = "";
  loadConversations();
});

async function refreshThread() {
  if (!activeConversationId) return;
  const { data, error } = await sbConnect
    .from("messages")
    .select("*")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: true });
  if (error) return;
  const box = $("#threadMessages");
  const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = (data || [])
    .map((m) => {
      const mine = m.sender_id === myId;
      return `
      <div class="msg-row ${mine ? "mine" : ""}">
        <div>
          <div class="msg-bubble">${escapeHTML(m.body)}</div>
          <div class="msg-meta">${fmtTime(m.created_at)}${mine ? ` ${ICON(m.read_at ? "checkCheck" : "check", { size: 12 })}` : ""}</div>
        </div>
      </div>`;
    })
    .join("");
  if (wasAtBottom) box.scrollTop = box.scrollHeight;
}

async function markThreadRead() {
  if (!activeConversationId) return;
  await sbConnect
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", activeConversationId)
    .neq("sender_id", myId)
    .is("read_at", null);
}

async function sendMessage() {
  const input = $("#threadInput");
  const body = input.value.trim();
  if (!body || !activeConversationId) return;
  input.value = "";
  $("#threadSendBtn").disabled = true;
  try {
    await sbConnect.from("messages").insert({ conversation_id: activeConversationId, sender_id: myId, body });
    await refreshThread();
    const box = $("#threadMessages");
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    showToast("Message didn't send: " + err.message, "error");
    input.value = body;
  } finally {
    $("#threadSendBtn").disabled = false;
  }
}
$("#threadSendBtn").addEventListener("click", sendMessage);
$("#threadInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

// ---------- Presence heartbeat + polling ----------
async function heartbeat() {
  if (!myId) return;
  await sbConnect.from("chat_users").update({ last_seen: new Date().toISOString() }).eq("id", myId);
}

async function pollTick() {
  if (!myId) return;
  await loadChatUsers();
  if (activeConversationId) {
    await refreshThread();
    await markThreadRead();
    if (activeOtherUser) {
      const fresh = allChatUsers.find((u) => u.id === activeOtherUser.id);
      if (fresh) { activeOtherUser = fresh; $("#threadStatus").textContent = isOnline(fresh.last_seen) ? "Online" : "Offline"; }
    }
  } else {
    await loadConversations();
  }
}

async function startApp() {
  await loadChatUsers();
  await loadConversations();
  heartbeat();
  setInterval(heartbeat, 20000);
  setInterval(pollTick, 4000);
}

if (CONNECT_CONFIGURED && myId && myName) startApp();
