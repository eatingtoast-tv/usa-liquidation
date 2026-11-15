// POST {username, password} → logs in (sets a 60-day cookie).  GET → {loggedIn}.  DELETE → logs out.
const crypto = require("crypto");
const { makeToken, validToken, readCookie, setCookie, DAYS } = require("./_lib");

const tries = new Map(); // simple brute-force slowdown per IP (per warm instance)

module.exports = async (req, res) => {
  if (req.method === "GET") return res.json({ loggedIn: validToken(readCookie(req)) });
  if (req.method === "DELETE") { setCookie(res, "", 0); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "?";
  const t = tries.get(ip) || { n: 0, at: 0 };
  if (t.n >= 8 && Date.now() - t.at < 15 * 60e3) return res.status(429).json({ error: "Too many tries. Wait 15 minutes." });

  // compare hashes so the check takes the same time no matter what was typed
  const same = (a, b) => crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());
  const wantU = (process.env.ADMIN_USERNAME || "").trim().toLowerCase(), wantP = process.env.ADMIN_PASSWORD || "";
  const gotU = String((req.body && req.body.username) || "").trim().toLowerCase(), gotP = String((req.body && req.body.password) || "");
  const ok = !!(wantU && wantP) && same(gotU, wantU) & same(gotP, wantP);
  if (!ok) {
    tries.set(ip, { n: t.n + 1, at: Date.now() });
    await new Promise(r => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong username or password." });
  }
  tries.delete(ip);
  setCookie(res, makeToken(), DAYS * 86400);
  res.json({ ok: true });
};
