import json
from http.server import BaseHTTPRequestHandler


def _send(handler, status, body):
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _send(self, 204, {"ok": True})

    def do_POST(self):
        _send(self, 503, {"ok": False, "error": "Print the page and Save as PDF", "home": True})

    def log_message(self, format, *args):
        return
