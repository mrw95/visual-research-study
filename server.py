"""Visual Research Study — 6 images, pick exactly 3."""

import html
import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_file, send_from_directory
from urllib.parse import quote
from werkzeug.middleware.proxy_fix import ProxyFix

import quotation_store

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
DATA_FILE = ROOT / "submissions.json"

ADMIN_KEY = os.environ.get("ADMIN_KEY", "research2026")
QUOTE_PIN = os.environ.get("QUOTE_PIN", "9292").strip()
QUOTE_TOKEN = hashlib.sha256(f"carswitch-quote|{QUOTE_PIN}".encode("utf-8")).hexdigest()
HOME_LINK_FILE = ROOT / "quotation-home-link.txt"
PUBLIC_QUOTE_URL = ""
REQUIRED = 3
IMAGE_COUNT = 6
IMAGE_LABELS = {
    1: "Smart Study Area with AC / Free Wifi",
    2: "Mobile Accessories",
    3: "Branded Decants Perfumes",
    4: "Bookshop and Stationery",
    5: "Budget Price Cafe",
    6: "Smart Cafe",
}


def load_submissions():
    if not DATA_FILE.exists():
        return []
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_submissions(items):
    DATA_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def try_redis():
    url = os.environ.get("REDIS_URL") or os.environ.get("KV_REST_API_URL")
    if not url:
        return None
    try:
        import redis

        return redis.from_url(url, decode_responses=True)
    except Exception:
        return None


def redis_key():
    return "visual-study:submissions"


def add_submission(entry):
    r = try_redis()
    if r:
        r.lpush(redis_key(), json.dumps(entry))
        return
    items = load_submissions()
    items.append(entry)
    save_submissions(items)


def get_all_submissions():
    r = try_redis()
    if r:
        raw = r.lrange(redis_key(), 0, -1)
        return [json.loads(x) for x in reversed(raw)]
    return load_submissions()


def list_images():
    found = []
    for i in range(1, IMAGE_COUNT + 1):
        for ext in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
            p = IMAGES_DIR / f"{i}{ext}"
            if p.exists():
                found.append({
                    "id": i,
                    "url": f"/images/{p.name}",
                    "label": IMAGE_LABELS.get(i, f"Option {i}"),
                })
                break
    return found


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/admin")
def admin_page():
    return send_from_directory(ROOT, "admin.html")


@app.get("/hotline")
def hotline_page():
    return send_from_directory(ROOT, "hotline.html")


@app.get("/inbox")
def inbox_page():
    return send_from_directory(ROOT, "inbox.html")


def _public_host() -> bool:
    host = (request.host or "").split(":")[0].lower()
    return (
        host.endswith("trycloudflare.com")
        or "cfargotunnel.com" in host
        or bool(request.headers.get("CF-Connecting-IP"))
    )


@app.before_request
def _quote_pin_gate():
    if not QUOTE_PIN or not _public_host():
        return None
    path = request.path or ""
    if path in ("/quote-login", "/quote-unlock") or path.startswith("/static/") or path.startswith("/images/"):
        return None
    if request.cookies.get("cs_quote") == QUOTE_TOKEN:
        return None
    if path.startswith("/api/"):
        if path.endswith("/pdf"):
            nxt = path
            if request.query_string:
                nxt += "?" + request.query_string.decode("utf-8", "ignore")
            return redirect("/quote-login?next=" + quote(nxt, safe=""))
        return jsonify({"ok": False, "error": "Login required"}), 401
    nxt = path if path.startswith("/") else "/quotation"
    if request.query_string:
        nxt += "?" + request.query_string.decode("utf-8", "ignore")
    return redirect("/quote-login?next=" + quote(nxt, safe=""))


@app.get("/quote-login")
def quote_login_page():
    return send_from_directory(ROOT, "quote-login.html")


@app.post("/quote-unlock")
def quote_unlock():
    nxt = str(request.form.get("next") or "/quotation")
    if not nxt.startswith("/"):
        nxt = "/quotation"
    pin = str(request.form.get("pin") or "").strip()
    if pin != QUOTE_PIN:
        return redirect("/quote-login?err=1&next=" + nxt)
    resp = redirect(nxt)
    resp.set_cookie("cs_quote", QUOTE_TOKEN, httponly=True, samesite="Lax", max_age=60 * 60 * 24 * 30)
    return resp


