import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _send(handler, status, body):
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _query(handler):
    return parse_qs(urlparse(handler.path).query)


def _read_json(handler):
    length = int(handler.headers.get("Content-Length") or 0)
    raw = handler.rfile.read(length) if length else b"{}"
    data = json.loads(raw.decode("utf-8") or "{}")
    return data if isinstance(data, dict) else {}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _send(self, 204, {"ok": True})

    def do_GET(self):
        try:
            import quote_cloud
            if not quote_cloud.cloud_enabled():
                return _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})
            qid = (_query(self).get("id") or _query(self).get("ref") or [""])[0]
            item = quote_cloud.find_item(quote_cloud.load_items(), qid)
            if not item:
                return _send(self, 404, {"ok": False, "error": "Not found"})
            return _send(self, 200, {"ok": True, "root": "cloud", "item": item})
        except Exception as err:
            return _send(self, 500, {"ok": False, "error": str(err)})

    def do_POST(self):
        try:
            import quote_cloud
            if not quote_cloud.cloud_enabled():
                return _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})
            saved = quote_cloud.save_item(_read_json(self))
            return _send(self, 200, {"ok": True, "root": "cloud", "item": saved})
        except ValueError as err:
            return _send(self, 400, {"ok": False, "error": str(err)})
        except Exception as err:
            return _send(self, 500, {"ok": False, "error": str(err)})

    def do_DELETE(self):
        try:
            import quote_cloud
            if not quote_cloud.cloud_enabled():
                return _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})
            qid = (_query(self).get("id") or [""])[0]
            if not qid:
                qid = str(_read_json(self).get("id") or "")
            if not quote_cloud.delete_item(qid):
                return _send(self, 404, {"ok": False, "error": "Not found"})
            return _send(self, 200, {"ok": True})
        except Exception as err:
            return _send(self, 500, {"ok": False, "error": str(err)})

    def log_message(self, format, *args):
        return
