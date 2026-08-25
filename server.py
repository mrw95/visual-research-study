"""Visual Research Study — 6 images, pick exactly 3."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

import quotation_store

app = Flask(__name__)
ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
DATA_FILE = ROOT / "submissions.json"

ADMIN_KEY = os.environ.get("ADMIN_KEY", "research2026")
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


@app.route("/api/quotation", methods=["GET", "POST", "DELETE"])
def api_quotation():
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
        saved = quotation_store.save_quote(root, data)
    except ValueError as err:
        return jsonify({"ok": False, "error": str(err)}), 400
    except OSError as err:
        return jsonify({"ok": False, "error": f"Folder save failed: {err}"}), 500
    return jsonify({"ok": True, "root": str(root), "item": saved})


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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Visual Research Study -> http://localhost:{port}")
    print(f"Quotations -> http://localhost:{port}/quotation")
    print(f"Quotation folders -> {quotes_dir()}")
    app.run(host="0.0.0.0", port=port)