@app.get("/home-link")
def home_link_page():
    if _public_host():
        return jsonify({"error": "Not found"}), 404
    url = PUBLIC_QUOTE_URL.strip()
    if HOME_LINK_FILE.exists() and not url:
        url = HOME_LINK_FILE.read_text(encoding="utf-8").strip()
    if not url:
        return "<p>Home link එක තාම ready නැහැ. START-QUOTATION.bat window එකේ මොහොතක් ඉන්න.</p>", 200
    quote = url.rstrip("/") + "/quotation"
    return (
        "<!DOCTYPE html><meta charset='UTF-8'><title>Home link</title>"
        f"<p>ගෙදර / laptop: <a href='{html.escape(quote, quote=True)}'>{html.escape(quote)}</a></p>"
        f"<p>PIN: {html.escape(QUOTE_PIN)}</p>"
    )


@app.get("/quotation")
@app.get("/quotation.html")
def quotation_page():
    return send_from_directory(ROOT, "quotation.html")


@app.get("/quotations")
@app.get("/quotations.html")
def quotations_page():
    return send_from_directory(ROOT, "quotations.html")


def quotes_dir():
    root = quotation_store.quotation_root(ROOT)
    quotation_store.ensure_layout(root, IMAGES_DIR)
    return root


@app.get("/api/quotations")
def api_quotations():
    root = quotes_dir()
    person = request.args.get("person", "")
    return jsonify({
        "ok": True,
        "root": str(root),
        "staff": quotation_store.STAFF,
        "items": quotation_store.list_quotes(root, person),
    })


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response


@app.route("/api/quotation", methods=["GET", "POST", "DELETE", "OPTIONS"])
def api_quotation():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    root = quotes_dir()
    if request.method == "GET":
        qid = request.args.get("id") or request.args.get("ref") or ""
        item = quotation_store.find_quote(root, qid)
        if not item:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True, "root": str(root), "item": item})

    if request.method == "DELETE":
        qid = request.args.get("id") or (request.get_json(silent=True) or {}).get("id") or ""
        if not quotation_store.delete_quote(root, qid):
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    data = request.get_json(silent=True) or {}
    try:
        saved = quotation_store.save_quote(root, data, IMAGES_DIR)
    except ValueError as err:
        return jsonify({"ok": False, "error": str(err)}), 400
    except RuntimeError as err:
        return jsonify({"ok": False, "error": str(err)}), 500
    except PermissionError:
        return jsonify({
            "ok": False,
            "error": "PDF එක open වෙලා තියෙනවා. File එක close කරලා ආයෙත් Save කරන්න."
        }), 500
    except OSError as err:
        msg = str(err)
        if getattr(err, "errno", None) == 13 or "Permission denied" in msg or getattr(err, "winerror", None) == 5:
            return jsonify({
                "ok": False,
                "error": "PDF එක open වෙලා තියෙනවා. File එක close කරලා ආයෙත් Save කරන්න."
            }), 500
        return jsonify({"ok": False, "error": f"Folder save failed: {err}"}), 500
    return jsonify({"ok": True, "root": str(root), "item": saved})


@app.get("/api/quotation/pdf")
def api_quotation_pdf():
    root = quotes_dir()
    qid = quotation_store.safe_quote_id(request.args.get("id") or request.args.get("ref") or "")
    item = quotation_store.find_quote(root, qid)
    if not item:
        return jsonify({"ok": False, "error": "Not found"}), 404
    pdf_path = Path(item.get("pdfPath") or "")
    if not pdf_path.exists() or pdf_path.stat().st_size < 800:
        try:
            pdf_path.parent.mkdir(parents=True, exist_ok=True)
            quotation_store.write_quote_pdf(pdf_path, item, root, IMAGES_DIR)
        except Exception as err:
            return jsonify({"ok": False, "error": str(err)}), 500
    if not pdf_path.exists():
        return jsonify({"ok": False, "error": "PDF හදන්න බැරි වුණා"}), 404
    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{qid}.pdf",
        max_age=0,
    )


