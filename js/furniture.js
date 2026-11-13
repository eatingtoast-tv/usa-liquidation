// Furniture inventory — comes from Notion > Website > Website Inventory (synced into data/furniture.json).
// Categories and conditions are read from Notion too, so new ones added there show up here automatically.
const INVENTORY_URL = "data/furniture.json";

const $ = id => document.getElementById(id);
const money = n => "$" + Number(n).toLocaleString();
const hasPrice = it => Number(it.price) > 0;
const known = v => v && v !== "—";
const isNew = d => (Date.now() - new Date(d)) / 864e5 <= 7;
let items = [], cat = "All", cond = "All", catOrder = [], condOrder = [];

function badge(it) {
  if (it.status === "Sold") return '<span class="badge sold">Sold</span>';
  if (it.status === "Pending") return '<span class="badge pending">On hold</span>';
  if (isNew(it.added)) return '<span class="badge new">New</span>';
  return "";
}

// Price row: nothing until a price is entered; then price + crossed-out retail + % off
function priceRow(it, big) {
  if (!hasPrice(it)) return "";
  const off = it.retail > it.price ? Math.round((1 - it.price / it.retail) * 100) : 0;
  return `<div class="price-row"${big ? ' style="padding-top:2px"' : ""}><span class="price">${money(it.price)}</span>` +
    (off > 0 ? `<span class="retail">${money(it.retail)}</span>` : "") +
    (off > 0 && it.status !== "Sold" ? `<span class="save">${off}% off</span>` : "") + "</div>";
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const sort = $("sort").value;
  let list = items.filter(it =>
    (cat === "All" || it.category === cat) &&
    (cond === "All" || it.condition === cond) &&
    (!q || (it.name + " " + it.description + " " + it.category + " " + (it.condition || "")).toLowerCase().includes(q)));
  const rank = s => (s === "Sold" ? 1 : 0); // sold items sink to the bottom
  list.sort((a, b) => rank(a.status) - rank(b.status) ||
    // items without a price go after priced ones when sorting by price
    (sort === "low" ? (a.price || 1e9) - (b.price || 1e9) : sort === "high" ? (b.price || 0) - (a.price || 0) : new Date(b.added) - new Date(a.added)));

  $("grid").innerHTML = list.map(it => `<button class="item ${it.status === "Sold" ? "sold" : ""}" data-id="${it.id}">
      <div class="ph"><img loading="lazy" src="${it.photos[0]}" alt="${it.name}" />${badge(it)}</div>
      <div class="info">
        <span class="cat">${it.category}${known(it.condition) ? ` · ${it.condition}` : ""}</span>
        <h3>${it.name}</h3>
        ${priceRow(it)}
      </div></button>`).join("");
  $("empty").hidden = list.length > 0;
}

// Notion's order first, then anything else that's in use
const ordered = (order, used) => [...order.filter(o => used.includes(o)), ...used.filter(u => !order.includes(u))];

function menu(el, labelEl, allLabel, values, field, current) {
  const shown = ordered(field === "category" ? catOrder : condOrder, values);
  el.innerHTML = ["All", ...shown].map(v => {
    const n = v === "All" ? items.length : items.filter(i => i[field] === v).length;
    return `<button role="menuitem" class="${v === current ? "on" : ""}" data-v="${v}"><span>${v === "All" ? allLabel : v}</span><span class="n">${n}</span></button>`;
  }).join("");
  labelEl.textContent = current === "All" ? allLabel : current;
}
function renderMenus() {
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
  const conds = [...new Set(items.map(i => i.condition).filter(known))];
  menu($("cats"), $("ddLabel"), "All Furniture", cats, "category", cat);
  menu($("conds"), $("ddLabel2"), "Any Condition", conds, "condition", cond);
  $("dd2").hidden = conds.length === 0;   // shows up as soon as a condition is set in Notion
}

// dropdown open/close
[["dd", "ddBtn"], ["dd2", "ddBtn2"]].forEach(([w, b]) => {
  $(b).addEventListener("click", e => {
    e.stopPropagation();
    document.querySelectorAll(".dd.open").forEach(x => x.id !== w && x.classList.remove("open"));
    $(b).setAttribute("aria-expanded", $(w).classList.toggle("open"));
  });
});
document.addEventListener("click", e => document.querySelectorAll(".dd.open").forEach(x => !x.contains(e.target) && x.classList.remove("open")));

function openItem(id) {
  const it = items.find(i => i.id === id); if (!it) return;
  $("mImg").src = it.photos[0]; $("mImg").alt = it.name;
  // tap-through thumbnails when there's more than one photo
  $("mThumbs").innerHTML = it.photos.length > 1 ? it.photos.map((p, i) =>
    `<button class="${i ? "" : "on"}" data-src="${p}" aria-label="Photo ${i + 1}"><img src="${p}" alt="" /></button>`).join("") : "";
  $("mCat").textContent = it.category;
  $("mName").textContent = it.name;
  const off = hasPrice(it) && it.retail > it.price;
  $("mPrice").textContent = hasPrice(it) ? money(it.price) : "";
  $("mRetail").textContent = off ? "Retail " + money(it.retail) : "";
  $("mPrice").parentElement.hidden = !hasPrice(it);
  $("mDesc").textContent = it.description;
  $("mSpecs").innerHTML = [["Condition", it.condition], ["Size", it.dims], ["Status", it.status === "Pending" ? "On hold" : it.status]]
    .filter(([, v]) => known(v))
    .map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
  const sold = it.status === "Sold";
  $("mText").textContent = sold ? "Text Us For Something Similar" : "Text Us About This";
  $("mText").href = smsLink(sold
    ? `Hi! I saw the ${it.name} sold — do you have anything similar?`
    : `Hi! I'm interested in the ${it.name}${hasPrice(it) ? ` (${money(it.price)})` : ""} I saw on your website. Is it still available?`);
  $("modal").classList.add("open");
  $("modal").setAttribute("aria-hidden", "false");
}
function closeModal() { $("modal").classList.remove("open"); $("modal").setAttribute("aria-hidden", "true"); }

$("mThumbs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  $("mImg").src = b.dataset.src;
  $("mThumbs").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
});
$("grid").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) openItem(b.dataset.id); });
$("cats").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cat = b.dataset.v; $("dd").classList.remove("open"); renderMenus(); render(); });
$("conds").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cond = b.dataset.v; $("dd2").classList.remove("open"); renderMenus(); render(); });
$("q").addEventListener("input", render);
$("sort").addEventListener("change", render);
$("modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.classList.contains("modal-close")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

fetch(INVENTORY_URL, { cache: "no-store" }).then(r => r.json()).then(d => {
  items = d.items || [];
  catOrder = d.categories || []; condOrder = d.conditions || [];
  const avail = items.filter(i => i.status !== "Sold").length;
  $("liveNote").textContent = avail
    ? `${avail} ${avail === 1 ? "piece" : "pieces"} available · updated as stuff comes in and sells`
    : "New pieces are being posted — text or call us to see what's on the floor today";
  if (!items.length) $("empty").innerHTML = `Our online inventory is being added now. <a href="${smsLink("Hi! What furniture do you have in stock right now?")}">Text us</a> or <a href="${telLink()}">call ${SITE.phoneDisplay}</a> and we'll send you pictures of what's in the store.`;
  renderMenus(); render();
}).catch(() => { $("liveNote").textContent = "Couldn't load inventory — text us and we'll send you what's in stock."; });
