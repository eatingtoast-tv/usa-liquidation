// Paste the USA Liquidation GoHighLevel inbound-webhook URL here (Automation > Workflow > Inbound Webhook trigger).
// Empty = leads are only logged to the browser console (nothing is saved).
// Field names match the Toast Bouquets form, so a copied workflow maps the same way.
const WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/IzIkflU0YiNgBg8dzTas/webhook-trigger/WwKVvodsZWwx6r34bkU0";

const $ = id => document.getElementById(id);

// In-stock trailers
fetch("data/trailers.json", { cache: "no-store" }).then(r => r.json()).then(d => {
  if (!(d.items || []).length) { // nothing in stock → hide the section + its hero button
    $("stock").hidden = true;
    document.querySelector('a[href="#stock"]')?.remove();
    return;
  }
  $("tGrid").innerHTML = d.items.map(t => `
    <div class="trailer">
      <div class="ph"><img loading="lazy" src="${t.photo}" alt="${t.name}" /><span class="badge ${t.status === "In Stock" ? "stock" : "soon"}">${t.status}</span></div>
      <div class="info">
        <h3 style="margin-bottom:2px">${t.name}</h3>
        <span class="muted" style="font-size:.92rem">${t.price}</span>
        <ul>${t.specs.map(s => `<li>${s}</li>`).join("")}</ul>
        <div class="row">
          <a class="btn btn-primary btn-sm" href="${smsLink(`Hi! I'm interested in the ${t.name} on your website.`)}">Text Us</a>
          <a class="btn btn-ghost btn-sm" href="${telLink()}">Call</a>
        </div>
      </div>
    </div>`).join("");
});


// Photo gallery (Notion > Website > Trailer Gallery)
const lb = $("lightbox");
fetch("data/gallery.json", { cache: "no-store" }).then(r => r.json()).then(d => {
  const shots = d.photos || [];
  if (!shots.length) { $("work").hidden = true; return; }
  $("gallery").innerHTML = shots.map((p, i) => `<button class="shot" data-i="${i}"><img loading="lazy" src="${p.src}" alt="${p.caption || "Food trailer we built"}" />${p.caption ? `<span class="shot-cap">${p.caption}</span>` : ""}</button>`).join("");
  $("gallery").addEventListener("click", e => {
    const b = e.target.closest(".shot"); if (!b) return;
    const p = shots[b.dataset.i];
    lb.querySelector("img").src = p.src; lb.querySelector(".lb-cap").textContent = p.caption || "";
    lb.classList.add("open");
  });
});
lb.addEventListener("click", e => { if (e.target.tagName !== "IMG") lb.classList.remove("open"); });
document.addEventListener("keydown", e => { if (e.key === "Escape") lb.classList.remove("open"); });

// Chips
document.querySelectorAll(".chips[data-name]").forEach(g => {
  const single = g.hasAttribute("data-single");
  g.addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    if (single) g.querySelectorAll(".chip").forEach(x => x !== c && x.classList.remove("on"));
    c.classList.toggle("on");
  });
});
const chipVals = n => [...document.querySelectorAll(`.chips[data-name="${n}"] .chip.on`)].map(c => c.textContent.trim());

const form = $("quoteForm");
function step(s) {
  form.querySelectorAll(".q-step").forEach(x => x.classList.toggle("active", x.dataset.step === String(s)));
  $("qBar").style.width = s === 1 ? "50%" : "100%";
  $("qLabel").textContent = s === 1 ? "Step 1 of 2 · Your trailer" : s === 2 ? "Step 2 of 2 · Your info" : "All done";
}
$("qNext").onclick = () => {
  if (!chipVals("size").length) return ($("err1").textContent = "Pick a trailer size.");
  if (!chipVals("food").length) return ($("err1").textContent = "Pick at least one food type.");
  if (!form.budget.value) return ($("err1").textContent = "Choose a budget range.");
  $("err1").textContent = ""; step(2);
};
$("qBack").onclick = () => step(1);
$("consent").onchange = e => ($("qSubmit").disabled = !e.target.checked);

// Phone: always shows as 980-222-1515, even when the browser autofills "+1 (980) 222-1515"
const phone = $("phone");
const tenDigits = v => { let d = v.replace(/\D/g, ""); if (d.length > 10 && d[0] === "1") d = d.slice(1); return d.slice(0, 10); };
const fmtPhone = d => d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
const fixPhone = () => { phone.value = fmtPhone(tenDigits(phone.value)); };
["input", "change", "blur"].forEach(ev => phone.addEventListener(ev, fixPhone));

form.addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("err2"), f = form;
  if (!f.first_name.value.trim() || !f.last_name.value.trim()) return (err.textContent = "Enter your first and last name.");
  fixPhone(); const digits = tenDigits(phone.value);
  if (digits.length < 10) return (err.textContent = "Enter a valid 10-digit phone number.");
  if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return (err.textContent = "Enter a valid email.");
  err.textContent = "";
  const data = {
    first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(),
    full_name: `${f.first_name.value.trim()} ${f.last_name.value.trim()}`,
    phone: fmtPhone(digits), email: f.email.value.trim(),
    trailer_size: chipVals("size").join(", "), food_type: chipVals("food").join(", "), order_type: "Food Trailer",
    budget: f.budget.value, sms_consent: "yes",
    submitted_at: new Date().toISOString(), source: "USA Liquidation Website — Trailers",
  };
  $("qSubmit").disabled = true; $("qSubmit").textContent = "Sending…";
  try {
    if (WEBHOOK_URL) {
      const r = await fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status);
    } else console.log("[USA Liquidation] Quote request (no webhook yet):", data);
    step("done");
  } catch (ex) {
    err.textContent = "Something went wrong — please call or text us.";
    $("qSubmit").disabled = false; $("qSubmit").textContent = "Get My Free Quote";
  }
});
