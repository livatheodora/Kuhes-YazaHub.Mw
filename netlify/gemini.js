// Netlify Function: gemini
//
// Keeps the Google AI Studio key OFF the website code (and off GitHub).
// The browser calls /.netlify/functions/gemini with the same JSON body it
// used to send to Google; this function adds the key and forwards it.
//
// Setup (Netlify -> Site configuration -> Environment variables):
//   GEMINI_API_KEY   - your Google AI Studio key (never put it in app.js)

const MODEL = "gemini-flash-latest";
const MAX_BODY_BYTES = 30000; // small guard against abuse

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "AI isn't set up yet — GEMINI_API_KEY is missing on the server." };
  }
  if ((event.body || "").length > MAX_BODY_BYTES) {
    return { statusCode: 413, body: "Request too large" };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: event.body || "{}",
      }
    );
    const text = await res.text();
    return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: text };
  } catch (err) {
    return { statusCode: 502, body: "AI request failed: " + String(err) };
  }
};
