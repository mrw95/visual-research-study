import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("SKIP_CHROME_PDF", "1")
os.environ.setdefault("QUOTATION_DIR", "/tmp/cs-quotes")


def _send(handler, status, body, content_type="application/json", filename=""):
    payload = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Type", content_type)
    if filename:
        handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        _send(self, 204, b"", "text/plain")

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(data, dict):
                return _send(self, 400, {"ok": False, "error": "Invalid data"})

            import quotation_store

            person = quotation_store.staff_name(data.get("preparedByName") or data.get("person"))
            if not person:
                return _send(self, 400, {"ok": False, "error": "Prepared By name select කරන්න"})

            images = ROOT / "images"
            root = quotation_store.quotation_root(ROOT)
            quotation_store.ensure_layout(root, images)
            qid = quotation_store.safe_quote_id(data.get("id")) or "CS-QUOTE"
            data = dict(data)
            data["id"] = qid
            data["preparedByName"] = person
            data["designation"] = quotation_store.STAFF_ROLES[person]

            pdf_path = Path(tempfile.gettempdir()) / f"{qid}.pdf"
            quotation_store.write_quote_pdf(pdf_path, data, root, images)
            if not pdf_path.exists() or pdf_path.stat().st_size < 800:
                return _send(self, 500, {"ok": False, "error": "PDF හදන්න බැරි වුණා"})
            _send(self, 200, pdf_path.read_bytes(), "application/pdf", f"{qid}.pdf")
        except Exception as err:
            _send(self, 500, {"ok": False, "error": str(err)})

    def log_message(self, format, *args):
        return
