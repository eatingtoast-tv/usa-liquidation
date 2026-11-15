// GET → newest items.  POST {name, price, retail, category, condition, description, size, photos:[uploadIds]} → new item.
// PATCH {id, status?, price?, retail?, name?, description?} → update.  DELETE {id} → moves to Notion trash.
const { DB, requireAuth, notion, fileRefs, refreshSite, txt, rich } = require("./_lib");

const num = v => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const b = req.body || {};
  try {
    if (req.method === "GET") {
      const q = await notion(`databases/${DB.furniture}/query`, {
        method: "POST",
        body: { page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] },
      });
      return res.json({
        items: q.results.map(p => {
          const pr = p.properties;
          const ph = (pr.Photos && pr.Photos.files) || [];
          return {
            id: p.id, name: txt(pr.Item), price: pr.Price.number, retail: pr["Retail Price"].number,
            status: (pr.Status.select && pr.Status.select.name) || "Available",
            category: (pr.Category.select && pr.Category.select.name) || "",
            condition: (pr.Condition.select && pr.Condition.select.name) || "",
            description: txt(pr.Description),
            photo: ph[0] ? (ph[0].file || ph[0].external || {}).url : "",
            added: p.created_time,
          };
        }),
      });
    }
    if (req.method === "POST") {
      if (!b.name) return res.status(400).json({ error: "Give it a name." });
      const props = {
        Item: { title: rich(b.name) },
        Price: { number: num(b.price) },
        "Retail Price": { number: num(b.retail) },
        Status: { select: { name: "Available" } },
        Description: { rich_text: rich(b.description) },
        "Size / Dimensions": { rich_text: rich(b.size) },
      };
      if (b.category) props.Category = { select: { name: b.category } };
      if (b.condition) props.Condition = { select: { name: b.condition } };
      if (b.photos && b.photos.length) props.Photos = { files: fileRefs(b.photos) };
      const page = await notion("pages", { method: "POST", body: { parent: { database_id: DB.furniture }, properties: props } });
      return res.json({ ok: true, id: page.id, refreshed: await refreshSite() });
    }
    if (req.method === "PATCH") {
      if (!b.id) return res.status(400).json({ error: "Missing item." });
      const props = {};
      if (b.status) props.Status = { select: { name: b.status } };
      if ("price" in b) props.Price = { number: num(b.price) };
      if ("retail" in b) props["Retail Price"] = { number: num(b.retail) };
      if (b.name) props.Item = { title: rich(b.name) };
      if ("description" in b) props.Description = { rich_text: rich(b.description) };
      await notion("pages/" + b.id, { method: "PATCH", body: { properties: props } });
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    if (req.method === "DELETE") {
      if (!b.id) return res.status(400).json({ error: "Missing item." });
      await notion("pages/" + b.id, { method: "PATCH", body: { archived: true } }); // recoverable from Notion trash
      return res.json({ ok: true, refreshed: await refreshSite() });
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
