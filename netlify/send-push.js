// Netlify Function: send-push
//
// Replaces the old Supabase Edge Function. Supabase Database Webhooks
// (configured on the resources / market_listings / announcements tables)
// still TRIGGER this — that's just Postgres calling a URL on insert, same
// as before — but the actual push delivery now goes through OneSignal's
// own infrastructure instead of a hand-rolled VAPID/web-push setup.
// Nothing about sending the notification touches Supabase.
//
// Deploy: this file just needs to be included in the site folder you
// drag-and-drop to Netlify, at netlify/functions/send-push.js, alongside
// the netlify.toml in the project root. Netlify picks it up automatically.
// URL once deployed: https://YOUR-SITE.netlify.app/.netlify/functions/send-push
//
// Required environment variables (set in Netlify: Site configuration →
// Environment variables — see SETUP.md §9):
//   ONESIGNAL_APP_ID        - same App ID used in app.js CONFIG.oneSignalAppId
//   ONESIGNAL_REST_API_KEY  - SECRET. Never put this in app.js/admin.js.
//   WEBHOOK_SECRET           - optional, but recommended: a random string
//                              you also paste into each Supabase webhook's
//                              custom header (see SETUP.md §9c) so random
//                              strangers can't POST here and spam everyone.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
    if (got !== expectedSecret) {
      return { statusCode: 401, body: "Unauthorized" };
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // Supabase Database Webhook payload shape: { type, table, record, schema, old_record }
  const table = payload.table;
  const record = payload.record || {};

  let title = "KUHeS Yaza";
  let body = "Something new was posted.";

  if (table === "resources") {
    title = "New resource shared";
    body = record.title || "A new document was uploaded.";
  } else if (table === "market_listings") {
    title = "New marketplace item";
    body = record.title || "A new item was listed.";
  } else if (table === "announcements") {
    title = record.title || "New announcement";
    body = record.body || "Tap to view.";
  } else {
    // Unknown table — ignore silently so unrelated webhooks don't error out.
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    console.error("Missing ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY env vars");
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "OneSignal not configured" }) };
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["Subscribed Users"],
        headings: { en: title },
        contents: { en: body },
        url: "/",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("OneSignal error:", data);
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: data }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, recipients: data.recipients ?? null }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
