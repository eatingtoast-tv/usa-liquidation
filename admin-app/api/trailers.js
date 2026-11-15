// GET → trailers.  POST {name, price, status, size, features, description, photos} → new trailer.
// POST {gallery:true, caption, photos} → adds to the "Trailers we've sold" gallery.
// PATCH {id, status?, price?} → update.
const { DB, requireAuth, notion, fileRefs, refreshSite, txt, rich } = require("./_lib");

const num = v => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const b = req.body || {};
  try {
    if (req.method === "GET") {
      const q = await notion(`databases/${DB.trailers}/query`, { method: "POST", body: { sorts: [{ timestamp: "created_time", direction: "descending" }] } });
      return res.json({
        items: q.results.map(p => {
          const pr = p.properties, ph = (pr.Photos && pr.Photos.files) || [];
          return {
            id: p.id, name: txt(pr.Trailer), price: pr.Price.number,
            status: (pr.Status.select && pr.Status.select.name) || "In Stock",
            size: (pr.Size.select && pr.Size.select.name) || "",
            photo: ph[0] ? (ph[0].file || ph[0].external || {}).url : "",
          };
        }),
      });
    }
    if (req.method === "POST" && b.gallery) {
      if (!b.photos || !b.photos.length) return res.status(400).json({ error: "No photo." });
      await notion("pages", { method: "POST", body: { parent: { database_id: DB.gallery }, properties: {
        Caption: { title: rich(b.caption || "Food trailer") }, Photos: { files: fileRefs(b.photos) } } } });
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    if (req.method === "POST") {
      if (!b.name) return res.status(400).json({ error: "Give it a name." });
      const props = {
        Trailer: { title: rich(b.name) }, Price: { number: num(b.price) },
        Status: { select: { name: b.status || "In Stock" } },
        Features: { rich_text: rich(b.features) }, Description: { rich_text: rich(b.description) },
      };
      if (b.size) props.Size = { select: { name: b.size } };
      if (b.photos && b.photos.length) props.Photos = { files: fileRefs(b.photos) };
      const page = await notion("pages", { method: "POST", body: { parent: { database_id: DB.trailers }, properties: props } });
      return res.json({ ok: true, id: page.id, refreshed: await refreshSite() });
    }
    if (req.method === "PATCH") {
      const props = {};
      if (b.status) props.Status = { select: { name: b.status } };
      if ("price" in b) props.Price = { number: num(b.price) };
      await notion("pages/" + b.id, { method: "PATCH", body: { properties: props } });
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
