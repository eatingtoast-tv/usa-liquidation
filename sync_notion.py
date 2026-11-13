#!/usr/bin/env python3
"""
Pull the USA Liquidation "Website" databases from Notion into the site's data files.

  python3 sync_notion.py

- Runs automatically in GitHub Actions (.github/workflows/notion-sync.yml) using the NOTION_TOKEN secret.
- Locally: reads .notion_token in this folder (or NOTION_TOKEN env var, or ~/toaster-dashboard/.notion_token).
- Notion photo links expire after ~1 hour, so photos are downloaded into images/notion/
  and shrunk for the web (sips). Already-downloaded photos are skipped.
- A data file is only rewritten when its Notion query succeeds, so a failed run
  never blanks the site.
"""
import hashlib, json, os, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "images" / "notion"
DATA = ROOT / "data"

DBS = {
    "furniture": "cd5a3943001d49b380ca228776a8c316",  # Website Inventory
    "bins":      "205bc40c9f7c4c3895c27c1df7c521d9",  # Bins
    "trailers":  "61d44df71efe425abcedda49655f490d",  # Food Trailers
    "gallery":   "61b716733d8e4602b7ae3cbf0167f972",  # Trailer Gallery
}

# Website-only, read-only integration ("USA Liquidation Website") — falls back to the dashboard's token.
_own = ROOT / ".notion_token"
TOKEN = (os.environ.get("NOTION_TOKEN") or (_own if _own.exists() else
         Path.home() / "toaster-dashboard" / ".notion_token").read_text().strip())
UA = "usa-liquidation-site-sync/1.0"


def options(db, prop):
    """The choices of a select property, in the order they're arranged in Notion."""
    p = api(f"databases/{db}", method="GET")["properties"].get(prop) or {}
    return [o["name"] for o in (p.get(p.get("type", ""), {}) or {}).get("options", [])]


