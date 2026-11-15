// POST {password} → logs in (sets a 60-day cookie).  GET → {loggedIn}.  DELETE → logs out.
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

  const want = process.env.ADMIN_PASSWORD || "";
  const got = String((req.body && req.body.password) || "");
  const ok = want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) {
    tries.set(ip, { n: t.n + 1, at: Date.now() });
    await new Promise(r => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong password." });
  }
  tries.delete(ip);
  setCookie(res, makeToken(), DAYS * 86400);
  res.json({ ok: true });
};
