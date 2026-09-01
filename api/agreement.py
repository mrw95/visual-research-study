import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

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


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _send(self, 204, {"ok": True})

    def do_GET(self):
        _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})

    def do_POST(self):
        _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})

    def do_DELETE(self):
        _send(self, 503, {"ok": False, "error": "Home browser save", "home": True})

    def log_message(self, format, *args):
        return