def api(path, body=None, method="POST"):
    req = urllib.request.Request(
        "https://api.notion.com/v1/" + path,
        data=json.dumps(body or {}).encode() if method == "POST" else None, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Notion-Version": "2022-06-28",
                 "Content-Type": "application/json", "User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=30))


def query(db):
    rows, cursor = [], None
    while True:
        r = api(f"databases/{db}/query", {"start_cursor": cursor} if cursor else {})
        rows += [p for p in r["results"] if not p.get("archived") and not p.get("in_trash")]
        if not r.get("has_more"): return rows
        cursor = r["next_cursor"]


# ---------- property readers ----------
def text(p):
    if not p: return ""
    arr = p.get(p["type"]) or []
    return "".join(x.get("plain_text", "") for x in arr).strip()

def num(p): return p.get("number") if p else None
def sel(p): return (p.get("select") or {}).get("name", "") if p else ""
def chk(p): return bool(p.get("checkbox")) if p else False
def created(page): return page["created_time"][:10]


def shrink(src, dest):
    """Resize to max 1400px JPEG, upright, handles iPhone HEIC. Pillow (cloud) or sips (Mac)."""
    try:
        from PIL import Image, ImageOps
        try:
            import pillow_heif; pillow_heif.register_heif_opener()
        except ImportError:
            pass
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((1400, 1400))
        im.save(dest, "JPEG", quality=78, optimize=True, progressive=True)
    except Exception:
        subprocess.run(["sips", "-Z", "1400", "-s", "format", "jpeg", "-s", "formatOptions", "75",
                        str(src), "--out", str(dest)], capture_output=True)


def photos(p, page_id):
    """Download every photo in a Files property; return local web paths."""
    out = []
    for i, f in enumerate((p or {}).get("files", [])):
        url = (f.get("file") or f.get("external") or {}).get("url")
        if not url: continue
        # stable name per file (Notion file URLs change every fetch, the path part doesn't)
        key = hashlib.md5(url.split("?")[0].encode()).hexdigest()[:10]
        # page ids share a time-based prefix, so use the unique tail of the id
        dest = IMG / f"{page_id.replace('-', '')[-12:]}-{i}-{key}.jpg"
        if not dest.exists():
            IMG.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_suffix(".download")
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            tmp.write_bytes(urllib.request.urlopen(req, timeout=60).read())
            shrink(tmp, dest)
            tmp.unlink(missing_ok=True)
            if not dest.exists(): continue
        out.append(f"images/notion/{dest.name}")
    return out


def write(name, obj):
    (DATA / f"{name}.json").write_text(json.dumps(obj, indent=2, ensure_ascii=False))
    print(f"  wrote data/{name}.json")


# ---------- each database ----------
def sync_furniture():
    items = []
    for pg in query(DBS["furniture"]):
        pr = pg["properties"]
        name = text(pr.get("Item"))
        if not name: continue
        status = sel(pr.get("Status")) or "Available"
        items.append({
            "id": pg["id"], "name": name,
            "category": sel(pr.get("Category")) or "Other",
            "price": num(pr.get("Price")) or 0,
            "retail": num(pr.get("Retail Price")),
            "condition": sel(pr.get("Condition")),
            "status": "Pending" if status == "On Hold" else status,
            "added": created(pg),
            "dims": text(pr.get("Size / Dimensions")) or "—",
            "description": text(pr.get("Description")),
            "photos": photos(pr.get("Photos"), pg["id"]) or ["images/logo-color.png"],
        })
    write("furniture", {"_note": "Synced from Notion > USA Liquidation > Website > Website Inventory",
                        # Notion's own option lists → new categories/conditions show up on the site automatically
                        "categories": options(DBS["furniture"], "Category"),
                        "conditions": options(DBS["furniture"], "Condition"),
                        "items": items})
    print(f"  furniture: {len(items)} items")


def sync_bins():
    rows = query(DBS["bins"])
    prices, photo_rows = {}, []
    old = json.loads((DATA / "bins.json").read_text()) if (DATA / "bins.json").exists() else {}
    old_notes = {d: (v or {}).get("note", "") for d, v in old.get("prices", {}).items()}
    default_notes = {"Friday": "Everything $1", "Saturday": "Brand-new bins — best selection"}
    for pg in rows:
        pr = pg["properties"]
        day = text(pr.get("Day")).strip().title()
        if not day: continue
        if chk(pr.get("Open")) and num(pr.get("Price")) is not None:
            note = text(pr.get("Note"))
            # Notion "Note" = the short label (e.g. "Dollar Day"); keep the longer sub-line the site already had
            prices[day] = {"price": num(pr.get("Price")), "label": note,
                           "note": old_notes.get(day) or default_notes.get(day, "")}
        ph = photos(pr.get("Photo"), pg["id"])
        if ph: photo_rows.append((day, pg["last_edited_time"], ph[-1]))
    # today's row photo wins, otherwise the most recently updated photo
    from datetime import datetime
    today = datetime.now().strftime("%A")
    photo_rows.sort(key=lambda r: (r[0] == today, r[1]), reverse=True)
    out = {"_note": "Synced from Notion > Website > Bins", "prices": prices}
    if photo_rows:
        out["photo"], out["photo_updated"], out["photo_caption"] = photo_rows[0][2], photo_rows[0][1][:10], ""
    else:
        out["photo"], out["photo_updated"], out["photo_caption"] = old.get("photo", ""), old.get("photo_updated", ""), old.get("photo_caption", "")
    write("bins", out)


def sync_trailers():
    items = []
    for pg in query(DBS["trailers"]):
        pr = pg["properties"]
        name = text(pr.get("Trailer"))
        status = sel(pr.get("Status")) or "In Stock"
        if not name or status == "Sold": continue
        price = num(pr.get("Price"))
        ph = photos(pr.get("Photos"), pg["id"])
        items.append({
            "id": pg["id"], "name": name, "status": status,
            "price": f"${price:,.0f}" if price else "Call for price",
            "photo": ph[0] if ph else "images/logo-color.png", "photos": ph,
            "specs": [s.strip("•- ").strip() for s in text(pr.get("Features")).splitlines() if s.strip()][:6],
            "description": text(pr.get("Description")),
        })
    write("trailers", {"_note": "Synced from Notion > Website > Food Trailers", "items": items})


def sync_gallery():
    shots = []
    for pg in sorted(query(DBS["gallery"]), key=lambda p: p["created_time"], reverse=True):
        pr = pg["properties"]
        cap = text(pr.get("Caption"))
        for src in photos(pr.get("Photos"), pg["id"]):
            shots.append({"src": src, "caption": cap})
    write("gallery", {"_note": "Synced from Notion > Website > Trailer Gallery", "photos": shots})


if __name__ == "__main__":
    ok = True
    for name, fn in [("furniture", sync_furniture), ("bins", sync_bins), ("trailers", sync_trailers), ("gallery", sync_gallery)]:
        try:
            print(f"Syncing {name}…"); fn()
        except urllib.error.HTTPError as e:
            ok = False
            msg = e.read().decode()[:160]
            print(f"  ✗ {name}: HTTP {e.code} — {msg}")
            if e.code == 404: print("    → Share the Notion 'Website' page with your integration (••• → Connections).")
        except Exception as e:
            ok = False; print(f"  ✗ {name}: {e}")
    # remove downloaded photos no data file uses anymore (deleted/sold items) — only after a fully clean run
    if ok and IMG.exists():
        used = "".join((DATA / f"{n}.json").read_text() for n in ("furniture", "bins", "trailers", "gallery"))
        for f in IMG.glob("*.jpg"):
            if f.name not in used:
                f.unlink(); print(f"  removed unused photo {f.name}")
    sys.exit(0 if ok else 1)
