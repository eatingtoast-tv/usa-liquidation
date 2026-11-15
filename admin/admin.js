// USA Liquidation admin — built for a phone, as simple as possible. Talks only to /api/* (secrets stay on the server).
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => (n === null || n === undefined || n === "" ? "No price" : "$" + Number(n).toLocaleString());
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TODAY = new Date().toLocaleDateString("en-US", { weekday: "long" });

function toast(msg, ms = 2800) {
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
  if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
function busy(btn, on, label = "Saving…") {
  if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> ${label}`; btn.disabled = true; }
  else if (btn.dataset.label) { btn.innerHTML = btn.dataset.label; btn.disabled = false; }
}
const DONE = "✅ Saved! It'll be on the website in a minute or two.";

// ---------- screens ----------
function go(name) {
  $$("#appView > section").forEach(s => s.classList.toggle("hide", s.id !== "s-" + name));
  if (name === "items") loadItems();
  if (name === "bins") loadBins();
  if (name === "trailers") loadTrailers();
  if (name === "add" && !photos.add.length) resetAdd();
  if (location.hash !== "#" + name) history.pushState(null, "", name === "home" ? location.pathname : "#" + name);
  window.scrollTo(0, 0);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
window.addEventListener("popstate", () => { closeSheet(); go(location.hash.slice(1) || "home"); }); // phone back button/swipe

// ---------- photos: shrink on the phone before upload ----------
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Couldn't open that picture. Try another."));
    img.src = url;
  });
}
const photos = { add: [], bins: [], trailer: [], gallery: [] };
function drawThumbs(kind) {
  const extra = kind === "add" ? `<button class="addmore" data-pick="add">＋ Add<br>another</button>` : "";
  $("#" + kind + "Thumbs").innerHTML = photos[kind].map((p, i) => `<div><img src="${p}" alt=""><button data-del="${kind}:${i}" aria-label="Remove">✕</button></div>`).join("") + (photos[kind].length ? extra : "");
  if (kind === "bins") $("#binsPhotoSave").classList.toggle("hide", !photos.bins.length);
  if (kind === "gallery") $("#galleryMore").classList.toggle("hide", !photos.gallery.length);
}
let pickKind = null;
document.addEventListener("click", e => {
  const d = e.target.closest("[data-del]");
  if (d) { const [k, i] = d.dataset.del.split(":"); photos[k].splice(+i, 1); drawThumbs(k); if (k === "add" && !photos.add.length) resetAdd(); return; }
  const b = e.target.closest("[data-pick]"); if (!b) return;
  pickKind = b.dataset.pick;
  const f = $("#filePick");
  if (b.dataset.capture) f.setAttribute("capture", "environment"); else f.removeAttribute("capture");
  f.multiple = pickKind !== "bins";
  f.value = ""; f.click();
});
$("#filePick").addEventListener("change", async e => {
  const files = [...e.target.files]; if (!files.length) return;
  const kind = pickKind, first = !photos[kind].length;
  for (const f of files) { try { photos[kind].push(await shrink(f, 1600)); } catch (err) { toast(err.message); } }
  if (kind === "bins") photos.bins = photos.bins.slice(-1);
  drawThumbs(kind);
  if (kind === "add" && photos.add.length) {
    $("#addStep1").classList.add("hide"); $("#addStep2").classList.remove("hide");
    if (first) autoFill(files[0]);
  }
});
async function uploadAll(list, btn) {
  const ids = [];
  for (let i = 0; i < list.length; i++) {
    btn.innerHTML = `<span class="spin"></span> Uploading picture ${i + 1} of ${list.length}…`;
    ids.push((await api("photo", "POST", { image: list[i] })).id);
  }
  return ids;
}

// ---------- Add something new ----------
function resetAdd() {
  $("#addForm").reset(); photos.add = []; drawThumbs("add");
  $("#aiNote").classList.add("hide");
  $("#addStep1").classList.remove("hide"); $("#addStep2").classList.add("hide");
}
$("#addCancel").addEventListener("click", resetAdd);
async function autoFill(file) {
  const note = $("#aiNote"), f = $("#addForm");
  note.classList.remove("hide"); note.innerHTML = `<span class="spin"></span> Looking at the picture and filling it in…`;
  try {
    const out = await api("ai", "POST", { image: await shrink(file, 900) });
    if (!f.name.value) f.name.value = out.name;
    f.category.value = out.category; f.condition.value = out.condition;
    if (!f.description.value) f.description.value = out.description;
    if (!f.size.value && out.size) f.size.value = out.size;
    note.innerHTML = "✨ Filled in for you. Fix anything that's wrong, add the price, and save.";
  } catch (e) { note.textContent = "Couldn't fill it in automatically. Just type what it is."; }
}
$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = $("#addSave");
  if (!f.price.value && !confirm("You didn't add a price. Save anyway?")) return f.price.focus();
  busy(btn, true);
  try {
    const ids = await uploadAll(photos.add, btn);
    btn.innerHTML = `<span class="spin"></span> Saving…`;
    await api("furniture", "POST", {
      name: f.name.value.trim(), price: f.price.value, retail: f.retail.value, category: f.category.value,
      condition: f.condition.value, size: f.size.value, description: f.description.value, photos: ids,
    });
    busy(btn, false); resetAdd(); items = null; toast(DONE, 3500);
  } catch (err) { busy(btn, false); toast(err.message, 4000); }
});

// ---------- Mark sold / change price ----------
let items = null, filter = "Available";
async function loadItems() {
  if (items) return drawItems();
  $("#itemList").innerHTML = `<p class="muted">Loading…</p>`;
  try { items = (await api("furniture")).items.filter(i => i.name); drawItems(); }
  catch (e) { $("#itemList").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
function drawItems() {
  const q = $("#q").value.toLowerCase().trim();
  const list = items.filter(i => i.status === filter && (!q || i.name.toLowerCase().includes(q)));
  $("#itemList").innerHTML = list.length ? list.map(i => `
    <div class="item is-${esc(i.status).replace(" ", "")}" data-edit="${i.id}">
      <img src="${esc(i.photo) || "/images/logo-color.png"}" loading="lazy" alt="">
      <div class="info"><b>${esc(i.name)}</b><span>${money(i.price)}</span>${i.status === "On Hold" ? "<em>ON HOLD</em>" : ""}</div>
      ${i.status === "Sold" ? `<button class="sold" data-quick="Available">Undo</button>` : `<button class="sold" data-quick="Sold">Sold ✓</button>`}
    </div>`).join("") : `<p class="muted" style="text-align:center;padding:30px 0">${q ? "Nothing matches that." : "Nothing here."}</p>`;
}
$("#q").addEventListener("input", () => items && drawItems());
$$("#statusFilter button").forEach(b => b.addEventListener("click", () => {
  $$("#statusFilter button").forEach(x => x.classList.toggle("on", x === b)); filter = b.dataset.f; drawItems();
}));
$("#itemList").addEventListener("click", async e => {
  const row = e.target.closest("[data-edit]"); if (!row) return;
  const it = items.find(i => i.id === row.dataset.edit);
  const quick = e.target.closest("[data-quick]");
  if (!quick) return openEdit(it);
  const to = quick.dataset.quick;
  if (to === "Sold" && !confirm(`Mark "${it.name}" as SOLD?`)) return;
  quick.disabled = true; quick.innerHTML = `<span class="spin" style="border-color:#2F7D4F44;border-top-color:#2F7D4F"></span>`;
  try { await api("furniture", "PATCH", { id: it.id, status: to }); it.status = to; drawItems(); toast(to === "Sold" ? "✅ Marked sold." : "Back on the website."); }
  catch (err) { toast(err.message, 4000); drawItems(); }
});
function openEdit(it) {
  $("#sheetBody").innerHTML = `
    ${it.photo ? `<img src="${esc(it.photo)}" style="width:100%;height:200px;object-fit:cover;border-radius:16px;margin-bottom:6px" alt="">` : ""}
    <label>Name</label><input id="eName" value="${esc(it.name)}">
    <label>Price</label><div class="price"><span>$</span><input id="ePrice" type="number" inputmode="decimal" value="${it.price ?? ""}"></div>
    <label>Status</label>
    <div class="seg" id="segStatus">${[["Available", "For sale"], ["On Hold", "On hold"], ["Sold", "Sold"]].map(([s, l]) => `<button data-s="${s}" class="${it.status === s ? "on" : ""}">${l}</button>`).join("")}</div>
    <details><summary>More details</summary>
      <label>Store price</label><div class="price"><span>$</span><input id="eRetail" type="number" inputmode="decimal" value="${it.retail ?? ""}"></div>
      <label>Description</label><textarea id="eDesc">${esc(it.description)}</textarea>
      <button class="btn ghost" id="eDelete" style="color:var(--red)">Delete from website</button>
    </details>
    <button class="btn green" id="eSave">Save</button>
    <button class="textlink" id="eClose" style="color:var(--muted)">Cancel</button>`;
  openSheet();
  let status = it.status;
  $$("#segStatus button").forEach(b => b.onclick = () => { status = b.dataset.s; $$("#segStatus button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#eClose").onclick = closeSheet;
  $("#eSave").onclick = async () => {
    const btn = $("#eSave"); busy(btn, true);
    const upd = { status, name: $("#eName").value.trim() || it.name, price: $("#ePrice").value, retail: $("#eRetail").value, description: $("#eDesc").value };
    try {
      await api("furniture", "PATCH", { id: it.id, ...upd });
      Object.assign(it, upd, { price: upd.price === "" ? null : +upd.price, retail: upd.retail === "" ? null : +upd.retail });
      closeSheet(); drawItems(); toast(DONE);
    } catch (e) { busy(btn, false); toast(e.message, 4000); }
  };
  $("#eDelete").onclick = async () => {
    if (!confirm(`Delete "${it.name}" from the website?\n\n(Use "Sold" instead if you sold it.)`)) return;
    try { await api("furniture", "DELETE", { id: it.id }); items = items.filter(x => x !== it); closeSheet(); drawItems(); toast("Deleted."); }
    catch (e) { toast(e.message, 4000); }
  };
}
function openSheet() { $("#sheet").style.display = "flex"; }
function closeSheet() { $("#sheet").style.display = "none"; }
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") closeSheet(); });

// ---------- Bins ----------
let bins = null;
async function loadBins() {
  if (bins) return;
  try {
    bins = (await api("bins")).days;
    $("#binsTitle").textContent = `Today's bins picture (${TODAY})`;
    $("#binDay").innerHTML = bins.map(d => `<option ${d.day === TODAY ? "selected" : ""}>${esc(d.day)}</option>`).join("");
    $("#binDays").innerHTML = bins.map(d => `
      <div class="day ${d.open ? "" : "closed"}" data-id="${d.id}">
        <label class="switch" style="margin:0"><input type="checkbox" ${d.open ? "checked" : ""} aria-label="Open ${esc(d.day)}"><i></i></label>
        <b>${esc(d.day)}</b>
        <div class="price"><span>$</span><input type="number" inputmode="decimal" value="${d.price ?? ""}"></div>
      </div>`).join("");
    $$("#binDays .switch input").forEach(c => c.onchange = () => c.closest(".day").classList.toggle("closed", !c.checked));
  } catch (e) { bins = null; $("#binDays").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
$("#binsSave").addEventListener("click", async () => {
  const btn = $("#binsSave"); busy(btn, true);
  try {
    let n = 0;
    for (const row of $$("#binDays .day")) {
      const chk = row.querySelector("input[type=checkbox]"), price = row.querySelector("input[type=number]");
      const old = bins.find(d => d.id === row.dataset.id);
      if (old.open !== chk.checked || String(old.price ?? "") !== price.value) {
        await api("bins", "PATCH", { id: old.id, open: chk.checked, price: price.value });
        Object.assign(old, { open: chk.checked, price: price.value === "" ? null : +price.value }); n++;
      }
    }
    toast(n ? DONE : "Nothing changed.");
  } catch (e) { toast(e.message, 4000); }
  busy(btn, false);
});
$("#binsPhotoSave").addEventListener("click", async () => {
  const btn = $("#binsPhotoSave"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.bins, btn);
    await api("bins", "POST", { day: $("#binDay").value || TODAY, photos: ids });
    photos.bins = []; drawThumbs("bins"); toast(DONE);
  } catch (e) { toast(e.message, 4000); }
  busy(btn, false);
});

// ---------- Food trailers ----------
let trailers = null;
async function loadTrailers() {
  try {
    trailers = (await api("trailers")).items;
    $("#trailerList").innerHTML = trailers.length ? trailers.map(t => `
      <div class="item is-${esc(t.status).replace(" ", "")}" data-tedit="${t.id}">
        <img src="${esc(t.photo) || "/images/logo-color.png"}" alt="">
        <div class="info"><b>${esc(t.name)}</b><span>${money(t.price)}</span><em>${esc(t.status).toUpperCase()}</em></div>
      </div>`).join("") : `<div class="card"><p class="muted">No trailers on the website yet.</p></div>`;
  } catch (e) { $("#trailerList").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
$("#trailerList").addEventListener("click", e => {
  const row = e.target.closest("[data-tedit]"); if (!row) return;
  const t = trailers.find(x => x.id === row.dataset.tedit);
  $("#sheetBody").innerHTML = `
    <h2>${esc(t.name)}</h2>
    <label>Price</label><div class="price"><span>$</span><input id="tPrice" type="number" inputmode="decimal" value="${t.price ?? ""}"></div>
    <label>Status</label>
    <div class="seg" id="segT">${["In Stock", "Coming Soon", "Sold"].map(s => `<button data-s="${s}" class="${t.status === s ? "on" : ""}">${s}</button>`).join("")}</div>
    <button class="btn green" id="tSave">Save</button>
    <button class="textlink" id="tClose" style="color:var(--muted)">Cancel</button>`;
  openSheet();
  let status = t.status;
  $$("#segT button").forEach(x => x.onclick = () => { status = x.dataset.s; $$("#segT button").forEach(y => y.classList.toggle("on", y === x)); });
  $("#tClose").onclick = closeSheet;
  $("#tSave").onclick = async () => {
    const btn = $("#tSave"); busy(btn, true);
    try { await api("trailers", "PATCH", { id: t.id, status, price: $("#tPrice").value }); closeSheet(); toast(DONE); loadTrailers(); }
    catch (err) { busy(btn, false); toast(err.message, 4000); }
  };
});
$("#showTrailerForm").addEventListener("click", () => { $("#trailerForm").classList.remove("hide"); $("#showTrailerForm").classList.add("hide"); });
$("#trailerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("[type=submit]"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.trailer, btn);
    await api("trailers", "POST", { name: f.name.value.trim(), price: f.price.value, size: f.size.value, status: f.status.value, features: f.features.value, description: f.description.value, photos: ids });
    f.reset(); photos.trailer = []; drawThumbs("trailer");
    f.classList.add("hide"); $("#showTrailerForm").classList.remove("hide");
    toast(DONE); loadTrailers();
  } catch (err) { toast(err.message, 4000); }
  busy(btn, false);
});
$("#gallerySave").addEventListener("click", async () => {
  const btn = $("#gallerySave"); busy(btn, true);
  try {
    const ids = await uploadAll(photos.gallery, btn);
    await api("trailers", "POST", { gallery: true, caption: $("#galleryCaption").value, photos: ids });
    photos.gallery = []; drawThumbs("gallery"); $("#galleryCaption").value = ""; toast(DONE);
  } catch (err) { toast(err.message, 4000); }
  busy(btn, false);
});

// ---------- login ----------
function showLogin() { $("#appView").classList.add("hide"); $("#loginView").classList.remove("hide"); }
function showApp() {
  $("#loginView").classList.add("hide"); $("#appView").classList.remove("hide");
  const h = new Date().getHours();
  $("#hello").textContent = (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening") + "! What do you want to do?";
  go(location.hash.slice(1) || "home");
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button"); busy(btn, true, "Checking…"); $("#loginErr").textContent = "";
  try { await api("login", "POST", { password: $("#pw").value }); $("#pw").value = ""; showApp(); }
  catch (err) { $("#loginErr").textContent = err.message; }
  busy(btn, false);
});
$("#logout").addEventListener("click", async () => { if (!confirm("Log out?")) return; await api("login", "DELETE").catch(() => {}); showLogin(); });

api("login").then(r => (r.loggedIn ? showApp() : showLogin())).catch(showLogin);
