import base64
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

STAFF_ROLES = {
    "Nipun": "Sales Executive",
    "Isuru": "Sales Executive",
    "Malki": "Admin & Marketing",
    "Harshani": "Director",
    "Rakitha": "CEO",
}
STAFF = list(STAFF_ROLES.keys())
QUOTE_ID_RE = re.compile(r"^CS-\d{4}-\d{4}$")
LEGACY_ID_RE = re.compile(r"^GENX-(\d{4}-\d{4})$")
ID_NUM_RE = re.compile(r"^(?:CS|GENX)-(\d{4})-(\d+)$")
NETWORK_QUOTES = Path(r"\\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Quotations")
DATA_DIR = "_data"


def _hide_windows(path: Path) -> None:
    if os.name != "nt":
        return
    try:
        import ctypes
        ctypes.windll.kernel32.SetFileAttributesW(str(path), 0x02)
    except Exception:
        pass


def data_folder(root: Path, person: str) -> Path:
    return root / DATA_DIR / person


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
        data_folder(root, name).mkdir(parents=True, exist_ok=True)
    letterhead = root / "_letterhead"
    letterhead.mkdir(exist_ok=True)
    (root / DATA_DIR).mkdir(exist_ok=True)
    _hide_windows(root / DATA_DIR)
    for filename in ("cs-header.jpg", "cs-footer.jpg"):
        src = images_dir / filename
        dest = letterhead / filename
        if src.exists() and (not dest.exists() or src.stat().st_mtime > dest.stat().st_mtime):
            try:
                shutil.copy2(src, dest)
            except OSError:
                pass
    _sweep_staff_clutter(root)


def _sweep_staff_clutter(root: Path) -> None:
    for name in STAFF:
        folder = root / name
        if not folder.exists():
            continue
        dest_dir = data_folder(root, name)
        dest_dir.mkdir(parents=True, exist_ok=True)
        for path in list(folder.glob("CS-*.json")) + list(folder.glob("GENX-*.json")):
            dest = dest_dir / path.name
            if path.parent == dest_dir:
                continue
            if not dest.exists():
                try:
                    shutil.move(str(path), str(dest))
                except OSError:
                    continue
            else:
                _safe_unlink(path)
        for path in list(folder.glob("CS-*.html")) + list(folder.glob("GENX-*.html")):
            _safe_unlink(path)
        for path in list(dest_dir.glob("GENX-*.json")):
            canon = safe_quote_id(path.stem)
            if not canon:
                continue
            dest = dest_dir / f"{canon}.json"
            if dest == path:
                continue
            if not dest.exists():
                try:
                    path.replace(dest)
                except OSError:
                    continue
            else:
                _safe_unlink(path)


def staff_name(raw: str):
    key = str(raw or "").strip()
    for name in STAFF:
        if name.lower() == key.lower():
            return name
    return None


def safe_quote_id(raw: str) -> str:
    qid = str(raw or "").strip().upper()
    legacy = LEGACY_ID_RE.match(qid)
    if legacy:
        return f"CS-{legacy.group(1)}"
    return qid if QUOTE_ID_RE.match(qid) else ""


def _id_aliases(qid: str) -> list[str]:
    qid = safe_quote_id(qid) or str(qid or "").strip().upper()
    aliases = [qid]
    if qid.startswith("CS-"):
        aliases.append("GENX-" + qid[3:])
    return aliases


def pdf_path_for(root: Path, person: str, qid: str) -> Path:
    for alias in _id_aliases(qid):
        nested = root / person / alias / f"{alias}.pdf"
        if nested.exists():
            return nested
        flat = root / person / f"{alias}.pdf"
        if flat.exists():
            return flat
    qid = safe_quote_id(qid) or qid
    return root / person / qid / f"{qid}.pdf"


def next_quote_id(root: Path) -> str:
    year = datetime.now().year
    used = set()
    folders = [data_folder(root, name) for name in STAFF]
    folders.extend(root / name for name in STAFF)
    for folder in folders:
        if not folder.exists():
            continue
        for path in folder.iterdir():
            if not path.is_file() or path.suffix.lower() != ".json":
                continue
            match = ID_NUM_RE.match(path.stem)
            if match and int(match.group(1)) == year:
                used.add(int(match.group(2)))
    n = 1
    while n in used:
        n += 1
    return f"CS-{year}-{n:04d}"


