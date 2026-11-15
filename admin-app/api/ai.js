// POST {image: base64 JPEG} → {name, category, condition, description, size}
// Gemini looks at the photo and fills the form. Dad can change anything before saving.
const { requireAuth } = require("./_lib");

const CATEGORIES = ["Living Room", "Bedroom", "Dining", "Office", "Outdoor", "Decor & Other", "Gym Equipments"];
const CONDITIONS = ["New", "New - Open Box", "Like New", "Good", "Fair"];

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const b64 = String((req.body && req.body.image) || "").replace(/^data:image\/\w+;base64,/, "");
  if (!b64) return res.status(400).json({ error: "No photo." });

  const prompt = `You help a discount furniture store in Gastonia, NC list items on its website.
Look at the photo and return JSON only:
{"name": short shopper-friendly product name (2-6 words, Title Case, include color/material if obvious, no brand guesses),
 "category": one of ${JSON.stringify(CATEGORIES)},
 "condition": one of ${JSON.stringify(CONDITIONS)} (judge from the photo; if it looks new in packaging use "New", if unsure use "Like New"),
 "description": 1-2 friendly sentences a shopper would want to know (style, material, features). No prices, no made-up measurements,
 "size": rough size words like "Queen" or "3-seat" only if obvious, else ""}`;

  try {
    // try a few models — Gemini sometimes says "busy"; each try gives up after 12s
    const models = [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-flash-latest"].filter(Boolean);
    let data, last = "unknown";
    for (const model of models) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_KEY || "")}`, {
          method: "POST", signal: AbortSignal.timeout(12000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
          }),
        });
        const d = await r.json();
        if (r.ok && d.candidates) { data = d; break; }
        last = (d.error && d.error.message) || "AI error " + r.status;
      } catch (e) { last = e.message; }
    }
    if (!data) throw new Error(last);
    const raw = data.candidates[0].content.parts.map(p => p.text || "").join("");
    const out = JSON.parse(raw.replace(/^```json|```$/g, "").trim());
    if (!CATEGORIES.includes(out.category)) out.category = "Decor & Other";
    if (!CONDITIONS.includes(out.condition)) out.condition = "Like New";
    res.json({ name: out.name || "", category: out.category, condition: out.condition, description: out.description || "", size: out.size || "" });
  } catch (e) { res.status(500).json({ error: "Auto-fill didn't work — just type it in. (" + e.message + ")" }); }
};
