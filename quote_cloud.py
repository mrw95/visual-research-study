"""Shared quotation list. Uses Vercel Blob (free) or Upstash KV — not Google Sheets."""

import json
import os
from datetime import datetime
from pathlib import Path

import quotation_store

STORE_KEY = "cs-quotations-v1"
AGREE_KEY = "cs-agreements-v1"
SEQ_KEY = "cs-quote-seq-{year}"
BLOB_FILE = "cs-quote-store.json"
BLOB_API = "https://vercel.com/api/blob"
BLOB_API_LEGACY = "https://blob.vercel-storage.com"
BLOB_API_VERSION = "12"


def _load_env_files():
    root = Path(__file__).resolve().parent
    for name in (".env.local", ".env"):
        path = root / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_files()


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


def _blob_token():
    return os.environ.get("BLOB_READ_WRITE_TOKEN") or ""


def kv_enabled():
    url, token = _kv_creds()
    return bool(url and token)


def blob_enabled():
    return bool(_blob_token())


def cloud_enabled():
    return kv_enabled() or blob_enabled()


def _kv_request(path, data=None):
    import urllib.request

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


def _blob_store_id():
    env = (os.environ.get("BLOB_STORE_ID") or "").strip()
    if env.startswith("store_"):
        env = env[6:]
    if env:
        return env
    parts = _blob_token().split("_")
    if len(parts) >= 4:
        return parts[3]
    return ""


def _blob_headers(extra=None):
    headers = {
        "Authorization": f"Bearer {_blob_token()}",
        "x-api-version": BLOB_API_VERSION,
    }
    store_id = _blob_store_id()
    if store_id:
        headers["x-vercel-blob-store-id"] = store_id
    if extra:
        headers.update(extra)
    return headers


def _blob_hosts():
    return (BLOB_API, BLOB_API_LEGACY)


def _empty_pack():
    return {"seq": {}, "stores": {STORE_KEY: [], AGREE_KEY: []}}


def _parse_pack(raw):
    if not raw:
        return _empty_pack()
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8", "replace")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return _empty_pack()
    if not isinstance(raw, dict):
        return _empty_pack()
    stores = raw.get("stores")
    if not isinstance(stores, dict):
        stores = {}
    seq = raw.get("seq")
    if not isinstance(seq, dict):
        seq = {}
    return {
        "seq": {str(k): int(v or 0) for k, v in seq.items() if str(k).isdigit()},
        "stores": {
            STORE_KEY: [item for item in (stores.get(STORE_KEY) or []) if isinstance(item, dict)],
            AGREE_KEY: [item for item in (stores.get(AGREE_KEY) or []) if isinstance(item, dict)],
        },
    }


def _blob_error(err):
    import urllib.error

    if isinstance(err, urllib.error.HTTPError):
        detail = ""
        try:
            detail = err.read().decode("utf-8", "replace")[:180]
        except Exception:
            detail = ""
        return RuntimeError(f"Shared quote store failed ({err.code}): {detail}".strip())
    if isinstance(err, urllib.error.URLError):
        return RuntimeError(f"Shared quote store failed: {err.reason}")
    return RuntimeError(f"Could not use the shared quote store: {err}")


def _blob_get(url):
    import urllib.request

    req = urllib.request.Request(url, headers=_blob_headers(), method="GET")
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read()


def _load_pack():
    import urllib.error
    import urllib.parse

    if not blob_enabled():
        return _empty_pack()
    prefix = urllib.parse.quote(BLOB_FILE, safe="")
    last_err = None
    for host in _blob_hosts():
        try:
            listing = json.loads(_blob_get(f"{host}/?prefix={prefix}&limit=1") or b"{}")
            blobs = listing.get("blobs") if isinstance(listing, dict) else None
            url = ""
            if isinstance(blobs, list) and blobs:
                url = str((blobs[0] or {}).get("url") or "")
            if not url:
                return _empty_pack()
            return _parse_pack(_blob_get(url))
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return _empty_pack()
            last_err = err
        except Exception as err:
            last_err = err
    if last_err:
        raise _blob_error(last_err) from last_err
    return _empty_pack()


