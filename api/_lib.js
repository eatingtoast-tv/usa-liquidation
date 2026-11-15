// Shared helpers for the /admin dashboard API (Vercel serverless functions).
// Secrets live only in Vercel environment variables, never in the browser:
//   ADMIN_PASSWORD  – the password Dad types on /admin
//   ADMIN_SECRET    – random string used to sign the login cookie
//   NOTION_TOKEN    – the "USA Liquidation" Notion integration
//   GEMINI_KEY      – Google Gemini key for the photo auto-fill
//   GH_TOKEN        – (optional) GitHub token so saves refresh the public site right away
const crypto = require("crypto");

const DB = {
  furniture: "cd5a3943001d49b380ca228776a8c316",
  bins: "205bc40c9f7c4c3895c27c1df7c521d9",
  trailers: "61d44df71efe425abcedda49655f490d",
  gallery: "61b716733d8e4602b7ae3cbf0167f972",
};
const COOKIE = "usa_admin";
const DAYS = 60;

function sign(exp) {
  return crypto.createHmac("sha256", process.env.ADMIN_SECRET || "dev-secret").update(String(exp)).digest("hex");
}
function makeToken() {
  const exp = Date.now() + DAYS * 864e5;
  return exp + "." + sign(exp);
}
function validToken(tok) {
  if (!tok || !tok.includes(".")) return false;
  const [exp, sig] = tok.split(".");
  if (Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|; )" + COOKIE + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function setCookie(res, value, maxAgeSec) {
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`);
}
// Every protected route calls this first; returns false (and answers 401) if not logged in.
function requireAuth(req, res) {
  if (validToken(readCookie(req))) return true;
  res.status(401).json({ error: "Please log in again." });
  return false;
}

async function notion(path, { method = "GET", body } = {}) {
  const r = await fetch("https://api.notion.com/v1/" + path, {
    method,
    headers: {
      Authorization: "Bearer " + process.env.NOTION_TOKEN,
      "Notion-Version": "2022-06-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.message) || "Notion error " + r.status);
  return data;
}

// Upload one photo (base64 JPEG from the phone) to Notion's file storage; returns a file_upload id.
async function uploadPhoto(base64, filename = "photo.jpg") {
  const up = await notion("file_uploads", { method: "POST", body: { filename, content_type: "image/jpeg" } });
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(base64, "base64")], { type: "image/jpeg" }), filename);
  const r = await fetch(`https://api.notion.com/v1/file_uploads/${up.id}/send`, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.NOTION_TOKEN, "Notion-Version": "2022-06-28" },
    body: form,
  });
  if (!r.ok) throw new Error("Photo upload failed (" + r.status + ")");
  return up.id;
}
const fileRefs = ids => ids.map((id, i) => ({ type: "file_upload", file_upload: { id }, name: `photo-${i + 1}.jpg` }));

// Ask GitHub to run the Notion → website sync now (otherwise the Mac picks it up within ~5 minutes).
async function refreshSite() {
  if (!process.env.GH_TOKEN) return false;
  try {
    const r = await fetch("https://api.github.com/repos/eatingtoast-tv/usa-liquidation/actions/workflows/notion-sync.yml/dispatches", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "usa-admin" },
      body: JSON.stringify({ ref: "main" }),
    });
    return r.status === 204;
  } catch { return false; }
}

const txt = p => ((p && p[p.type]) || []).map(t => t.plain_text).join("");
const rich = s => [{ type: "text", text: { content: String(s || "").slice(0, 1900) } }];

module.exports = { DB, makeToken, validToken, readCookie, setCookie, requireAuth, notion, uploadPhoto, fileRefs, refreshSite, txt, rich, DAYS };
