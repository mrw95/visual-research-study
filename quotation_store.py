import html
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

STAFF = ["Nipun", "Isuru", "Malki", "Harshani", "Rakitha"]
QUOTE_ID_RE = re.compile(r"^GENX-\d{4}-\d{4}$")
NETWORK_QUOTES = Path(r"\\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations")


def _writable(folder: Path) -> bool:
    try:
        folder.mkdir(parents=True, exist_ok=True)
        probe = folder / ".write-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def quotation_root(project_root: Path) -> Path:
    env = os.environ.get("QUOTATION_DIR")
    for candidate in (Path(env) if env else None, NETWORK_QUOTES, project_root / "quotations"):
        if candidate is None:
            continue
        if _writable(candidate):
            return candidate
    fallback = project_root / "quotations"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def ensure_layout(root: Path, images_dir: Path) -> None:
    for name in STAFF:
        (root / name).mkdir(parents=True, exist_ok=True)
    letterhead = root / "_letterhead"
    letterhead.mkdir(exist_ok=True)
    for filename in ("genx-header.jpg", "genx-footer.jpg"):
        src = images_dir / filename
        dest = letterhead / filename
        if src.exists() and (not dest.exists() or src.stat().st_mtime > dest.stat().st_mtime):
            shutil.copy2(src, dest)


def staff_name(raw: str):
    key = str(raw or "").strip()
    for name in STAFF:
        if name.lower() == key.lower():
            return name
    return None


def safe_quote_id(raw: str) -> str:
    qid = str(raw or "").strip().upper()
    return qid if QUOTE_ID_RE.match(qid) else ""


def next_quote_id(root: Path) -> str:
    year = datetime.now().year
    pattern = re.compile(rf"^GENX-{year}-(\d+)$")
    max_n = 0
    for name in STAFF:
        folder = root / name
        if not folder.exists():
            continue
        for path in folder.glob("GENX-*.json"):
            match = pattern.match(path.stem)
            if match:
                max_n = max(max_n, int(match.group(1)))
    return f"GENX-{year}-{max_n + 1:04d}"


def find_quote(root: Path, qid: str):
    qid = safe_quote_id(qid)
    if not qid:
        return None
    for name in STAFF:
        path = root / name / f"{qid}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            data["person"] = name
            data["path"] = str(path)
            return data
    return None


