// POST {image: base64 JPEG} → {id}. Photos go up one at a time so we never hit request-size limits.
const { requireAuth, uploadPhoto } = require("./_lib");

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b64 = String((req.body && req.body.image) || "").replace(/^data:image\/\w+;base64,/, "");
    if (!b64) return res.status(400).json({ error: "No photo." });
    res.json({ id: await uploadPhoto(b64, "photo-" + Date.now() + ".jpg") });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
