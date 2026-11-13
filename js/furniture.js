// Where inventory comes from.
// Right now: a sample JSON file. Later: point this at the small Notion-sync endpoint
// (same field names: name, category, price, retail, condition, status, added, dims, description, photos).
const INVENTORY_URL = "data/furniture.json";

const $ = id => document.getElementById(id);
const money = n => "$" + Number(n).toLocaleString();
const isNew = d => (Date.now() - new Date(d)) / 864e5 <= 7;
let items = [], cat = "All";

function badge(it) {
  if (it.status === "Sold") return '<span class="badge sold">Sold</span>';
  if (it.status === "Pending") return '<span class="badge pending">On hold</span>';
  if (isNew(it.added)) return '<span class="badge new">New</span>';
  return "";
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const sort = $("sort").value;
  let list = items.filter(it =>
    (cat === "All" || it.category === cat) &&
    (!q || (it.name + " " + it.description + " " + it.category).toLowerCase().includes(q)));
  const rank = s => (s === "Sold" ? 1 : 0); // sold items sink to the bottom
  list.sort((a, b) => rank(a.status) - rank(b.status) ||
    (sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : new Date(b.added) - new Date(a.added)));

  $("grid").innerHTML = list.map(it => {
    const off = it.retail ? Math.round((1 - it.price / it.retail) * 100) : 0;
    return `<button class="item ${it.status === "Sold" ? "sold" : ""}" data-id="${it.id}">
      <div class="ph"><img loading="lazy" src="${it.photos[0]}" alt="${it.name}" />${badge(it)}</div>
      <div class="info">
        <span class="cat">${it.category} · ${it.condition}</span>
        <h3>${it.name}</h3>
        <div class="price-row"><span class="price">${money(it.price)}</span>${it.retail ? `<span class="retail">${money(it.retail)}</span>` : ""}${off > 0 && it.status !== "Sold" ? `<span class="save">${off}% off</span>` : ""}</div>
      </div></button>`;
  }).join("");
  $("empty").hidden = list.length > 0;
}

function renderCats() {
  const cats = ["All", ...new Set(items.map(i => i.category))];
  $("cats").innerHTML = cats.map(c => {
    const n = c === "All" ? items.length : items.filter(i => i.category === c).length;
    return `<button role="menuitem" class="${c === cat ? "on" : ""}" data-c="${c}"><span>${c === "All" ? "All Furniture" : c}</span><span class="n">${n}</span></button>`;
  }).join("");
  $("ddLabel").textContent = cat === "All" ? "All Furniture" : cat;
}
const dd = $("dd");
$("ddBtn").addEventListener("click", e => { e.stopPropagation(); const o = dd.classList.toggle("open"); $("ddBtn").setAttribute("aria-expanded", o); });
document.addEventListener("click", e => { if (!dd.contains(e.target)) dd.classList.remove("open"); });

function openItem(id) {
  const it = items.find(i => i.id === id); if (!it) return;
  $("mImg").src = it.photos[0]; $("mImg").alt = it.name;
  $("mCat").textContent = it.category;
  $("mName").textContent = it.name;
  $("mPrice").textContent = money(it.price);
  $("mRetail").textContent = it.retail ? "Retail " + money(it.retail) : "";
  $("mDesc").textContent = it.description;
  $("mSpecs").innerHTML = [["Condition", it.condition], ["Size", it.dims], ["Status", it.status === "Pending" ? "On hold" : it.status]]
    .map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
  const sold = it.status === "Sold";
  $("mText").textContent = sold ? "Text Us For Something Similar" : "Text Us About This";
  $("mText").href = smsLink(sold
    ? `Hi! I saw the ${it.name} sold — do you have anything similar?`
    : `Hi! I'm interested in the ${it.name} (${money(it.price)}) I saw on your website. Is it still available?`);
  $("modal").classList.add("open");
  $("modal").setAttribute("aria-hidden", "false");
}
function closeModal() { $("modal").classList.remove("open"); $("modal").setAttribute("aria-hidden", "true"); }

$("grid").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) openItem(b.dataset.id); });
$("cats").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cat = b.dataset.c; dd.classList.remove("open"); renderCats(); render(); });
$("q").addEventListener("input", render);
$("sort").addEventListener("change", render);
$("modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.classList.contains("modal-close")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

fetch(INVENTORY_URL, { cache: "no-store" }).then(r => r.json()).then(d => {
  items = d.items || [];
  const avail = items.filter(i => i.status !== "Sold").length;
  $("liveNote").textContent = avail
    ? `${avail} ${avail === 1 ? "piece" : "pieces"} available · updated as stuff comes in and sells`
    : "New pieces are being posted — text or call us to see what's on the floor today";
  if (!items.length) $("empty").innerHTML = `Our online inventory is being added now. <a href="${smsLink("Hi! What furniture do you have in stock right now?")}">Text us</a> or <a href="${telLink()}">call ${SITE.phoneDisplay}</a> and we'll send you pictures of what's in the store.`;
  renderCats(); render();
}).catch(() => { $("liveNote").textContent = "Couldn't load inventory — text us and we'll send you what's in stock."; });
