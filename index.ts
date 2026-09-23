// Supabase Edge Function: send-push
// Deploy this to Project 5 (yaza-announcements). It's called by Database
// Webhooks (set up on resources / market_listings / announcements tables)
// whenever a new row is inserted, and pushes a real notification-tray
// alert to every phone that has notifications enabled.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:otechy8@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook payload shape: { type, table, record, schema, old_record }
    const table = payload.table;
    const record = payload.record || {};

    let title = "KUHeS Yaza";
    let body = "Something new was posted.";

    if (table === "resources") {
      title = "📄 New resource shared";
      body = record.title || "A new document was uploaded.";
    } else if (table === "market_listings") {
      title = "🛒 New marketplace item";
      body = record.title || "A new item was listed.";
    } else if (table === "announcements") {
      title = "📢 " + (record.title || "New announcement");
      body = record.body || "Tap to view.";
    } else {
      // Unknown table — ignore silently so unrelated webhooks don't error out
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;

    const notifPayload = JSON.stringify({ title, body, url: "/" });

    let sent = 0;
    await Promise.all(
      (subs || []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            notifPayload
          );
          sent++;
        } catch (err: any) {
          // Subscription is dead (user uninstalled / cleared data) — remove it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
