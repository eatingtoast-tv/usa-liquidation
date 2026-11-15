// Face ID / fingerprint login (WebAuthn passkeys) — no database needed.
// After a normal username+password login, the phone makes a passkey. We hand the phone back a
// "ticket" (its public key, signed with ADMIN_SECRET). To log in with Face ID the phone sends the
// ticket + a signature only its Face ID–protected key can make. Changing ADMIN_SECRET cancels every ticket.
//   GET  /api/passkey                  → {challenge}
//   POST /api/passkey {op:"register"}  → {ticket}   (must already be logged in)
//   POST /api/passkey {op:"login"}     → sets the login cookie
const crypto = require("crypto");
const { makeToken, validToken, readCookie, setCookie, DAYS } = require("./_lib");

const SECRET = () => process.env.ADMIN_SECRET || "dev-secret";
const b64u = buf => Buffer.from(buf).toString("base64url");
const fromB64u = s => Buffer.from(String(s || ""), "base64url");
const hmac = s => crypto.createHmac("sha256", SECRET()).update(s).digest("base64url");

function newChallenge() {
  const body = Date.now() + "." + b64u(crypto.randomBytes(16));
  return b64u(body + "." + hmac("chal:" + body));
}
function challengeOk(ch) {
  const parts = fromB64u(ch).toString().split(".");
  if (parts.length !== 3) return false;
  const body = parts[0] + "." + parts[1];
  return parts[2] === hmac("chal:" + body) && Date.now() - Number(parts[0]) < 5 * 60e3;
}
function host(req) { return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0]; }
function checkClientData(req, clientDataB64, type) {
  const cd = JSON.parse(fromB64u(clientDataB64).toString());
  if (cd.type !== type) throw new Error("bad type");
  if (!challengeOk(fromB64u(cd.challenge).toString())) throw new Error("expired — try again");
  if (new URL(cd.origin).hostname !== host(req)) throw new Error("wrong site");
}

module.exports = async (req, res) => {
  if (req.method === "GET") return res.json({ challenge: newChallenge() });
  if (req.method !== "POST") return res.status(405).end();
  const b = req.body || {};
  try {
    if (b.op === "register") {
      if (!validToken(readCookie(req))) return res.status(401).json({ error: "Log in with your password first." });
      checkClientData(req, b.clientDataJSON, "webauthn.create");
      const pub = fromB64u(b.publicKey); // SPKI DER from the browser
      crypto.createPublicKey({ key: pub, format: "der", type: "spki" }); // throws if junk
      const payload = b64u(JSON.stringify({ id: b.credId, pk: b64u(pub), alg: Number(b.alg) || -7 }));
      return res.json({ ticket: payload + "." + hmac("ticket:" + payload) });
    }
    if (b.op === "login") {
      const [payload, sig] = String(b.ticket || "").split(".");
      if (!payload || sig !== hmac("ticket:" + payload)) return res.status(401).json({ error: "Face ID was turned off. Log in with your password." });
      const t = JSON.parse(fromB64u(payload).toString());
      if (t.id !== b.credId) throw new Error("wrong key");
      checkClientData(req, b.clientDataJSON, "webauthn.get");
      const auth = fromB64u(b.authenticatorData);
      const rpHash = crypto.createHash("sha256").update(host(req)).digest();
      if (!auth.subarray(0, 32).equals(rpHash)) throw new Error("wrong site");
      if ((auth[32] & 0x05) !== 0x05) throw new Error("Face ID not confirmed"); // user present + verified
      const signed = Buffer.concat([auth, crypto.createHash("sha256").update(fromB64u(b.clientDataJSON)).digest()]);
      const key = crypto.createPublicKey({ key: fromB64u(t.pk), format: "der", type: "spki" });
      const ok = t.alg === -257
        ? crypto.verify("sha256", signed, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, fromB64u(b.signature))
        : crypto.verify("sha256", signed, key, fromB64u(b.signature));
      if (!ok) throw new Error("signature didn't match");
      setCookie(res, makeToken(), DAYS * 86400);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: "?" });
  } catch (e) { res.status(401).json({ error: "Face ID didn't work (" + e.message + "). Use your password." }); }
};