def find_quote(root: Path, qid: str):
    qid = safe_quote_id(qid)
    if not qid:
        return None
    for name in STAFF:
        paths = []
        for alias in _id_aliases(qid):
            paths.append(data_folder(root, name) / f"{alias}.json")
            paths.append(root / name / f"{alias}.json")
        for path in paths:
            if not path.exists():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            data["id"] = qid
            data["person"] = name
            data["path"] = str(path)
            data["pdfPath"] = str(pdf_path_for(root, name, qid))
            return data
    return None


def list_quotes(root: Path, person=None):
    wanted = staff_name(person) if person else None
    items = []
    names = [wanted] if wanted else STAFF
    for name in names:
        seen = set()
        for folder in (data_folder(root, name), root / name):
            if not folder.exists():
                continue
            files = list(folder.glob("CS-*.json")) + list(folder.glob("GENX-*.json"))
            for path in files:
                if not path.is_file():
                    continue
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue
                canon = safe_quote_id(data.get("id") or path.stem)
                if not canon or canon in seen:
                    continue
                data["id"] = canon
                data["person"] = name
                data["path"] = str(path)
                data["pdfPath"] = str(pdf_path_for(root, name, canon))
                items.append(data)
                seen.add(canon)
    items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
    return items


def _safe_unlink(path: Path) -> None:
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def remove_quote_files(root: Path, qid: str, keep_person=None) -> None:
    qid = safe_quote_id(qid)
    if not qid:
        return
    for name in STAFF:
        for alias in _id_aliases(qid):
            quote_dir = root / name / alias
            keep = keep_person == name and alias == qid
            paths = [
                root / name / f"{alias}.html",
                root / name / f"{alias}.json",
            ]
            if not keep:
                paths.extend([
                    quote_dir / f"{alias}.pdf",
                    root / name / f"{alias}.pdf",
                    data_folder(root, name) / f"{alias}.json",
                ])
            for path in paths:
                _safe_unlink(path)
            if not keep and quote_dir.exists() and quote_dir.is_dir():
                shutil.rmtree(quote_dir, ignore_errors=True)


def _v(data, key, fallback=""):
    return html.escape(str(data.get(key) or fallback))


def _num(data, key):
    raw = str(data.get(key) or "").replace(",", "").strip()
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch == ".")
    if not cleaned or cleaned == ".":
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _fmt(n, places=2):
    if n is None or n == "":
        return ""
    try:
        n = float(n)
    except (TypeError, ValueError):
        return ""
    return f"{n:,.{places}f}"


def _money(data, key):
    n = _num(data, key)
    return _fmt(n)


def _has_num(data, key):
    return bool(str(data.get(key) or "").strip().replace(",", "").replace(" ", ""))


def price_breakdown(data):
    cif_jpy = _num(data, "cifJpy")
    lc_jpy = _num(data, "lcJpy")
    lc_rate = _num(data, "lcRate")
    bal_rate = _num(data, "balRate")
    lc_lkr = _num(data, "lcLkr") if _has_num(data, "lcLkr") else lc_jpy * lc_rate
    bal_jpy = _num(data, "balJpy") if _has_num(data, "balJpy") else (cif_jpy - lc_jpy)
    bal_lkr = _num(data, "balLkr") if _has_num(data, "balLkr") else bal_jpy * bal_rate
    japan = _num(data, "japanCostLkr") if _has_num(data, "japanCostLkr") else lc_lkr + bal_lkr
    duty = _num(data, "customsDuty")
    clearing = _num(data, "clearingCharges")
    agency = _num(data, "agencyFee")
    hand = _num(data, "totalEstimatedPrice") if _has_num(data, "totalEstimatedPrice") else japan + duty + clearing + agency
    return {
        "cifJpy": _fmt(cif_jpy),
        "lcRate": _fmt(lc_rate, 2) if lc_rate else "",
        "lcJpy": _fmt(lc_jpy),
        "lcLkr": _fmt(lc_lkr),
        "balRate": _fmt(bal_rate, 2) if bal_rate else "",
        "balJpy": _fmt(bal_jpy),
        "balLkr": _fmt(bal_lkr),
        "japanCostLkr": _fmt(japan),
        "customsDuty": _fmt(duty),
        "clearingCharges": _fmt(clearing),
        "agencyFee": _fmt(agency),
        "totalEstimatedPrice": _fmt(hand),
    }


