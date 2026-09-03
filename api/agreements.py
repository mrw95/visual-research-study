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
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _send(self, 204, {"ok": True})

    def do_GET(self):
        try:
            import quotation_store
            import quote_cloud
            if not quote_cloud.cloud_enabled():
                return _send(self, 503, {"ok": False, "error": "Home browser save", "home": True, "items": []})
            person = (parse_qs(urlparse(self.path).query).get("person") or [""])[0]
            return _send(self, 200, {
                "ok": True,
                "root": "cloud",
                "home": True,
                "staff": quotation_store.STAFF,
                "items": quote_cloud.list_agreements(person),
            })
        except Exception as err:
            return _send(self, 500, {"ok": False, "error": str(err)})

    def log_message(self, format, *args):
        return