def list_quotes(root: Path, person=None):
    wanted = staff_name(person) if person else None
    items = []
    names = [wanted] if wanted else STAFF
    for name in names:
        folder = root / name
        if not folder.exists():
            continue
        for path in folder.glob("GENX-*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            data["id"] = data.get("id") or path.stem
            data["person"] = name
            data["path"] = str(path)
            items.append(data)
    items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
    return items


def remove_quote_files(root: Path, qid: str, keep_person=None) -> None:
    qid = safe_quote_id(qid)
    if not qid:
        return
    for name in STAFF:
        if keep_person and name == keep_person:
            continue
        for ext in (".json", ".html"):
            path = root / name / f"{qid}{ext}"
            if path.exists():
                path.unlink()


def _v(data, key, fallback=""):
    return html.escape(str(data.get(key) or fallback))


def _money(data, key):
    raw = str(data.get(key) or "").replace(",", "")
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""
    return f"{int(digits):,}"


def quote_html(data: dict) -> str:
    rows = [
        ("Make", _v(data, "make")),
        ("Model", _v(data, "model")),
        ("Year", _v(data, "year")),
        ("Grade", _v(data, "grade")),
        ("Chassis No.", _v(data, "chassisNo")),
        ("Engine Capacity", _v(data, "engineCapacity")),
        ("Fuel Type", _v(data, "fuelType")),
        ("Transmission", _v(data, "transmission")),
        ("Mileage", _v(data, "mileage")),
        ("Colour", _v(data, "colour")),
        ("Origin", _v(data, "origin", "Japan")),
        ("Estimated Arrival", _v(data, "estimatedArrival")),
    ]
    vehicle = "".join(f"<tr><th>{label}</th><td>{value}</td></tr>" for label, value in rows)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{_v(data, "id")} — GENX Importers</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; color: #14202e; }}
    .sheet {{ width: 210mm; max-width: 100%; margin: 0 auto; background: #fff; }}
    img {{ width: 100%; display: block; }}
    .inner {{ padding: 16px 28px 20px; }}
    h2 {{ color: #1d5aaa; letter-spacing: .08em; font-size: 18px; }}
    h3 {{ color: #1d5aaa; border-bottom: 1px solid #ff6505; font-size: 13px; text-transform: uppercase; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #d5deea; padding: 7px 10px; text-align: left; }}
    th {{ width: 210px; background: #f4f7fb; }}
    .meta {{ text-align: right; }}
    .total {{ background: #fff4ea; font-weight: 800; }}
    .sign {{ height: 42px; border-bottom: 1px solid #9aa8b8; }}
    @page {{ size: A4; margin: 0; }}
  </style>
</head>
<body>
  <div class="sheet">
    <img src="../_letterhead/genx-header.jpg" alt="GENX Importers">
    <div class="inner">
      <table>
        <tr>
          <td><h2>PRE-ORDER VEHICLE QUOTATION</h2></td>
          <td class="meta">
            <div><strong>Quotation No:</strong> {_v(data, "id")}</div>
            <div><strong>Date:</strong> {_v(data, "quoteDate")}</div>
          </td>
        </tr>
      </table>
      <h3>Customer Details</h3>
      <p>{_v(data, "customerName")} · {_v(data, "contactNo")} · {_v(data, "email")}</p>
      <h3>Vehicle Details</h3>
      <table>{vehicle}</table>
      <h3>Price Details</h3>
      <table>
        <tr><th>Vehicle Cost</th><td>{_money(data, "vehicleCost")}</td></tr>
        <tr><th>Import Charges</th><td>{_money(data, "importCharges")}</td></tr>
        <tr><th>Registration Charges</th><td>{_money(data, "registrationCharges")}</td></tr>
        <tr><th>Other Charges</th><td>{_money(data, "otherCharges")}</td></tr>
        <tr class="total"><th>Total Estimated Price</th><td>{_money(data, "totalEstimatedPrice")}</td></tr>
      </table>
      <h3>Payment Terms</h3>
      <p><strong>Booking Advance:</strong> LKR {_money(data, "bookingAdvance")}</p>
      <p><strong>Balance Payment:</strong> Before vehicle release.</p>
      <p><strong>Estimated Delivery:</strong> {_v(data, "estimatedDeliveryWeeks")} weeks (subject to shipping &amp; customs clearance).</p>
      <h3>Prepared By</h3>
      <p><strong>Name:</strong> {_v(data, "preparedByName")}<br>
      <strong>Designation:</strong> {_v(data, "designation", "Sales Executive")}</p>
      <p>Signature</p>
      <div class="sign"></div>
    </div>
    <img src="../_letterhead/genx-footer.jpg" alt="">
  </div>
</body>
</html>
"""


def save_quote(root: Path, data: dict) -> dict:
    person = staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Prepared By name select කරන්න")

    qid = safe_quote_id(data.get("id")) or next_quote_id(root)
    now = datetime.now().isoformat()
    existing = find_quote(root, qid)
    data = dict(data)
    data["id"] = qid
    data["preparedByName"] = person
    data["designation"] = str(data.get("designation") or "Sales Executive").strip() or "Sales Executive"
    data["createdAt"] = (existing or {}).get("createdAt") or data.get("createdAt") or now
    data["updatedAt"] = now
    data["person"] = person

    remove_quote_files(root, qid, keep_person=person)
    folder = root / person
    folder.mkdir(parents=True, exist_ok=True)
    json_path = folder / f"{qid}.json"
    html_path = folder / f"{qid}.html"
    json_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    html_path.write_text(quote_html(data), encoding="utf-8")
    data["path"] = str(json_path)
    data["htmlPath"] = str(html_path)
    return data


def delete_quote(root: Path, qid: str) -> bool:
    existing = find_quote(root, qid)
    if not existing:
        return False
    remove_quote_files(root, existing["id"])
    return True