def _save_pack(pack):
    import urllib.parse
    import urllib.request

    if not blob_enabled():
        raise RuntimeError("Cloud store is not configured")
    body = json.dumps(pack, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    pathname = urllib.parse.quote(BLOB_FILE, safe="")
    headers = _blob_headers({
        "Content-Type": "application/json",
        "x-vercel-blob-access": "private",
        "x-content-type": "application/json",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-cache-control-max-age": "60",
    })
    last_err = None
    for host in _blob_hosts():
        req = urllib.request.Request(
            f"{host}/?pathname={pathname}",
            data=body,
            method="PUT",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                res.read()
            return pack
        except Exception as err:
            last_err = err
    raise _blob_error(last_err) from last_err


def _parse_items(raw):
    result = raw.get("result") if isinstance(raw, dict) else raw
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


def _slim(data):
    item = dict(data or {})
    item.pop("signatureImage", None)
    item.pop("vehiclePhoto", None)
    item.pop("path", None)
    item.pop("pdfPath", None)
    return item


def _used_numbers(items, year):
    used = set()
    for item in items or []:
        match = quotation_store.ID_NUM_RE.match(str(item.get("id") or ""))
        if match and int(match.group(1)) == year:
            used.add(int(match.group(2)))
    return used


def _seq_value(year):
    if blob_enabled() and not kv_enabled():
        pack = _load_pack()
        return int(pack["seq"].get(str(year), 0) or 0)
    raw = _kv_request(f"/get/{SEQ_KEY.format(year=year)}")
    result = raw.get("result") if isinstance(raw, dict) else raw
    try:
        return int(result or 0)
    except (TypeError, ValueError):
        return 0


def _seed_seq(year, floor):
    if floor <= 0:
        return
    if blob_enabled() and not kv_enabled():
        pack = _load_pack()
        current = int(pack["seq"].get(str(year), 0) or 0)
        if current < floor:
            pack["seq"][str(year)] = floor
            _save_pack(pack)
        return
    if _seq_value(year) < floor:
        _kv_request(f"/set/{SEQ_KEY.format(year=year)}", str(floor))


def load_items(key=STORE_KEY):
    if kv_enabled():
        return _parse_items(_kv_request(f"/get/{key}"))
    if blob_enabled():
        return list(_load_pack()["stores"].get(key) or [])
    return []


def save_items(items, key=STORE_KEY):
    if kv_enabled():
        payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        _kv_request(f"/set/{key}", payload)
        return items
    if not blob_enabled():
        raise RuntimeError("Cloud store is not configured")
    pack = _load_pack()
    pack["stores"][key] = [item for item in items if isinstance(item, dict)][:200]
    year = datetime.now().year
    used = max(_used_numbers(pack["stores"].get(STORE_KEY), year) or [0])
    if used > int(pack["seq"].get(str(year), 0) or 0):
        pack["seq"][str(year)] = used
    _save_pack(pack)
    return items


def next_quote_id(items, extra_used=None):
    if not cloud_enabled():
        raise RuntimeError("Cloud store is not configured")
    year = datetime.now().year
    used = _used_numbers(items, year)
    used.update(extra_used or [])
    floor = max(used) if used else 0
    if kv_enabled():
        key = SEQ_KEY.format(year=year)
        _seed_seq(year, floor)
        bumped = _kv_request(f"/incr/{key}")
        value = bumped.get("result") if isinstance(bumped, dict) else bumped
        n = int(value or (floor + 1))
        if n <= floor:
            n = floor + 1
            _kv_request(f"/set/{key}", str(n))
        return f"CS-{year}-{n:04d}"
    pack = _load_pack()
    current = max(int(pack["seq"].get(str(year), 0) or 0), floor)
    n = current + 1
    pack["seq"][str(year)] = n
    _save_pack(pack)
    return f"CS-{year}-{n:04d}"


def merge_local_items(local_items):
    if not cloud_enabled():
        return []
    items = load_items()
    seen = {quotation_store.safe_quote_id(item.get("id")) for item in items}
    added = False
    for item in local_items or []:
        if not isinstance(item, dict):
            continue
        qid = quotation_store.safe_quote_id(item.get("id"))
        if not qid or qid in seen:
            continue
        items.append(_slim(item))
        seen.add(qid)
        added = True
    if added:
        save_items(items[:200])
    year = datetime.now().year
    _seed_seq(year, max(_used_numbers(items, year) or [0]))
    return items


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
    if not cloud_enabled():
        raise RuntimeError("Cloud store is not configured")
    person = quotation_store.staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Select a Prepared By name")
    items = load_items()
    requested = quotation_store.safe_quote_id(data.get("id"))
    existing = find_item(items, requested) if requested else None
    qid = requested if requested else next_quote_id(items)
    now = datetime.now().isoformat()
    saved = dict(data)
    saved["id"] = qid
    saved["preparedByName"] = person
    saved["designation"] = quotation_store.designation_for(person, saved.get("kind"))
    saved["person"] = person
    saved["createdAt"] = (existing or {}).get("createdAt") or saved.get("createdAt") or now
    saved["updatedAt"] = now
    quotation_store.apply_entered_prices(saved)
    slim = _slim(saved)
    next_items = [item for item in items if quotation_store.safe_quote_id(item.get("id")) != qid]
    next_items.insert(0, slim)
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


def load_agreements():
    return load_items(AGREE_KEY)


def next_agreement_id(items, prefix, company="", when=""):
    import agreement_store as ag

    raw = str(prefix or "SA").upper()
    if raw == "INV":
        return ag.next_invoice_id(items, company, when)
    prefix = "PO" if raw == "PO" else "SA"
    year = datetime.now().year
    used = set()
    for item in items:
        qid = ag.safe_agreement_id(item.get("id"))
        if not qid:
            continue
        parts = qid.split("-")
        if len(parts) == 3 and parts[0] == prefix and parts[1].isdigit() and int(parts[1]) == year:
            used.add(int(parts[2]))
    n = 1
    while n in used:
        n += 1
    return f"{prefix}-{year}-{n:04d}"


def find_agreement(items, qid):
    import agreement_store as ag

    qid = ag.safe_agreement_id(qid)
    if not qid:
        return None
    for item in items:
        if ag.safe_agreement_id(item.get("id")) == qid:
            data = dict(item)
            data["id"] = qid
            return data
    return None


def list_agreements(person=None):
    wanted = quotation_store.staff_name(person) if person else None
    items = load_agreements()
    if wanted:
        items = [
            item for item in items
            if quotation_store.staff_name(item.get("preparedByName") or item.get("person")) == wanted
        ]
    items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
    return items


def save_agreement_item(data):
    import agreement_store as ag

    person = quotation_store.staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Select a Prepared By name")
    items = load_agreements()
    requested = ag.safe_agreement_id(data.get("id"))
    existing = find_agreement(items, requested) if requested else None
    kind = ag._kind_of(data)
    prefix = "INV" if kind == "invoice" else "PO" if kind == "preorder" else "SA"
    if not requested:
        if kind != "invoice":
            raise ValueError("Type the reference number")
        qid = next_agreement_id(
            items,
            "INV",
            data.get("invoiceCompany") or "",
            data.get("invoiceDate") or data.get("agreementDate") or "",
        )
    else:
        qid = requested
    now = datetime.now().isoformat()
    saved = dict(data)
    saved["id"] = qid
    saved["kind"] = kind
    saved["preparedByName"] = person
    saved["designation"] = quotation_store.designation_for(person, saved.get("kind"))
    saved["person"] = person
    saved["createdAt"] = (existing or {}).get("createdAt") or saved.get("createdAt") or now
    saved["updatedAt"] = now
    saved["make"] = str(saved.get("make") or "").strip().upper()
    saved["model"] = str(saved.get("model") or "").strip().upper()
    next_items = [item for item in items if ag.safe_agreement_id(item.get("id")) != qid]
    next_items.insert(0, saved)
    save_items(next_items[:200], AGREE_KEY)
    return saved


def delete_agreement(qid):
    import agreement_store as ag

    qid = ag.safe_agreement_id(qid)
    if not qid:
        return False
    items = load_agreements()
    next_items = [item for item in items if ag.safe_agreement_id(item.get("id")) != qid]
    if len(next_items) == len(items):
        return False
    save_items(next_items, AGREE_KEY)
    return True
