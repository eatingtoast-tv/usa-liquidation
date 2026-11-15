// GET → the 7 day rows.  PATCH {id, price?, open?, note?} → update a day.
// POST {day, photos:[uploadId]} → sets that day's bins photo (the site shows today's photo first).
const { DB, requireAuth, notion, fileRefs, refreshSite, txt, rich } = require("./_lib");

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const b = req.body || {};
  try {
    const q = await notion(`databases/${DB.bins}/query`, { method: "POST", body: { sorts: [{ property: "Order", direction: "ascending" }] } });
    const days = q.results.map(p => ({
      id: p.id, day: txt(p.properties.Day), price: p.properties.Price.number,
      open: p.properties.Open.checkbox, note: txt(p.properties.Note),
      hasPhoto: ((p.properties.Photo && p.properties.Photo.files) || []).length > 0,
    }));
    if (req.method === "GET") return res.json({ days });
    if (req.method === "PATCH") {
      const props = {};
      if ("price" in b) props.Price = { number: b.price === "" || b.price === null ? null : Number(b.price) };
      if ("open" in b) props.Open = { checkbox: !!b.open };
      if ("note" in b) props.Note = { rich_text: rich(b.note) };
      await notion("pages/" + b.id, { method: "PATCH", body: { properties: props } });
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    if (req.method === "POST") {
      const row = days.find(d => d.day.toLowerCase() === String(b.day || "").toLowerCase());
      if (!row) return res.status(400).json({ error: "Pick a day." });
      if (!b.photos || !b.photos.length) return res.status(400).json({ error: "No photo." });
      await notion("pages/" + row.id, { method: "PATCH", body: { properties: { Photo: { files: fileRefs(b.photos) } } } });
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
