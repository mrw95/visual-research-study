"""Visual Research Study — 6 images, pick exactly 3."""

import html
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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
    if path in ("/quote-login", "/quote-unlock", "/home-link", "/phone-link") or path.startswith("/static/") or path.startswith("/images/"):
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


def _lan_ips():
    found = []

    def add(ip):
        if not ip or ip.startswith(("127.", "169.254.")):
            return
        if ip not in found:
            found.append(ip)

    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            add(info[4][0])
    except OSError:
        pass
    found.sort(key=lambda ip: (0 if ip.startswith("192.168.") else 1 if ip.startswith("10.") else 2, ip))
    return found or ["192.168.1.15"]


def _listen_port():
    env = os.environ.get("PORT")
    if env:
        try:
            return int(env)
        except ValueError:
            pass
    try:
        return int(request.environ.get("SERVER_PORT") or 8090)
    except (TypeError, ValueError, RuntimeError):
        return 8090


def _safe_quote_path(raw):
    path = str(raw or "quotation.html").strip().lstrip("/")
    if (not path) or "://" in path or path.startswith("//") or ".." in path:
        return "quotation.html"
    return path


def _join_url(base, path):
    return f"{str(base).rstrip('/')}/{_safe_quote_path(path)}"


def _public_quote_base():
    url = PUBLIC_QUOTE_URL.strip()
    if HOME_LINK_FILE.exists() and not url:
        url = HOME_LINK_FILE.read_text(encoding="utf-8").strip()
    return url.rstrip("/")


VERCEL_QUOTE_URL = "https://visual-research-study.vercel.app"


def _access_info(path="quotation.html"):
    path = _safe_quote_path(path)
    port = _listen_port()
    lan = [f"http://{ip}:{port}" for ip in _lan_ips()]
    host = socket.gethostname()
    if host and f"http://{host}:{port}" not in lan:
        lan.append(f"http://{host}:{port}")
    public = _public_quote_base()
    vercel = _join_url(VERCEL_QUOTE_URL, path)
    urls = []
    if public:
        urls.append(_join_url(public, path))
    if vercel not in urls:
        urls.append(vercel)
    urls.extend(_join_url(base, path) for base in lan)
    return {"port": port, "lan": lan, "public": public, "vercel": VERCEL_QUOTE_URL, "urls": urls, "path": path}


@app.get("/api/access-urls")
def api_access_urls():
    info = _access_info(request.args.get("path") or "quotation.html")
    info["ok"] = True
    info["pin"] = QUOTE_PIN
    return jsonify(info)


@app.get("/home-link")
@app.get("/phone-link")
def home_link_page():
    if _public_host():
        return jsonify({"error": "Not found"}), 404
    info = _access_info(request.args.get("path") or "quotation.html")
    links = "".join(
        f"<a class='phone-url' href='{html.escape(url, quote=True)}'>{html.escape(url)}</a>"
        for url in info["urls"]
    )
    pin = f"<p>Tunnel PIN: <strong>{html.escape(QUOTE_PIN)}</strong></p>" if info["public"] else ""
    first = info["urls"][0] if info["urls"] else ""
    qr = ""
    if first:
        qr = (
            "<img class='phone-qr' alt='QR' width='220' height='220' "
            f"src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&amp;data={html.escape(quote(first, safe=''), quote=True)}'>"
        )
    wait = ""
    if not info["public"]:
        wait = "<p>ගෙදරට tunnel link එක තාම ready නැහැ. START-QUOTATION.bat window එකේ මොහොතක් ඉන්න.</p>"
    return (
        "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover'>"
        "<title>Phone / Tab link</title>"
        "<link rel='stylesheet' href='/static/quotation.css?v=29'>"
        "</head><body class='quote-body login-body'>"
        "<div class='login-card phone-card'>"
        "<h1>Phone / Tab</h1>"
        "<p>Mobile data / ගෙදර: https link එක. PIN 9292. Office WiFi IP එක data වලින් වැඩ කරන්නේ නැහැ.</p>"
        f"{qr}{links}{pin}{wait}"
        "</div></body></html>"
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
        "network": str(quotation_store.NETWORK_QUOTES),
        "usingNetwork": quotation_store.using_network_share(root),
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
    return jsonify({
        "ok": True,
        "root": str(root),
        "usingNetwork": quotation_store.using_network_share(root),
        "item": saved
    })


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


def _open_lan_port(port: int) -> None:
    name = f"CarSwitch Quotations {port}"
    hidden = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        subprocess.run(
            ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={name}"],
            capture_output=True,
            creationflags=hidden,
        )
        result = subprocess.run(
            [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={name}", "dir=in", "action=allow", "protocol=TCP",
                f"localport={port}", "profile=any",
            ],
            capture_output=True,
            text=True,
            creationflags=hidden,
        )
        if result.returncode == 0:
            print(f"Phone/tab LAN: Windows Firewall port {port} open.")
        else:
            print("Phone/tab LAN: Firewall rule add වුණේ නැහැ. START-QUOTATION.bat Run as administrator කරන්න.")
    except OSError:
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
    print("PHONE / TAB (same WiFi) - localhost phone eken open WENNE NA:")
    for ip in _lan_ips():
        print(f"  http://{ip}:{port}/quotation.html")
    print(f"  QR / copy: http://localhost:{port}/phone-link")
    print(f"Quotation folders  -> {quotes_dir()}")
    print("Home / mobile data -> tunnel link eka me window eke tikak gane penawa")
    _open_lan_port(port)
    threading.Thread(target=_start_public_tunnel, args=(port,), daemon=True).start()
    app.run(host="0.0.0.0", port=port, threaded=True)