def _signature_src(data):
    raw = str(data.get("signatureImage") or "").strip()
    if raw.startswith("data:image/") and "," in raw:
        return html.escape(raw, quote=True)
    return ""


def _data_uri(path: Path) -> str:
    raw = path.read_bytes()
    ext = path.suffix.lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def _letterhead_file(root: Path, filename: str, images_dir: Path | None) -> Path:
    candidates = [root / "_letterhead" / filename]
    if images_dir:
        candidates.append(Path(images_dir) / filename)
    for path in candidates:
        if path.exists():
            return path
    return candidates[0]


def _find_browser() -> str:
    names = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Google/Chrome/Application/chrome.exe",
    ]
    for path in names:
        if path.exists():
            return str(path)
    for name in ("msedge", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return ""


def _browser_pdf(html_text: str, pdf_path: Path) -> None:
    browser = _find_browser()
    if not browser:
        raise RuntimeError("Edge/Chrome හොයා ගන්න බැරි වුණා")
    with tempfile.TemporaryDirectory(prefix="genx-quote-") as tmp:
        tmp_dir = Path(tmp)
        html_file = tmp_dir / "quote.html"
        out_pdf = tmp_dir / "quote.pdf"
        profile = tmp_dir / "profile"
        profile.mkdir(exist_ok=True)
        html_file.write_text(html_text, encoding="utf-8")
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        last_err = "print-to-pdf failed"
        for headless in ("--headless=new", "--headless"):
            if out_pdf.exists():
                out_pdf.unlink()
            cmd = [
                browser,
                headless,
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--hide-scrollbars",
                f"--user-data-dir={profile}",
                "--no-pdf-header-footer",
                f"--print-to-pdf={out_pdf}",
                html_file.resolve().as_uri(),
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=45,
                creationflags=flags,
            )
            if out_pdf.exists() and out_pdf.stat().st_size >= 1000:
                _install_pdf(out_pdf, pdf_path)
                _keep_first_page(pdf_path)
                return
            last_err = (result.stderr or result.stdout or last_err).strip()[:300]
        raise RuntimeError(last_err)


def _install_pdf(src: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.stem + ".tmp.pdf")
    try:
        shutil.copy2(src, tmp)
        os.replace(tmp, dest)
        return dest
    except OSError:
        _safe_unlink(tmp)
        fallback = dest.with_name(dest.stem + "-saved.pdf")
        try:
            shutil.copy2(src, fallback)
            return fallback
        except OSError:
            return dest


def _keep_first_page(pdf_path: Path) -> None:
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError:
            return
    try:
        reader = PdfReader(str(pdf_path))
        if len(reader.pages) <= 1:
            return
        writer = PdfWriter()
        writer.add_page(reader.pages[0])
        tmp = pdf_path.with_name(pdf_path.stem + ".onepage.pdf")
        with tmp.open("wb") as fh:
            writer.write(fh)
        _install_pdf(tmp, pdf_path)
        _safe_unlink(tmp)
    except Exception:
        pass


def _reportlab_pdf(pdf_path: Path, data: dict, header_path: Path, footer_path: Path) -> None:
    from reportlab.lib.colors import Color, HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font_regular = "Helvetica"
    font_bold = "Helvetica-Bold"
    segoe = Path(r"C:\Windows\Fonts\segoeui.ttf")
    segoe_bold = Path(r"C:\Windows\Fonts\segoeuib.ttf")
    if segoe.exists() and segoe_bold.exists():
        pdfmetrics.registerFont(TTFont("Segoe", str(segoe)))
        pdfmetrics.registerFont(TTFont("Segoe-Bold", str(segoe_bold)))
        font_regular = "Segoe"
        font_bold = "Segoe-Bold"

    page_w, page_h = A4
    navy = HexColor("#1d5aaa")
    gold = HexColor("#ff6505")
    ink = HexColor("#14202e")
    muted = HexColor("#5c6b7a")
    line = HexColor("#d5deea")
    fill = HexColor("#f4f7fb")
    total_bg = HexColor("#fff4ea")
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    header = ImageReader(str(header_path))
    hw, hh = header.getSize()
    header_h = page_w * hh / hw
    c.drawImage(header, 0, page_h - header_h, width=page_w, height=header_h, preserveAspectRatio=True, mask="auto")

    footer = ImageReader(str(footer_path))
    fw, fh = footer.getSize()
    footer_h = page_w * fh / fw
    c.drawImage(footer, 0, 0, width=page_w, height=footer_h, preserveAspectRatio=True, mask="auto")

    left = 36
    right = page_w - 36
    y = page_h - header_h - 22

    def text(value, fallback=""):
        return str(value or fallback)

    def money(key):
        return _money(data, key)

    c.setFillColor(navy)
    c.setFont(font_bold, 18)
    c.drawString(left, y, "PRE-ORDER VEHICLE QUOTATION")
    c.setFillColor(ink)
    c.setFont(font_bold, 9)
    c.drawRightString(right, y + 10, f"Quotation No: {text(data.get('id'))}")
    c.setFont(font_regular, 9)
    c.drawRightString(right, y - 4, f"Date: {text(data.get('quoteDate'))}")
    y -= 16
    c.setStrokeColor(gold)
    c.setLineWidth(1)
    c.line(left, y, right, y)
    y -= 18

    def heading(label):
        nonlocal y
        c.setFillColor(navy)
        c.setFont(font_bold, 10)
        c.drawString(left, y, label.upper())
        y -= 4
        c.setStrokeColor(gold)
        c.line(left, y, right, y)
        y -= 14

    def kv_table(rows, highlight_last=False, box_right=None):
        nonlocal y
        row_h = 16
        label_w = 168
        edge = box_right if box_right is not None else right
        for i, (label, value) in enumerate(rows):
            if y < footer_h + 40:
                break
            bg = total_bg if highlight_last and i == len(rows) - 1 else (fill if i % 2 == 0 else Color(1, 1, 1))
            c.setFillColor(bg)
            c.rect(left, y - 4, edge - left, row_h, fill=1, stroke=0)
            c.setStrokeColor(line)
            c.rect(left, y - 4, edge - left, row_h, fill=0, stroke=1)
            c.line(left + label_w, y - 4, left + label_w, y - 4 + row_h)
            c.setFillColor(ink)
            c.setFont(font_bold, 8)
            c.drawString(left + 8, y + 1, label)
            c.setFont(font_regular, 8)
            c.drawString(left + label_w + 8, y + 1, text(value))
            y -= row_h
        y -= 10

    heading("Customer Details")
    col_w = (right - left) / 3
    cust_labels = ("Customer Name", "Contact No", "Email")
    cust_values = (
        text(data.get("customerName")),
        text(data.get("contactNo")),
        text(data.get("email")),
    )
    c.setFillColor(muted)
    c.setFont(font_bold, 8)
    for i, label in enumerate(cust_labels):
        c.drawString(left + i * col_w, y, label)
    y -= 16
    c.setStrokeColor(HexColor("#c5d0dc"))
    c.setFillColor(ink)
    c.setFont(font_bold, 10)
    for i, value in enumerate(cust_values):
        x = left + i * col_w
        c.drawString(x, y + 4, value)
        c.line(x, y, x + col_w - 12, y)
    y -= 16

    heading("Vehicle Details")
    vehicle_rows = [
        ("Make", data.get("make")),
        ("Model", data.get("model")),
        ("Year", data.get("year")),
        ("Grade", data.get("grade")),
        ("Engine Capacity", data.get("engineCapacity")),
        ("Fuel Type", data.get("fuelType")),
        ("Transmission", data.get("transmission")),
        ("Mileage", data.get("mileage")),
        ("Colour", data.get("colour")),
        ("Origin", data.get("origin") or "Japan"),
        ("Estimated Arrival", data.get("estimatedArrival")),
    ]
    photo = str(data.get("vehiclePhoto") or "")
    photo_w = 170
    table_right = right - photo_w - 8 if photo.startswith("data:image/") else right
    y_photo_top = y
    kv_table(vehicle_rows, box_right=table_right)
    if photo.startswith("data:image/") and "," in photo:
        try:
            import io
            raw = base64.b64decode(photo.split(",", 1)[1])
            pic = ImageReader(io.BytesIO(raw))
            table_h = 11 * 16
            c.drawImage(
                pic,
                right - photo_w,
                y_photo_top - table_h + 12,
                width=photo_w,
                height=table_h,
                preserveAspectRatio=True,
                anchor="c",
                mask="auto",
            )
        except Exception:
            pass

    heading("Price Details")
    p = price_breakdown(data)
    col_x = [left, left + 198, left + 268, left + 378]
    col_w = [198, 70, 110, right - (left + 378)]
    headers = ("", "Ex. Rate", "AMOUNT JPY", "AMOUNT LKR")
    cif_rows = [
        ("Total Cost CIF JPY", "", p["cifJpy"], ""),
        ("LC Amount", p["lcRate"], p["lcJpy"], p["lcLkr"]),
        ("CIF Balance Amount - JPY", p["balRate"], p["balJpy"], p["balLkr"]),
    ]
    row_h = 15
    c.setFillColor(navy)
    c.rect(left, y - 4, right - left, row_h, fill=1, stroke=0)
    c.setFillColor(Color(1, 1, 1))
    c.setFont(font_bold, 7)
    for i, label in enumerate(headers):
        if i == 0:
            c.drawString(col_x[i] + 6, y + 1, label)
        else:
            c.drawRightString(col_x[i] + col_w[i] - 6, y + 1, label)
    y -= row_h
    c.setStrokeColor(line)
    for r, row in enumerate(cif_rows):
        bg = fill if r % 2 == 0 else Color(1, 1, 1)
        c.setFillColor(bg)
        c.rect(left, y - 4, right - left, row_h, fill=1, stroke=0)
        c.setStrokeColor(line)
        c.rect(left, y - 4, right - left, row_h, fill=0, stroke=1)
        c.setFillColor(ink)
        c.setFont(font_bold, 7)
        c.drawString(left + 6, y + 1, row[0])
        c.setFont(font_regular, 7)
        for i in range(1, 4):
            c.drawRightString(col_x[i] + col_w[i] - 6, y + 1, row[i])
        y -= row_h
    y -= 8
    summary = [
        ("Total Japan Cost - LKR", p["japanCostLkr"], False),
        ("Customs Duty - LKR", p["customsDuty"], False),
        ("Customs Clearing & Other Charges - LKR", p["clearingCharges"], False),
        ("Agency Fee", p["agencyFee"], False),
        ("Total Upto Hand - LKR", p["totalEstimatedPrice"], True),
    ]
    for i, (label, value, hand) in enumerate(summary):
        bg = Color(1, 1, 1)
        c.setFillColor(bg)
        c.rect(left, y - 4, right - left, row_h, fill=1, stroke=0)
        c.setStrokeColor(line)
        c.rect(left, y - 4, right - left, row_h, fill=0, stroke=1)
        c.setFillColor(HexColor("#c41e3a") if hand else ink)
        c.setFont(font_bold, 8 if hand else 7)
        c.drawString(left + 6, y + 1, label)
        c.drawRightString(right - 6, y + 1, value)
        y -= row_h
    y -= 10

    heading("Terms & Conditions")
    terms = [
        "This quotation is valid for 07 days from the quotation date.",
        "The Letter of Credit (LC) must be opened within 07 days of signing the Proforma Invoice.",
        "Final price may vary due to exchange rate, shipping cost, taxes, and government regulations.",
        "Booking advance is required to confirm the order.",
        "Delivery time depends on shipping schedules and customs clearance.",
        "Any additional government taxes or levies imposed after booking will be borne by the customer.",
    ]
    c.setFillColor(ink)
    c.setFont(font_regular, 8)
    for i, term in enumerate(terms, 1):
        c.drawString(left, y, f"{i}. {term}")
        y -= 12

    y -= 14
    heading("Prepared By")
    sign_right = left + (right - left) * 0.68
    col_w = (sign_right - left) / 3
    labels = ("Name", "Designation", "Signature")
    values = (text(data.get("preparedByName")), text(data.get("designation")), "")
    c.setFillColor(muted)
    c.setFont(font_bold, 8)
    for i, label in enumerate(labels):
        c.drawString(left + i * col_w, y, label)
    y -= 36
    c.setStrokeColor(HexColor("#c5d0dc"))
    for i in range(3):
        c.line(left + i * col_w, y, left + (i + 1) * col_w - 12, y)
    c.setFillColor(ink)
    c.setFont(font_regular, 9)
    c.drawString(left, y + 8, values[0])
    c.drawString(left + col_w, y + 8, values[1])

    src = str(data.get("signatureImage") or "")
    if src.startswith("data:image/") and "," in src:
        try:
            raw = base64.b64decode(src.split(",", 1)[1])
            sign = ImageReader(__import__("io").BytesIO(raw))
            scale = max(28, min(96, int(data.get("signatureScale") or 48)))
            x_off = max(0, int(data.get("signatureX") or 0))
            sw, sh = sign.getSize()
            draw_h = scale * 0.75
            draw_w = draw_h * sw / sh if sh else draw_h * 2
            c.drawImage(
                sign,
                left + 2 * col_w + min(x_off, 80),
                y + 2,
                width=draw_w,
                height=draw_h,
                mask="auto",
                preserveAspectRatio=True,
            )
        except Exception:
            pass

    c.save()


def write_quote_pdf(pdf_path: Path, data: dict, root: Path, images_dir: Path | None = None) -> None:
    header = _letterhead_file(root, "cs-header.jpg", images_dir)
    footer = _letterhead_file(root, "cs-footer.jpg", images_dir)
    if not header.exists() or not footer.exists():
        raise RuntimeError("Letterhead images හොයා ගන්න බැරි වුණා")
    html_text = quote_html(data, header_uri=_data_uri(header), footer_uri=_data_uri(footer))
    skip_chrome = os.environ.get("SKIP_CHROME_PDF", "").strip().lower() in ("1", "true", "yes")
    made = False
    if not skip_chrome:
        try:
            _browser_pdf(html_text, pdf_path)
            made = pdf_path.exists() and pdf_path.stat().st_size >= 800
        except Exception:
            made = False
    if not made:
        tmp = pdf_path.with_name(pdf_path.stem + ".building.pdf")
        try:
            _reportlab_pdf(tmp, data, header, footer)
            _install_pdf(tmp, pdf_path)
        finally:
            _safe_unlink(tmp)
    _keep_first_page(pdf_path)


def _pdf_field(label: str, value: str) -> str:
    shown = value if value else "&nbsp;"
    return f'<label class="field"><span>{label}</span><p>{shown}</p></label>'


def _price_html(data: dict) -> str:
    p = price_breakdown(data)
    return f"""<table class="price">
        <thead><tr><th></th><th class="amt">Ex. Rate</th><th class="amt">AMOUNT JPY</th><th class="amt">AMOUNT LKR</th></tr></thead>
        <tbody>
          <tr><td>Total Cost CIF JPY</td><td class="amt"></td><td class="amt">{p["cifJpy"]}</td><td class="amt"></td></tr>
          <tr><td>LC Amount</td><td class="amt">{p["lcRate"]}</td><td class="amt">{p["lcJpy"]}</td><td class="amt">{p["lcLkr"]}</td></tr>
          <tr><td>CIF Balance Amount - JPY</td><td class="amt">{p["balRate"]}</td><td class="amt">{p["balJpy"]}</td><td class="amt">{p["balLkr"]}</td></tr>
        </tbody>
      </table>
      <table class="price lkr-sum">
        <tbody>
          <tr><td>Total Japan Cost - LKR</td><td class="amt">{p["japanCostLkr"]}</td></tr>
          <tr><td>Customs Duty - LKR</td><td class="amt">{p["customsDuty"]}</td></tr>
          <tr><td>Customs Clearing &amp; Other Charges - LKR</td><td class="amt">{p["clearingCharges"]}</td></tr>
          <tr><td>Agency Fee</td><td class="amt">{p["agencyFee"]}</td></tr>
          <tr class="hand"><td>Total Upto Hand - LKR</td><td class="amt">{p["totalEstimatedPrice"]}</td></tr>
        </tbody>
      </table>"""


def quote_html(data: dict, header_uri: str = "", footer_uri: str = "") -> str:
    rows = [
        ("Make", _v(data, "make")),
        ("Model", _v(data, "model")),
        ("Year", _v(data, "year")),
        ("Grade", _v(data, "grade")),
        ("Engine Capacity", _v(data, "engineCapacity")),
        ("Fuel Type", _v(data, "fuelType")),
        ("Transmission", _v(data, "transmission")),
        ("Mileage", _v(data, "mileage")),
        ("Colour", _v(data, "colour")),
        ("Origin", _v(data, "origin", "Japan")),
        ("Estimated Arrival", _v(data, "estimatedArrival")),
    ]
    vehicle = "".join(f"<tr><th>{label}</th><td>{value}</td></tr>" for label, value in rows)
    photo = str(data.get("vehiclePhoto") or "").strip()
    photo_html = (
        f'<div class="vehicle-photo"><img src="{html.escape(photo, quote=True)}" alt="Vehicle"></div>'
        if photo.startswith("data:image/") and "," in photo
        else '<div class="vehicle-photo"></div>'
    )
    head = header_uri or "../_letterhead/cs-header.jpg"
    foot = footer_uri or "../_letterhead/cs-footer.jpg"
    sign_h = max(28, min(44, int(data.get("signatureScale") or 36)))
    sign_x = max(0, int(data.get("signatureX") or 0))
    sign = _signature_src(data)
    sign_html = (
        f'<img class="sign-img" src="{sign}" alt="Signature" style="height:{sign_h}px;margin-left:{sign_x}px">'
        if sign else '<div class="sign-line"></div>'
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{_v(data, "id")} — CarSwitch</title>
  <style>
    @page {{ size: A4; margin: 0; }}
    html, body {{
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #fff;
      color: #14202e;
      font-family: "Segoe UI", Arial, sans-serif;
    }}
    .sheet {{
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
    }}
    .head, .foot {{ width: 100%; display: block; flex: 0 0 auto; }}
    .head {{ max-height: 28mm; object-fit: contain; object-position: top left; }}
    .foot {{ max-height: 22mm; object-fit: contain; object-position: bottom left; }}
    .inner {{
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 3mm 12mm 3mm;
    }}
    .dochead {{
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex: 0 0 auto;
    }}
    h2 {{ color: #1d5aaa; letter-spacing: .06em; font-size: 20px; font-weight: 800; margin: 0; }}
    h3 {{
      color: #1d5aaa;
      border-bottom: 1px solid #ff6505;
      font-size: 11px;
      letter-spacing: .06em;
      text-transform: uppercase;
      margin: 7px 0 6px;
      padding-bottom: 3px;
    }}
    .meta {{ text-align: right; font-size: 11px; font-weight: 700; }}
    .meta div {{ margin-bottom: 3px; }}
    .meta b {{ font-weight: 800; color: #1d5aaa; }}
    .grid {{
      display: grid;
      grid-template-columns: 1.2fr 1fr 1.2fr;
      gap: 12px;
    }}
    .field span {{
      display: block;
      color: #5c6b7a;
      font-size: 9px;
      font-weight: 700;
      margin-bottom: 3px;
    }}
    .field p {{
      margin: 0;
      border-bottom: 1px solid #c5d0dc;
      padding: 2px 0 5px;
      font-size: 13px;
      font-weight: 700;
      color: #14202e;
      min-height: 16px;
    }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #d5deea; padding: 4px 8px; text-align: left; font-size: 11px; }}
    th {{ width: 160px; background: #f4f7fb; color: #1d5aaa; font-weight: 700; }}
    .price thead th {{ background: #1d5aaa; color: #fff; width: auto; }}
    .price .amt {{ width: 120px; text-align: right; }}
    .price td:first-child {{ font-weight: 700; }}
    .lkr-sum {{ margin-top: 8px; }}
    .hand td {{ color: #c41e3a; font-weight: 800; background: #fff; }}
    ol {{ margin: 0; padding-left: 18px; font-size: 10.5px; }}
    li {{ margin: 2px 0; }}
    .prepared {{ margin-top: 10px; flex: 0 0 auto; }}
    .vehicle-wrap {{ flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }}
    .vehicle-wrap h3 {{ flex: 0 0 auto; }}
    .vehicle-layout {{
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 38%;
      gap: 8px;
      align-items: stretch;
    }}
    .vehicle-layout table {{ margin: 0; height: 100%; }}
    .vehicle-photo {{
      border: 1px solid #d5deea;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      min-height: 0;
    }}
    .vehicle-photo img {{
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: center;
      display: block;
    }}
    .sign-row {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      align-items: end;
      width: 68%;
      max-width: 125mm;
    }}
    .sign-row > div {{
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 40px;
    }}
    .sign-row span {{ display: block; color: #5c6b7a; font-size: 9px; font-weight: 700; margin-bottom: 10px; }}
    .sign-row p {{
      margin: 0;
      min-height: 22px;
      border-bottom: 1px solid #c5d0dc;
      padding-bottom: 3px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
    }}
    .sign-img {{ height: 32px; max-width: 100%; width: auto; display: block; background: transparent; object-fit: contain; object-position: left bottom; }}
    .sign-line {{ height: 22px; border-bottom: 1px solid #c5d0dc; }}
  </style>
</head>
<body>
  <div class="sheet">
    <img class="head" src="{head}" alt="CarSwitch">
    <div class="inner">
      <div class="dochead">
        <h2>PRE-ORDER VEHICLE QUOTATION</h2>
        <div class="meta">
          <div>Quotation No: <b>{_v(data, "id")}</b></div>
          <div>Date: {_v(data, "quoteDate")}</div>
        </div>
      </div>
      <h3>Customer Details</h3>
      <div class="grid">
        {_pdf_field("Customer Name", _v(data, "customerName"))}
        {_pdf_field("Contact No", _v(data, "contactNo"))}
        {_pdf_field("Email", _v(data, "email"))}
      </div>
      <div class="vehicle-wrap">
        <h3>Vehicle Details</h3>
        <div class="vehicle-layout">
          <table>{vehicle}</table>
          {photo_html}
        </div>
      </div>
      <h3>Price Details</h3>
      {_price_html(data)}
      <h3>Terms &amp; Conditions</h3>
      <ol>
        <li>This quotation is valid for 07 days from the quotation date.</li>
        <li>The Letter of Credit (LC) must be opened within 07 days of signing the Proforma Invoice.</li>
        <li>Final price may vary due to exchange rate, shipping cost, taxes, and government regulations.</li>
        <li>Booking advance is required to confirm the order.</li>
        <li>Delivery time depends on shipping schedules and customs clearance.</li>
        <li>Any additional government taxes or levies imposed after booking will be borne by the customer.</li>
      </ol>
      <div class="prepared">
      <h3>Prepared By</h3>
      <div class="sign-row">
        <div><span>Name</span><p>{_v(data, "preparedByName")}</p></div>
        <div><span>Designation</span><p>{_v(data, "designation")}</p></div>
        <div><span>Signature</span>{sign_html}</div>
      </div>
      </div>
    </div>
    <img class="foot" src="{foot}" alt="">
  </div>
</body>
</html>
"""


def save_quote(root: Path, data: dict, images_dir: Path | None = None) -> dict:
    person = staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Prepared By name select කරන්න")

    requested = safe_quote_id(data.get("id"))
    existing = find_quote(root, requested) if requested else None
    qid = requested or next_quote_id(root)
    now = datetime.now().isoformat()
    data = dict(data)
    data["id"] = qid
    data["preparedByName"] = person
    data["designation"] = STAFF_ROLES[person]
    data["createdAt"] = (existing or {}).get("createdAt") or data.get("createdAt") or now
    data["updatedAt"] = now
    data["person"] = person
    data["signatureImage"] = str(data.get("signatureImage") or "").strip()
    if not data["signatureImage"].startswith("data:image/"):
        data["signatureImage"] = ""
    data["vehiclePhoto"] = str(data.get("vehiclePhoto") or "").strip()
    if not data["vehiclePhoto"].startswith("data:image/"):
        data["vehiclePhoto"] = ""
    priced = price_breakdown(data)
    data["lcLkr"] = priced["lcLkr"].replace(",", "")
    data["balJpy"] = priced["balJpy"].replace(",", "")
    data["balLkr"] = priced["balLkr"].replace(",", "")
    data["japanCostLkr"] = priced["japanCostLkr"].replace(",", "")
    data["totalEstimatedPrice"] = priced["totalEstimatedPrice"].replace(",", "")

    remove_quote_files(root, qid, keep_person=person)
    folder = root / person
    quote_dir = folder / qid
    quote_dir.mkdir(parents=True, exist_ok=True)
    store = data_folder(root, person)
    store.mkdir(parents=True, exist_ok=True)
    _hide_windows(root / DATA_DIR)
    json_path = store / f"{qid}.json"
    pdf_path = quote_dir / f"{qid}.pdf"
    json_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    try:
        write_quote_pdf(pdf_path, data, root, images_dir)
    except Exception:
        pass
    data["path"] = str(json_path)
    data["pdfPath"] = str(pdf_path)
    return data


def delete_quote(root: Path, qid: str) -> bool:
    qid = safe_quote_id(qid)
    if not qid:
        return False
    remove_quote_files(root, qid)
    return True
