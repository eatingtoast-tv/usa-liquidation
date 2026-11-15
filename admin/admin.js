// USA Liquidation admin — phone-first. Talks only to /api/* (secrets stay on the server).
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => (n === null || n === undefined || n === "" ? "—" : "$" + Number(n).toLocaleString());
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.style.display = "block";
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = "none"), ms);
}
async function api(path, method = "GET", body) {
  const r = await fetch("/api/" + path, {
    method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "login") { showLogin(); throw new Error("Please log in again."); }
  if (!r.ok) throw new Error(data.error || "Something went wrong (" + r.status + ")");
  return data;
}
function busy(btn, on, label) {
  if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> ${label || "Saving…"}`; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.label; btn.disabled = false; }
}
const savedMsg = r => (r && r.refreshed ? "Saved ✓ Website updates in about a minute." : "Saved ✓ Website updates within 5 minutes.");

// ---------- photos: shrink on the phone before upload ----------
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Couldn't read that photo."));
    img.src = url;
  });
}
const photos = { add: [], bins: [], trailer: [], gallery: [] }; // dataURLs per form
function drawThumbs(kind) {
  const box = $("#" + kind + "Thumbs");
  box.innerHTML = photos[kind].map((p, i) => `<div><img src="${p}"><button data-del="${kind}:${i}">×</button></div>`).join("");
}
document.addEventListener("click", e => {
  const d = e.target.closest("[data-del]"); if (!d) return;
  const [kind, i] = d.dataset.del.split(":"); photos[kind].splice(+i, 1); drawThumbs(kind);
});
let pickKind = null;
$$("[data-pick]").forEach(b => b.addEventListener("click", () => {
  pickKind = b.dataset.pick;
  const f = $("#filePick");
  if (b.dataset.capture) f.setAttribute("capture", "environment"); else f.removeAttribute("capture");
  f.multiple = pickKind !== "bins";
  f.value = ""; f.click();
}));
$("#filePick").addEventListener("change", async e => {
  const files = [...e.target.files]; if (!files.length) return;
  const kind = pickKind;
  for (const f of files) { try { photos[kind].push(await shrink(f, 1600)); } catch (err) { toast(err.message); } }
  if (kind === "bins") photos.bins = photos.bins.slice(-1);
  drawThumbs(kind);
  if (kind === "add" && photos.add.length && !$("#addForm").name.value) autoFill(files[0]);
});
async function uploadAll(list, btn) {
  const ids = [];
  for (let i = 0; i < list.length; i++) {
    btn.innerHTML = `<span class="spin"></span> Uploading photo ${i + 1} of ${list.length}…`;
    ids.push((await api("photo", "POST", { image: list[i] })).id);
  }
  return ids;
}

// ---------- AI auto-fill ----------
async function autoFill(file) {
  const note = $("#aiNote"), f = $("#addForm");
  note.style.display = "block"; note.textContent = "✨ Looking at the photo and filling it in…";
  try {
    const out = await api("ai", "POST", { image: await shrink(file, 900) });
    if (!f.name.value) f.name.value = out.name;
    f.category.value = out.category; f.condition.value = out.condition;
    if (!f.description.value) f.description.value = out.description;
    if (!f.size.value && out.size) f.size.value = out.size;
    note.textContent = "✨ Filled in for you — check it, add the price, then save.";
    f.price.focus();
  } catch (e) { note.textContent = e.message; }
}

// ---------- Add furniture ----------
$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = $("#addSave");
  if (!photos.add.length && !confirm("No photo yet. Save without a photo?")) return;
  if (!f.price.value && !confirm("No price yet. Save anyway?")) return;
  busy(btn, true);
  try {
    const ids = await uploadAll(photos.add, btn);
    btn.innerHTML = `<span class="spin"></span> Saving…`;
    const r = await api("furniture", "POST", {
      name: f.name.value.trim(), price: f.price.value, retail: f.retail.value, category: f.category.value,
      condition: f.condition.value, size: f.size.value, description: f.description.value, photos: ids,
    });
    f.reset(); photos.add = []; drawThumbs("add"); $("#aiNote").style.display = "none";
    toast(savedMsg(r), 3500); window.scrollTo(0, 0);
    items = null;
  } catch (err) { toast(err.message, 4000); }
  busy(btn, false);
});

// ---------- Items list ----------
let items = null, filter = "Available";
async function loadItems(force) {
  if (items && !force) return drawItems();
  $("#itemList").innerHTML = `<p class="muted">Loading…</p>`;
  try { items = (await api("furniture")).items; drawItems(); }
  catch (e) { $("#itemList").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
function drawItems() {
  const q = $("#q").value.toLowerCase();
  const list = items.filter(i => (!filter || i.status === filter) && (!q || i.name.toLowerCase().includes(q)));
  $("#itemList").innerHTML = list.length ? list.map(i => `
    <div class="item">
      <img src="${esc(i.photo) || "/images/logo-color.png"}" loading="lazy" alt="">
      <div class="info"><b>${esc(i.name) || "(no name — tap Edit)"}</b><span class="pill ${esc(i.status)}">${esc(i.status)}</span> <span class="muted">${money(i.price)}</span></div>
      <button class="edit" data-edit="${i.id}">Edit</button>
    </div>`).join("") : `<p class="muted">Nothing here.</p>`;
}
$("#q").addEventListener("input", () => items && drawItems());
$$("#statusFilter button").forEach(b => b.addEventListener("click", () => {
  $$("#statusFilter button").forEach(x => x.classList.toggle("on", x === b));
  filter = b.dataset.f; drawItems();
}));
document.addEventListener("click", e => {
  const b = e.target.closest("[data-edit]"); if (!b) return;
  openEdit(items.find(i => i.id === b.dataset.edit));
});
function openEdit(it) {
  $("#sheetBody").innerHTML = `
    <h2>${esc(it.name)}</h2>
    ${it.photo ? `<img src="${esc(it.photo)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px">` : ""}
    <label>Status</label>
    <div class="seg" id="segStatus">${["Available", "On Hold", "Sold"].map(s => `<button data-s="${s}" class="${it.status === s ? "on" : ""}">${s === "Sold" ? "✅ Sold" : s}</button>`).join("")}</div>
    <label>Name</label><input id="eName" value="${esc(it.name)}">
    <div class="row">
      <div><label>Our Price $</label><input id="ePrice" type="number" inputmode="decimal" value="${it.price ?? ""}"></div>
      <div><label>Retail $</label><input id="eRetail" type="number" inputmode="decimal" value="${it.retail ?? ""}"></div>
    </div>
    <label>Description</label><textarea id="eDesc">${esc(it.description)}</textarea>
    <button class="btn" id="eSave">Save changes</button>
    <button class="btn light" id="eClose">Cancel</button>
    <button class="btn light" id="eDelete" style="color:var(--red);border-color:var(--red)">🗑 Remove from website</button>`;
  $("#sheet").style.display = "flex";
  let status = it.status;
  $$("#segStatus button").forEach(b => b.onclick = () => { status = b.dataset.s; $$("#segStatus button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#eClose").onclick = closeSheet;
  $("#eSave").onclick = async () => {
    const btn = $("#eSave"); busy(btn, true);
    try {
      const r = await api("furniture", "PATCH", { id: it.id, status, name: $("#eName").value.trim(), price: $("#ePrice").value, retail: $("#eRetail").value, description: $("#eDesc").value });
      Object.assign(it, { status, name: $("#eName").value.trim(), price: $("#ePrice").value === "" ? null : +$("#ePrice").value, retail: $("#eRetail").value === "" ? null : +$("#eRetail").value, description: $("#eDesc").value });
      closeSheet(); drawItems(); toast(savedMsg(r));
    } catch (e) { toast(e.message, 4000); busy(btn, false); }
  };
  $("#eDelete").onclick = async () => {
    if (!confirm(`Remove "${it.name}" from the website? (You can still find it in Notion's trash.)`)) return;
    try { const r = await api("furniture", "DELETE", { id: it.id }); items = items.filter(x => x !== it); closeSheet(); drawItems(); toast(savedMsg(r)); }
    catch (e) { toast(e.message, 4000); }
  };
}
function closeSheet() { $("#sheet").style.display = "none"; }
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") closeSheet(); });

// ---------- Bins ----------
let bins = null;
async function loadBins() {
  try {
    bins = (await api("bins")).days;
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    $("#binDay").innerHTML = bins.map(d => `<option ${d.day === today ? "selected" : ""}>${esc(d.day)}</option>`).join("");
    $("#binDays").innerHTML = bins.map(d => `
      <div class="day" data-id="${d.id}">
        <input type="checkbox" ${d.open ? "checked" : ""} aria-label="Open ${esc(d.day)}">
        <b>${esc(d.day)}</b>
        <input type="number" inputmode="decimal" value="${d.price ?? ""}" placeholder="$">
        <input type="text" value="${esc(d.note)}" placeholder="label (e.g. Dollar Day)">
      </div>`).join("");
  } catch (e) { $("#binDays").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
$("#binsSave").addEventListener("click", async () => {
  const btn = $("#binsSave"); busy(btn, true);
  try {
    let r;
    for (const row of $$("#binDays .day")) {
      const [chk, price, note] = row.querySelectorAll("input");
      const old = bins.find(d => d.id === row.dataset.id);
      const changed = old.open !== chk.checked || String(old.price ?? "") !== price.value || old.note !== note.value;
      if (changed) {
        r = await api("bins", "PATCH", { id: old.id, open: chk.checked, price: price.value, note: note.value });
        Object.assign(old, { open: chk.checked, price: price.value === "" ? null : +price.value, note: note.value });
      }
    }
    toast(r ? savedMsg(r) : "Nothing changed.");
  } catch (e) { toast(e.message, 4000); }
  busy(btn, false);
});
$("#binsPhotoSave").addEventListener("click", async () => {
  if (!photos.bins.length) return toast("Take a bins photo first.");
  const btn = $("#binsPhotoSave"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.bins, btn);
    const r = await api("bins", "POST", { day: $("#binDay").value, photos: ids });
    photos.bins = []; drawThumbs("bins"); toast(savedMsg(r));
  } catch (e) { toast(e.message, 4000); }
  busy(btn, false);
});

// ---------- Trailers ----------
let trailers = null;
async function loadTrailers() {
  try {
    trailers = (await api("trailers")).items;
    $("#trailerList").innerHTML = `<h2>Trailers</h2>` + (trailers.length ? trailers.map(t => `
      <div class="item">
        <img src="${esc(t.photo) || "/images/logo-color.png"}" alt="">
        <div class="info"><b>${esc(t.name)}</b><span class="pill ${esc(t.status)}">${esc(t.status)}</span> <span class="muted">${money(t.price)}</span></div>
        <button class="edit" data-tedit="${t.id}">Edit</button>
      </div>`).join("") : `<p class="muted">No trailers listed yet.</p>`);
  } catch (e) { $("#trailerList").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tedit]"); if (!b) return;
  const t = trailers.find(x => x.id === b.dataset.tedit);
  $("#sheetBody").innerHTML = `
    <h2>${esc(t.name)}</h2>
    <label>Status</label>
    <div class="seg" id="segT">${["In Stock", "Coming Soon", "Sold"].map(s => `<button data-s="${s}" class="${t.status === s ? "on" : ""}">${s}</button>`).join("")}</div>
    <label>Price $</label><input id="tPrice" type="number" inputmode="decimal" value="${t.price ?? ""}">
    <button class="btn" id="tSave">Save changes</button>
    <button class="btn light" id="tClose">Cancel</button>`;
  $("#sheet").style.display = "flex";
  let status = t.status;
  $$("#segT button").forEach(x => x.onclick = () => { status = x.dataset.s; $$("#segT button").forEach(y => y.classList.toggle("on", y === x)); });
  $("#tClose").onclick = closeSheet;
  $("#tSave").onclick = async () => {
    const btn = $("#tSave"); busy(btn, true);
    try { const r = await api("trailers", "PATCH", { id: t.id, status, price: $("#tPrice").value }); closeSheet(); toast(savedMsg(r)); loadTrailers(); }
    catch (err) { toast(err.message, 4000); busy(btn, false); }
  };
});
$("#trailerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("[type=submit]"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.trailer, btn);
    const r = await api("trailers", "POST", { name: f.name.value.trim(), price: f.price.value, size: f.size.value, status: f.status.value, features: f.features.value, description: f.description.value, photos: ids });
    f.reset(); photos.trailer = []; drawThumbs("trailer"); toast(savedMsg(r)); loadTrailers();
  } catch (err) { toast(err.message, 4000); }
  busy(btn, false);
});
$("#gallerySave").addEventListener("click", async () => {
  if (!photos.gallery.length) return toast("Choose a photo first.");
  const btn = $("#gallerySave"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.gallery, btn);
    const r = await api("trailers", "POST", { gallery: true, caption: $("#galleryCaption").value, photos: ids });
    photos.gallery = []; drawThumbs("gallery"); $("#galleryCaption").value = ""; toast(savedMsg(r));
  } catch (err) { toast(err.message, 4000); }
  busy(btn, false);
});

// ---------- tabs + login ----------
const TITLES = { add: "Add Item", items: "Items", bins: "Bins", trailers: "Food Trailers" };
function showTab(name) {
  $$("nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  $$("main > section").forEach(s => s.classList.toggle("hide", s.id !== "tab-" + name));
  $("#title").textContent = TITLES[name];
  if (name === "items") loadItems();
  if (name === "bins" && !bins) loadBins();
  if (name === "trailers" && !trailers) loadTrailers();
  window.scrollTo(0, 0);
}
$$("nav button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

function showLogin() { $("#appView").classList.add("hide"); $("#loginView").classList.remove("hide"); $("#pw").focus(); }
function showApp() { $("#loginView").classList.add("hide"); $("#appView").classList.remove("hide"); }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button"); busy(btn, true, "Checking…"); $("#loginErr").textContent = "";
  try { await api("login", "POST", { password: $("#pw").value }); $("#pw").value = ""; showApp(); }
  catch (err) { $("#loginErr").textContent = err.message; }
  busy(btn, false);
});
$("#logout").addEventListener("click", async () => { await api("login", "DELETE").catch(() => {}); showLogin(); });

api("login").then(r => (r.loggedIn ? showApp() : showLogin())).catch(showLogin);