@app.get("/static/<path:name>")
def static_files(name):
    return send_from_directory(ROOT / "static", name)


@app.get("/images/<path:name>")
def image_files(name):
    return send_from_directory(IMAGES_DIR, name)


@app.get("/api/images")
def api_images():
    return jsonify({"images": list_images(), "required": REQUIRED})


@app.get("/api/results")
def api_results():
    key = request.args.get("key", "")
    if key != ADMIN_KEY:
        return jsonify({"error": "Invalid key"}), 403
    return jsonify({"submissions": get_all_submissions()})


@app.post("/api/submit")
def api_submit():
    body = request.get_json(silent=True) or {}
    selected = body.get("selected", [])
    if not isinstance(selected, list):
        return jsonify({"error": "Invalid selection"}), 400

    try:
        selected = sorted({int(x) for x in selected})
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid selection"}), 400

    if len(selected) != REQUIRED:
        return jsonify({"error": f"Select exactly {REQUIRED} images"}), 400

    valid_ids = {img["id"] for img in list_images()}
    if not all(i in valid_ids for i in selected):
        return jsonify({"error": "Invalid image ids"}), 400

    entry = {
        "id": str(uuid.uuid4())[:8],
        "selected": selected,
        "labels": [IMAGE_LABELS.get(i, f"Option {i}") for i in selected],
        "time": datetime.now(timezone.utc).isoformat(),
    }
    add_submission(entry)
    return jsonify({"ok": True, "message": "Thank you for participating."})


def _ensure_cloudflared():
    found = shutil.which("cloudflared")
    if found:
        return found
    local = ROOT / "tools" / "cloudflared.exe"
    if local.exists():
        return str(local)
    local.parent.mkdir(parents=True, exist_ok=True)
    url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    print("Home link tool download වෙනවා...")
    try:
        urllib.request.urlretrieve(url, local)
    except OSError as err:
        print("Home link tool download failed:", err)
        return None
    return str(local)


def _save_public_url(url: str) -> None:
    global PUBLIC_QUOTE_URL
    PUBLIC_QUOTE_URL = url.rstrip("/")
    try:
        HOME_LINK_FILE.write_text(PUBLIC_QUOTE_URL, encoding="utf-8")
    except OSError:
        pass
    quote = PUBLIC_QUOTE_URL + "/quotation"
    print()
    print("  HOME / LAPTOP (any browser tab):")
    print(f"  {quote}")
    print(f"  PIN: {QUOTE_PIN}")
    print("  Me link eka START-QUOTATION.bat close kalama change wenawa.")
    print()
    try:
        subprocess.run(["clip"], input=quote, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW)
    except Exception:
        pass


def _start_public_tunnel(port: int) -> None:
    if os.environ.get("QUOTE_TUNNEL", "1").strip() == "0":
        return
    exe = _ensure_cloudflared()
    if not exe:
        print("Home link එක start වුණේ නැහැ. Office WiFi links විතරක් වැඩ.")
        return
    try:
        proc = subprocess.Popen(
            [exe, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except OSError as err:
        print("Home link start failed:", err)
        return
    pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    assert proc.stdout is not None
    for line in proc.stdout:
        match = pattern.search(line)
        if match:
            _save_public_url(match.group(0))
            break


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Visual Research Study -> http://localhost:{port}")
    print(f"This PC tab        -> http://localhost:{port}/quotation")
    print(f"Office laptop/PC   -> http://CarSwitch:{port}/quotation")
    print(f"Office laptop/PC   -> http://192.168.1.15:{port}/quotation")
    print(f"Quotation folders  -> {quotes_dir()}")
    print("Home / outside WiFi -> link එක මේ window එකේ ටිකක් ගානෙ පේනවා")
    threading.Thread(target=_start_public_tunnel, args=(port,), daemon=True).start()
    app.run(host="0.0.0.0", port=port, threaded=True)
