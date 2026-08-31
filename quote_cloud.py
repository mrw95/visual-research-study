"""Shared quotation list for Vercel (home). Uses Upstash/Vercel KV when configured."""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime

import quotation_store

STORE_KEY = "cs-quotations-v1"


def _kv_creds():
    url = (
        os.environ.get("KV_REST_API_URL")
        or os.environ.get("UPSTASH_REDIS_REST_URL")
        or ""
    ).rstrip("/")
    token = (
        os.environ.get("KV_REST_API_TOKEN")
        or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        or ""
    )
    return url, token


def cloud_enabled():
    url, token = _kv_creds()
    return bool(url and token)


def _kv_request(path, data=None):
    url, token = _kv_creds()
    if not url or not token:
        raise RuntimeError("Cloud store is not configured")
    body = None if data is None else (data if isinstance(data, (bytes, bytearray)) else str(data).encode("utf-8"))
    req = urllib.request.Request(
        f"{url}{path}",
        data=body,
        method="POST" if body is not None else "GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as res:
        return json.loads(res.read().decode("utf-8") or "{}")


def load_items():
    raw = _kv_request(f"/get/{STORE_KEY}")
    result = raw.get("result")
    if not result:
        return []
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]
    if isinstance(result, str):
        try:
            parsed = json.loads(result)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    return []


def save_items(items):
    payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    _kv_request(f"/set/{STORE_KEY}", payload)
    return items


def next_quote_id(items):
    year = datetime.now().year
    used = set()
    for item in items:
        match = quotation_store.ID_NUM_RE.match(str(item.get("id") or ""))
        if match and int(match.group(1)) == year:
            used.add(int(match.group(2)))
    n = 1
    while n in used:
        n += 1
    return f"CS-{year}-{n:04d}"


def find_item(items, qid):
    qid = quotation_store.safe_quote_id(qid)
    if not qid:
        return None
    for item in items:
        if quotation_store.safe_quote_id(item.get("id")) == qid:
            data = dict(item)
            data["id"] = qid
            return data
    return None


def list_items(person=None):
    wanted = quotation_store.staff_name(person) if person else None
    items = load_items()
    if wanted:
        items = [
            item for item in items
            if quotation_store.staff_name(item.get("preparedByName") or item.get("person")) == wanted
        ]
    items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
    return items


def save_item(data):
    person = quotation_store.staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Prepared By name select කරන්න")
    items = load_items()
    requested = quotation_store.safe_quote_id(data.get("id"))
    existing = find_item(items, requested) if requested else None
    qid = requested if existing else next_quote_id(items)
    now = datetime.now().isoformat()
    saved = dict(data)
    saved["id"] = qid
    saved["preparedByName"] = person
    saved["designation"] = quotation_store.STAFF_ROLES[person]
    saved["person"] = person
    saved["createdAt"] = (existing or {}).get("createdAt") or saved.get("createdAt") or now
    saved["updatedAt"] = now
    quotation_store.apply_entered_prices(saved)
    next_items = [item for item in items if quotation_store.safe_quote_id(item.get("id")) != qid]
    next_items.insert(0, saved)
    save_items(next_items[:200])
    return saved


def delete_item(qid):
    qid = quotation_store.safe_quote_id(qid)
    if not qid:
        return False
    items = load_items()
    next_items = [item for item in items if quotation_store.safe_quote_id(item.get("id")) != qid]
    if len(next_items) == len(items):
        return False
    save_items(next_items)
    return True
