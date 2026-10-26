import base64
import html
import io
import json
import os
import re
from datetime import datetime
from pathlib import Path

import quotation_store as qs

STAFF = qs.STAFF
STAFF_ROLES = qs.STAFF_ROLES
NETWORK_AGREEMENTS = Path(r"\\Carswitch\CarSwitch Document\Related Documents\CarSwitch\Invoice & Agreement")
NETWORK_SALES = NETWORK_AGREEMENTS / "Sales Agreement"
NETWORK_PREORDER = NETWORK_AGREEMENTS / "Pre-Order Agreement"
NETWORK_INVOICE_ROOTS = {
    "Carswitch": Path(r"\\Carswitch\CarSwitch Document\Related Documents\CarSwitch\Invoice"),
    "Genx Importanters": Path(r"\\Carswitch\CarSwitch Document\Related Documents\Genx Imp\Invoice"),
}
ID_RE = re.compile(r"^(SA|PO|INV)-\d{4}-\d{4}$")
DATA_DIR = "_data"

TEXT_KEYS = (
    "customerId", "customerName", "address", "telephone", "nic",
    "makeModel", "registrationNr", "chassisNr", "year", "colour",
    "trim", "mileage", "auctionGrade", "deliveryWeeks", "exchangeRate",
    "transfereeName", "transfereeNic", "warrantyYears", "warrantyMonths",
    "warranty", "docMta2", "docVrc", "docMta6", "docInsurance", "docEmission", "docRevenue",
    "payBeforeShipment", "payAfterBl", "kind", "invoiceCompany",
    "make", "model", "engineNr", "engineCapacity", "country", "invoiceDate",
    "loanBillTo",
)
MONEY_KEYS = (
    "agreedAmount", "advanceAmount", "advancePaid", "secondPaid", "thirdPaid", "finalPaid",
    "vehicleCost", "vehiclePaid", "importCharges", "importPaid", "otherCharges", "otherPaid",
    "vehiclePrice", "vehiclePriceTotal",
    "japanCostLkr", "customsDuty", "clearingCharges", "agencyFee", "totalEstimatedPrice",
    "additionalFee", "additionalPaid", "registrationFee", "registrationPaid",
    "valuationFee", "valuationPaid", "salesTax", "salesTaxPaid",
    "totalAmount", "totalPaid", "balancePayment",
    "loanAmount",
)


def agreement_root(project_root: Path, company: str = "") -> Path:
    env = os.environ.get("AGREEMENT_DIR")
    base = Path(project_root)
    company = str(company or "").strip()
    preferred = []
    if company in NETWORK_INVOICE_ROOTS:
        preferred.append(NETWORK_INVOICE_ROOTS[company])
    preferred.extend([Path(env) if env else None, NETWORK_AGREEMENTS, base / "agreements"])
    for candidate in preferred:
        if candidate is None:
            continue
        if qs._writable(candidate):
            return candidate
    fallback = project_root / "agreements"
    if company:
        fallback = project_root / "agreements" / company.replace(" ", "-")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def agreement_kind_root(project_root: Path, kind: str) -> Path:
    folder_name = "Pre-Order Agreement" if str(kind or "").lower() == "preorder" else "Sales Agreement"
    local = Path(project_root) / "agreements" / folder_name
    target = NETWORK_PREORDER if folder_name.startswith("Pre-") else NETWORK_SALES
    for candidate in (target, local):
        if qs._writable(candidate):
            return candidate
    local.mkdir(parents=True, exist_ok=True)
    return local


def invoice_roots(project_root: Path) -> list[Path]:
    roots = []
    seen = set()
    for company, path in NETWORK_INVOICE_ROOTS.items():
        if qs._writable(path):
            key = str(path).lower()
            if key not in seen:
                roots.append(path)
                seen.add(key)
        else:
            local = project_root / "agreements" / company.replace(" ", "-")
            local.mkdir(parents=True, exist_ok=True)
            key = str(local).lower()
            if key not in seen:
                roots.append(local)
                seen.add(key)
    for kind in ("sales", "preorder"):
        path = agreement_kind_root(project_root, kind)
        key = str(path).lower()
        if key not in seen:
            roots.append(path)
            seen.add(key)
    agree = agreement_root(project_root)
    key = str(agree).lower()
    if key not in seen:
        roots.append(agree)
    return roots


def ensure_layout(root: Path, images_dir: Path) -> None:
    for name in STAFF:
        (root / name).mkdir(parents=True, exist_ok=True)
        (root / DATA_DIR / name).mkdir(parents=True, exist_ok=True)
    (root / DATA_DIR).mkdir(exist_ok=True)
    qs._hide_windows(root / DATA_DIR)
    qs.ensure_layout(root, images_dir)


INV_MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")


def safe_agreement_id(raw: str) -> str:
    qid = str(raw or "").strip().upper()
    if not qid or len(qid) > 40:
        return ""
    if re.search(r'[<>:"\\|?*\x00-\x1f]', qid):
        return ""
    return qid


def _invoice_when(raw: str):
    text = str(raw or "").strip()
    if text:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(text[:10], fmt)
            except ValueError:
                continue
    return datetime.now()


def invoice_seq_parts(qid: str):
    parts = str(qid or "").upper().split("-")
    if not parts or parts[0] != "INV" or len(parts) < 3 or not parts[1].isdigit():
        return None
    year = int(parts[1])
    if len(parts) == 3 and parts[2].isdigit():
        return year, int(parts[2])
    if len(parts) >= 4 and parts[2] in INV_MONTHS and parts[3].isdigit():
        return year, int(parts[3])
    return None


def invoice_company_match(item_company: str, company: str) -> bool:
    name = str(item_company or "").strip()
    wanted = str(company or "").strip()
    if wanted == "Genx Importanters":
        return name == "Genx Importanters"
    if not name:
        return wanted in ("", "Carswitch")
    return name == wanted or (wanted == "Carswitch" and name == "Carswitch")


def next_invoice_id(items, company: str = "", when: str = "") -> str:
    dt = _invoice_when(when)
    year = dt.year
    mon = INV_MONTHS[dt.month - 1]
    used = set()
    for item in items or []:
        if not invoice_company_match((item or {}).get("invoiceCompany"), company):
            continue
        parsed = invoice_seq_parts(safe_agreement_id((item or {}).get("id")))
        if not parsed:
            continue
        # Keep a single running sequence for the company (do not refill gaps).
        if parsed[0] == year or parsed[0] == year - 1:
            used.add(parsed[1])
    n = (max(used) + 1) if used else 1
    return f"INV-{year}-{mon}-{n:04d}"


def next_agreement_id(root: Path, prefix: str = "SA") -> str:
    raise ValueError("Type the reference number")


def pdf_path_for(root: Path, person: str, qid: str) -> Path:
    nested = root / person / qid / f"{qid}.pdf"
    if nested.exists():
        return nested
    flat = root / person / f"{qid}.pdf"
    if flat.exists():
        return flat
    return nested


def find_agreement(root: Path, qid: str):
    qid = safe_agreement_id(qid)
    if not qid:
        return None
    for name in STAFF:
        for path in (root / DATA_DIR / name / f"{qid}.json", root / name / f"{qid}.json"):
            if not path.exists():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            data["id"] = qid
            data["person"] = name
            data["path"] = str(path)
            data["pdfPath"] = str(pdf_path_for(root, name, qid))
            return data
    return None


def list_agreements(root: Path, person=None):
    wanted = qs.staff_name(person) if person else None
    items = []
    names = [wanted] if wanted else STAFF
    for name in names:
        seen = set()
        for folder in (root / DATA_DIR / name, root / name):
            if not folder.exists():
                continue
            for path in list(folder.glob("*.json")):
                if not path.is_file():
                    continue
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue
                canon = safe_agreement_id(data.get("id") or path.stem)
                if not canon or canon in seen:
                    continue
                data["id"] = canon
                data["person"] = name
                data["path"] = str(path)
                data["pdfPath"] = str(pdf_path_for(root, name, canon))
                items.append(data)
                seen.add(canon)
    items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
    return items


def _v(data, key, fallback=""):
    return html.escape(str(data.get(key) or fallback).strip())


def _draw_ordinal_date(c, right, y, raw, font, size) -> None:
    text = _pretty_date(raw)
    match = re.match(r"(\d+)(st|nd|rd|th)(.*)$", text)
    if not match:
        c.drawRightString(right, y, f"Date: {text}")
        return
    day, suf, rest = match.group(1), match.group(2), match.group(3)
    label = "Date: " + day
    suf_size = max(6, size * 0.62)
    w_label = c.stringWidth(label, font, size)
    w_suf = c.stringWidth(suf, font, suf_size)
    w_rest = c.stringWidth(rest, font, size)
    x = right - (w_label + w_suf + w_rest)
    c.setFont(font, size)
    c.drawString(x, y, label)
    c.setFont(font, suf_size)
    c.drawString(x + w_label, y + size * 0.38, suf)
    c.setFont(font, size)
    c.drawString(x + w_label + w_suf, y, rest)


def _pretty_date(raw: str) -> str:
    text = str(raw or "").strip()
    try:
        d = datetime.strptime(text[:10], "%Y-%m-%d")
    except ValueError:
        return text
    day = d.day
    if 10 <= day % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suf} {d.strftime('%B %Y')}"


def agreement_html(data: dict, header_uri: str = "", footer_uri: str = "") -> str:
    def money(key):
        return _v(data, key)

    def yn(key):
        return _v(data, key) or "—"

    sign_buyer = qs._signature_src({"signatureImage": data.get("buyerSignature")})
    sign_seller = qs._signature_src(data)
    buyer_html = f'<img class="sign-img" src="{sign_buyer}" alt="Buyer">' if sign_buyer else '<div class="sign-line"></div>'
    seller_html = f'<img class="sign-img" src="{sign_seller}" alt="Seller">' if sign_seller else '<div class="sign-line"></div>'
    head = header_uri or "../_letterhead/cs-header.jpg"
    foot = footer_uri or "../_letterhead/cs-footer.jpg"
    pretty = _pretty_date(_v(data, "agreementDate"))
    intro = (
        f'This agreement (“Agreement”) is entered into on this {pretty} between the undersigned Buyer '
        "and the Seller (CarSwitch (Pvt) Ltd), collectively referred to as the “Parties.”"
    )
    warranty = _v(data, "warranty") or "No"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{_v(data, "id")} — Sales Agreement</title>
  <style>
    @page {{ size: A4; margin: 0; }}
    html, body {{ margin: 0; background: #fff; color: #111; font-family: "Times New Roman", Times, serif; }}
    .sheet {{ width: 210mm; min-height: 297mm; }}
    .head, .foot {{ width: 100%; display: block; }}
    .head {{ max-height: 28mm; object-fit: contain; object-position: top left; }}
    .foot {{ max-height: 22mm; object-fit: contain; object-position: bottom left; }}
    .inner {{ padding: 4mm 14mm 8mm; }}
    h2 {{ text-align: left; font-size: 22px; margin: 0; }}
    .meta {{ text-align: right; font-size: 12px; font-weight: 700; }}
    .dochead {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }}
    .bar {{ background: #ec7c30; border: 1px solid #111; padding: 4px 8px; font-weight: 800; margin-top: 8px; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 6px; }}
    th, td {{ border: 1px solid #111; padding: 4px 7px; font-size: 11px; text-align: left; }}
    .amt {{ text-align: right; width: 22%; }}
    p {{ font-size: 11px; line-height: 1.4; margin: 6px 0; }}
    .signs {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 14px; }}
    .sign-line {{ border-bottom: 1px solid #111; height: 36px; }}
    .sign-img {{ height: 42px; }}
    h3 {{ margin: 12px 0 4px; font-size: 13px; border-bottom: 1px solid #111; }}
  </style>
</head>
<body>
  <div class="sheet">
    <img class="head" src="{head}" alt="">
    <div class="inner">
      <div class="dochead">
        <h2>Sales Agreement</h2>
        <div class="meta">
          <div>Agreement Ref No: {_v(data, "id")}</div>
          <div>Date: {pretty}</div>
        </div>
      </div>
      <p>{intro}</p>
      <div class="bar">Customer/Buyer Details</div>
      <table>
        <tr><th>Customer ID</th><td>:</td><td>{_v(data, "customerId")}</td></tr>
        <tr><th>Name</th><td>:</td><td>{_v(data, "customerName")}</td></tr>
        <tr><th>Address</th><td>:</td><td>{_v(data, "address")}</td></tr>
        <tr><th>Telephone Nr</th><td>:</td><td>{_v(data, "telephone")}</td></tr>
        <tr><th>NIC Nr</th><td>:</td><td>{_v(data, "nic")}</td></tr>
      </table>
      <div class="bar">Vehicle Details</div>
      <table>
        <tr><th>Make &amp; Model</th><td>:</td><td>{_v(data, "makeModel")}</td></tr>
        <tr><th>Vehicle Registration Nr</th><td>:</td><td>{_v(data, "registrationNr")}</td></tr>
        <tr><th>Chassis Nr</th><td>:</td><td>{_v(data, "chassisNr")}</td></tr>
        <tr><th>Manufact. Year</th><td>:</td><td>{_v(data, "year")}</td></tr>
      </table>
      <table>
        <tr><th class="bar">Transaction Details</th><th class="amt">Amount</th><th class="amt">Paid</th></tr>
        <tr><th>Agreed Amount</th><td class="amt">{money("agreedAmount")}</td><td class="amt"></td></tr>
        <tr><th>Advance Payment (1st)</th><td class="amt"></td><td class="amt">{money("advancePaid")}</td></tr>
        <tr><th>2nd Installment</th><td class="amt"></td><td class="amt">{money("secondPaid")}</td></tr>
        <tr><th>3rd Installment</th><td class="amt"></td><td class="amt">{money("thirdPaid")}</td></tr>
        <tr><th>Final Installment</th><td class="amt"></td><td class="amt">{money("finalPaid")}</td></tr>
        <tr><th>Additional Fee</th><td class="amt">{money("additionalFee")}</td><td class="amt">{money("additionalPaid")}</td></tr>
        <tr><th>Registration Fee</th><td class="amt">{money("registrationFee")}</td><td class="amt">{money("registrationPaid")}</td></tr>
        <tr><th>Valuation Fee</th><td class="amt">{money("valuationFee")}</td><td class="amt">{money("valuationPaid")}</td></tr>
        <tr><th>Sales Tax</th><td class="amt">{money("salesTax")}</td><td class="amt">{money("salesTaxPaid")}</td></tr>
        <tr><th>Total Amount</th><td class="amt">{money("totalAmount")}</td><td class="amt">{money("totalPaid")}</td></tr>
      </table>
      <p><strong>Note:</strong> Refer to Annexure 1, 2 &amp; 3 for the full terms and conditions mutually agreed upon by both Parties (the Customer and CarSwitch (Pvt) Ltd).</p>
      <p>I hereby confirm that the information provided above, including the vehicle and payment details, is accurate to the best of my knowledge. I further acknowledge that I have read, understood, and agreed to the terms and conditions as outlined herein and in Annexure 1, 2 &amp; 3.</p>
      <div class="signs">
        <div>
          <div>Customer’s Signature (Buyer)</div>
          {buyer_html}
          <div>NIC Number</div>
          <div>{_v(data, "buyerSignNic")}</div>
        </div>
        <div>
          <div>CarSwitch Pvt Ltd (Seller)</div>
          <div>{_v(data, "preparedByName")}</div>
          {seller_html}
          <div>Designation</div>
          <div>{_v(data, "designation")}</div>
        </div>
        <div>
          <div>Witnesses (For Buyer)</div>
          {_sign_html(data, "buyerWitness")}
          <div>NIC Number</div>
          <div>{_v(data, "buyerWitnessNic")}</div>
        </div>
        <div>
          <div>Witnesses (For Seller)</div>
          {_sign_html(data, "sellerWitness")}
          <div>Designation</div>
          <div>{_v(data, "sellerWitnessRole")}</div>
        </div>
      </div>
      <h3>Annexure 1</h3>
      <p>Applicable Terms and Conditions under this Sales Agreement.</p>
      <p><strong>Purchase Price:</strong> The Buyer hereby agrees to purchase the aforementioned vehicle from the Seller for a total consideration in Sri Lankan Rupees, as stated above. The full purchase price has been paid in advance of this Agreement’s execution.</p>
      <p><strong>Payment Confirmation:</strong> The Seller acknowledges that the full payment has been received from the Buyer via bank transfer or an equivalent secure method of payment.</p>
      <p><strong>Vehicle Condition and Warranty:</strong> The Vehicle is sold on an “as-is” basis. Warranty: {warranty}. Validity: {_v(data, "warrantyYears")} Years {_v(data, "warrantyMonths")} Months from the date of this delivery/Agreement, whichever is the earliest, if applicable.</p>
      <p><strong>Transfer of Ownership</strong> (If the vehicle is already registered in Sri Lanka): Ownership shall pass to the Buyer upon execution of this Agreement. Both Parties agree to complete all required vehicle ownership transfer documentation in accordance with the applicable regulations of the Department of Motor Traffic.</p>
      <p><strong>Registration of Ownership</strong> (If the vehicle is unregistered in Sri Lanka): In cases where the Vehicle is not yet registered in Sri Lanka, the registration shall be completed under the Buyer’s name (unless otherwise specified in Annexure 2 below) upon execution of this Agreement. Both Parties agree to fully cooperate in completing the registration process and all necessary documentation.</p>
      <p><strong>Delivery:</strong> The Vehicle, including all tools, accessories, keys, and applicable documentation, has been physically handed over to the Buyer in good condition as of the date of this Agreement.</p>
      <p><strong>Default:</strong> In the event of default by either party, the non-defaulting party may pursue legal remedies to enforce the terms of this Agreement.</p>
      <h3>Annexure 2</h3>
      <p>If the Vehicle is to be registered or transferred under a party other than the Buyer, the following details shall apply:</p>
      <table>
        <tr><th>Name of the Registered/Transferee Party</th><td>:</td><td>{_v(data, "transfereeName")}</td></tr>
        <tr><th>National Identity Card (NIC) Number</th><td>:</td><td>{_v(data, "transfereeNic")}</td></tr>
      </table>
      <h3>Annexure 3</h3>
      <p>CarSwitch (Pvt) Ltd hereby confirms that it has provided all essential documents and information to the Buyer to facilitate the prompt and efficient completion of the vehicle ownership transfer and registration process.</p>
      <table>
        <tr><td>Ownership Registration Form (MTA-2) with Signature</td><td>{yn("docMta2")}</td></tr>
        <tr><td>Original Vehicle Registration Certificate</td><td>{yn("docVrc")}</td></tr>
        <tr><td>Ownership Transfer Form (MTA-6) with Signature</td><td>{yn("docMta6")}</td></tr>
        <tr><td>Valid Insurance Certificate</td><td>{yn("docInsurance")}</td></tr>
        <tr><td>Vehicle Emission Test Certificate</td><td>{yn("docEmission")}</td></tr>
        <tr><td>Revenue License</td><td>{yn("docRevenue")}</td></tr>
      </table>
      <p>This declaration affirms that all relevant documents required for the legal and administrative transfer of vehicle ownership have been duly submitted, subject to the indicated responses.</p>
    </div>
    <img class="foot" src="{foot}" alt="">
  </div>
</body>
    </html>"""


def _kind_of(data: dict) -> str:
    kind = str(data.get("kind") or "").lower()
    raw_id = str(data.get("id") or "").upper()
    if kind == "invoice" or raw_id.startswith("INV"):
        return "invoice"
    if kind == "preorder" or raw_id.startswith("PO"):
        return "preorder"
    return "sales"


def _sign_html(data: dict, key: str, fallback_key: str = "") -> str:
    src = qs._signature_src({"signatureImage": data.get(key) or (data.get(fallback_key) if fallback_key else "")})
    return f'<img class="sign-img" src="{src}" alt="">' if src else '<div class="sign-line"></div>'


def preorder_html(data: dict, header_uri: str = "", footer_uri: str = "") -> str:
    def money(key):
        return _v(data, key)

    head = header_uri or "../_letterhead/cs-header.jpg"
    foot = footer_uri or "../_letterhead/cs-footer.jpg"
    pretty = _pretty_date(_v(data, "agreementDate"))
    rate = _v(data, "exchangeRate", "2.17")
    weeks = _v(data, "deliveryWeeks", "10")
    intro = (
        f'This agreement (“Agreement”) is entered into on this {pretty}, between the undersigned Buyer '
        "and the Seller/Facilitator (CarSwitch (Pvt) Ltd), collectively referred to as the “Parties.” "
        "IN CONSIDERATION of the mutual promises and other valuable consideration exchanged by the Parties "
        "as set forth herein, the Parties, intending to be legally bound, hereby agree as follows:"
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{_v(data, "id")} — Pre-Order Agreement</title>
  <style>
    @page {{ size: A4; margin: 0; }}
    html, body {{ margin: 0; background: #fff; color: #111; font-family: "Times New Roman", Times, serif; }}
    .sheet {{ width: 210mm; min-height: 297mm; }}
    .head, .foot {{ width: 100%; display: block; }}
    .head {{ max-height: 28mm; object-fit: contain; object-position: top left; }}
    .foot {{ max-height: 22mm; object-fit: contain; object-position: bottom left; }}
    .inner {{ padding: 4mm 14mm 8mm; }}
    h2 {{ font-size: 20px; margin: 0; }}
    .meta {{ text-align: right; font-size: 12px; font-weight: 700; }}
    .dochead {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }}
    .bar {{ background: #ec7c30; border: 1px solid #111; padding: 4px 8px; font-weight: 800; margin-top: 8px; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 6px; }}
    th, td {{ border: 1px solid #111; padding: 4px 7px; font-size: 11px; text-align: left; }}
    .amt {{ text-align: right; width: 22%; }}
    p {{ font-size: 11px; line-height: 1.4; margin: 6px 0; }}
    ul {{ font-size: 11px; margin: 4px 0 8px 18px; }}
    .signs {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 14px; }}
    .sign-line {{ border-bottom: 1px solid #111; height: 36px; }}
    .sign-img {{ height: 42px; }}
    h3 {{ margin: 12px 0 4px; font-size: 13px; border-bottom: 1px solid #111; }}
  </style>
</head>
<body>
  <div class="sheet">
    <img class="head" src="{head}" alt="">
    <div class="inner">
      <div class="dochead">
        <h2>Sales Agreement – Pre-Order Vehicle</h2>
        <div class="meta">
          <div>Agreement Ref No: {_v(data, "id")}</div>
          <div>Date: {pretty}</div>
        </div>
      </div>
      <p>{intro}</p>
      <div class="bar">Customer/Buyer Details</div>
      <p>This Agreement governs the pre-order and import of a vehicle from Japan or another designated country by the Company on behalf of the Customer. Facilitator desires to sell the vehicle described below, known herein as the “Acquired Vehicle”, under the terms and conditions set forth below;</p>
      <table>
        <tr><th>Customer ID</th><td>:</td><td>{_v(data, "customerId")}</td></tr>
        <tr><th>Full Name</th><td>:</td><td>{_v(data, "customerName")}</td></tr>
        <tr><th>Address</th><td>:</td><td>{_v(data, "address")}</td></tr>
        <tr><th>Telephone Nr</th><td>:</td><td>{_v(data, "telephone")}</td></tr>
        <tr><th>NIC Nr</th><td>:</td><td>{_v(data, "nic")}</td></tr>
      </table>
      <div class="bar">Acquired Vehicle Details (to be confirmed prior to final procurement)</div>
      <table>
        <tr><th>Make &amp; Model</th><td>:</td><td>{_v(data, "makeModel")}</td></tr>
        <tr><th>Manufactured Year</th><td>:</td><td>{_v(data, "year")}</td></tr>
        <tr><th>Color</th><td>:</td><td>{_v(data, "colour")}</td></tr>
        <tr><th>Trim / Mileage / Auction Grade</th><td>:</td><td>{_v(data, "trim")} / {_v(data, "mileage")} / {_v(data, "auctionGrade")}</td></tr>
      </table>
      <table>
        <tr><th class="bar" colspan="2">Cost Summary</th></tr>
        <tr><th>Total Japan Cost - LKR</th><td class="amt">{money("japanCostLkr")}</td></tr>
        <tr><th>Customs Duty - LKR</th><td class="amt">{money("customsDuty")}</td></tr>
        <tr><th>Customs Clearing &amp; Other Charges - LKR</th><td class="amt">{money("clearingCharges")}</td></tr>
        <tr><th>Agency Fee - LKR</th><td class="amt">{money("agencyFee")}</td></tr>
        <tr><th>Total Up to Hand – LKR (Estimated Amount)</th><td class="amt">{money("totalEstimatedPrice")}</td></tr>
      </table>
      <p><strong>Total Japan Cost – LKR.</strong> Total cost incurred in Japan for the purchase, export processing and shipment preparation of the vehicle.</p>
      <p><strong>Customs Duty – LKR.</strong> Applicable Customs Duty and government taxes payable upon the arrival of the vehicle in Sri Lanka.</p>
      <p><strong>Customs Clearing &amp; Other Charges – LKR.</strong> Charges related to customs clearance, port handling and other applicable clearance expenses.</p>
      <p><strong>Agency Fee – LKR.</strong> Fee charged for the agency/facilitation services provided in connection with the vehicle import process.</p>
      <p><strong>Total Up to Hand – LKR.</strong> Total amount payable up to the point of handing over the vehicle to the Customer, including the above applicable costs and charges.</p>
      <p><strong>Note:</strong> The final total price is subject to revision based on:</p>
      <ul>
        <li>Changes in Sri Lankan government tax and VAT initiatives</li>
        <li>Fluctuations in the LKR/JPY exchange rate from the rate mentioned above</li>
      </ul>
      <p>The facilitator raises a Performa invoice towards the advance payment made by the Customer. The Customer consents to complete all payment formalities as mentioned above, and failure to do so without reasonable grounds will result in additional charges, which should be borne by the Customer.</p>
      <p><strong>Delivery Terms:</strong> Within {weeks} weeks from the Company’s overseas purchase</p>
      <p><strong>Note:</strong> Refer to Annexure 1 &amp; 2 for the full terms and conditions mutually agreed upon by both Parties (the Customer and CarSwitch (Pvt) Ltd).</p>
      <p>This Agreement sets forth the entire Agreement between the parties in respect of the subject matter hereof and supersedes and cancels any and all previous agreements, negotiations, commitments and writings in respect of the subject matter thereof.</p>
      <p>IN WITNESS WHEREOF, the parties hereto have caused their respective Signatures hereunto, in the presence of two others of the same tenor and date first above written.</p>
      <div class="signs">
        <div>
          <div>Customer’s Signature (Buyer)</div>
          {_sign_html(data, "buyerSignature")}
          <div>NIC Number</div>
          <div>{_v(data, "buyerSignNic")}</div>
        </div>
        <div>
          <div>CarSwitch Pvt Ltd (Seller)</div>
          <div>{_v(data, "preparedByName")}</div>
          {_sign_html(data, "signatureImage")}
          <div>Designation</div>
          <div>{_v(data, "designation")}</div>
        </div>
        <div>
          <div>Witnesses (For Buyer)</div>
          {_sign_html(data, "buyerWitness")}
          <div>NIC Number</div>
          <div>{_v(data, "buyerWitnessNic")}</div>
        </div>
        <div>
          <div>Witnesses (For Seller)</div>
          {_sign_html(data, "sellerWitness")}
          <div>Designation</div>
          <div>{_v(data, "sellerWitnessRole")}</div>
        </div>
      </div>
      <h3>Annexure 1</h3>
      <p>Applicable Terms and Conditions under this Sales Agreement – Pre-Order Vehicle.</p>
      <p><strong>Import and Handover:</strong> The Company will act as a procurement and logistics agent only. Vehicle clearance and first registration will be executed in the Customer’s name or the party designated in writing. Delivery will be at the CarSwitch premises or at a mutually agreed location, post Customs clearance.</p>
      <p><strong>Warranty and Vehicle Condition.</strong> Brand new vehicles will carry the manufacturer's warranty (if applicable in Sri Lanka). Reconditioned vehicles are imported “as is”, with no additional warranty by the Company unless specified. The Customer acknowledges that the Company is not liable for minor cosmetic defects inherent to international shipping.</p>
      <p><strong>Taxes and Government Charges.</strong> Ownership shall pass to the Buyer upon execution of this Agreement. Both Parties agree to complete all required vehicle ownership transfer documentation in accordance with the applicable regulations of the Department of Motor Traffic.</p>
      <p><strong>Exchange Rate Risk and Adjustments.</strong> Prices are based on the exchange rate of 1 LKR = {rate} JPY at the time of this agreement. Any fluctuations in currency value at the time of settlement or clearance shall be borne by the Customer.</p>
      <p><strong>Cancellation Policy.</strong> Cancellation After to Company’s overseas purchase: Pre-order advance is non-refundable. If the Company fails to procure or ship the vehicle within 60 days from the agreed deadline (except for Force Majeure and governmental initiatives), the Customer may cancel and receive a refund of the advance paid.</p>
      <p><strong>Governing Law and Jurisdiction.</strong> This Agreement shall be governed by the laws of the Democratic Socialist Republic of Sri Lanka, and any disputes shall be subject to the jurisdiction of the courts of Colombo.</p>
      <p><strong>Delivery.</strong> The Vehicle, including all tools, accessories, keys, and applicable documentation, shall be physically handed over to the Buyer in good condition on the actual date of delivery of the Vehicle.</p>
      <p><strong>Default.</strong> In the event of default by either party, the non-defaulting party may pursue legal remedies to enforce the terms of this Agreement.</p>
      <h3>Annexure 2</h3>
      <p>If the Vehicle is to be registered or transferred under a party other than the Customer, the following details shall apply:</p>
      <table>
        <tr><th>Name of the Registered/Transferee Party</th><td>:</td><td>{_v(data, "transfereeName")}</td></tr>
        <tr><th>National Identity Card (NIC) Number</th><td>:</td><td>{_v(data, "transfereeNic")}</td></tr>
      </table>
      <p><strong>Account Details</strong><br>CarSwitch (Pvt Ltd) Commercial Bank<br>New Town, Anuradhapura<br>Account Number: 1000902264</p>
    </div>
    <img class="foot" src="{foot}" alt="">
  </div>
</body>
</html>"""


def _nl(text: str) -> str:
    return html.escape(str(text or "").strip()).replace("\n", "<br>")


def _invoice_pay(data: dict) -> tuple[str, str, str]:
    price = _plain(data, "vehiclePrice") or _plain(data, "vehiclePriceTotal")
    advance = _plain(data, "advanceAmount")
    balance = _plain(data, "balancePayment")

    def from_lines(*names: str) -> str:
        for line in data.get("lines") or []:
            desc = str((line or {}).get("description") or "").strip().lower()
            if any(name in desc for name in names):
                return str((line or {}).get("total") or (line or {}).get("price") or "").strip()
        return ""

    if not price:
        price = from_lines("price", "full")
    if not advance:
        advance = from_lines("advance", "advanced")
    if not balance:
        balance = from_lines("balance")
    lines = [line for line in (data.get("lines") or []) if isinstance(line, dict)]
    if not price and lines:
        price = str(lines[0].get("total") or lines[0].get("price") or "").strip()
    if not advance and len(lines) > 1:
        advance = str(lines[1].get("price") or lines[1].get("total") or "").strip()
    if not balance and len(lines) > 2:
        balance = str(lines[2].get("total") or lines[2].get("price") or "").strip()
    return price, advance, balance


def invoice_html(data: dict, header_uri: str = "", footer_uri: str = "") -> str:
    head = header_uri or "../_letterhead/cs-header.jpg"
    foot = footer_uri or "../_letterhead/cs-footer.jpg"
    pretty = _pretty_date(_v(data, "invoiceDate") or _v(data, "agreementDate"))
    rows = []
    for line in data.get("lines") or []:
        desc = str((line or {}).get("description") or "").strip()
        qty = str((line or {}).get("qty") or "").strip()
        price = str((line or {}).get("price") or "").strip()
        total = str((line or {}).get("total") or "").strip()
        if not (desc or price or total):
            continue
        rows.append(
            f"<tr><td>{html.escape(desc)}</td><td class='qty'>{html.escape(qty)}</td>"
            f"<td class='amt'>{html.escape(price)}</td><td class='amt'>{html.escape(total)}</td></tr>"
        )
    if not rows:
        rows.append("<tr><td>&nbsp;</td><td class='qty'></td><td class='amt'></td><td class='amt'></td></tr>")
    lines_html = "\n".join(rows)
    total_label = html.escape(_plain(data, "totalLabel") or "TOTAL AMOUNT")
    total_amt = html.escape(_plain(data, "totalAmount") or _plain(data, "balancePayment"))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{_v(data, "id")} — Invoice</title>
  <style>
    @page {{ size: A4; margin: 0; }}
    html, body {{
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      background: #fff;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .sheet {{
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
    }}
    .head, .foot {{
      width: 100%;
      display: block;
      flex: 0 0 auto;
    }}
    .head {{
      max-height: 26mm;
      object-fit: contain;
      object-position: top left;
    }}
    .foot {{
      width: 100%;
      height: auto;
      object-fit: contain;
      object-position: bottom center;
      margin-top: auto;
    }}
    .inner {{
      flex: 1 1 auto;
      min-height: 0;
      padding: 3mm 12mm 32mm;
    }}
    h2 {{ color: #084083; font-size: 22px; letter-spacing: 0.12em; margin: 0; }}
    .meta {{ text-align: right; font-size: 11px; font-weight: 700; }}
    .dochead {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }}
    .split {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0 10px; }}
    .label {{ color: #535353; font-size: 13px; margin: 0 0 4px; }}
    .from, .bill {{ font-size: 11px; line-height: 1.35; margin: 0; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 6px; }}
    th, td {{ border: 1px solid #111; padding: 4px 7px; font-size: 11px; }}
    thead th {{ background: #084083; color: #fff; text-align: left; }}
    .qty {{ width: 12%; text-align: center; }}
    .amt {{ width: 22%; text-align: right; white-space: nowrap; }}
    .vehicle {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; }}
    h3 {{ color: #6a6a6a; font-size: 12px; margin: 8px 0 4px; letter-spacing: 0.04em; }}
    ol {{ font-size: 9px; color: #6a6a6a; margin: 2px 0 6px 16px; line-height: 1.3; }}
    .closing {{ margin: 8px 0 4px; font-size: 11px; }}
    .sign-line {{ border-bottom: 1px solid #111; height: 28px; width: 46%; }}
    .sign-img {{ height: 36px; }}
  </style>
</head>
<body>
  <div class="sheet">
    <img class="head" src="{head}" alt="">
    <div class="inner">
      <div class="dochead">
        <h2>INVOICE</h2>
        <div class="meta">
          <div>INV NO: {_v(data, "id")}</div>
          <div>Date: {pretty}</div>
        </div>
      </div>
      <div class="split">
        <div>
          <h3 class="label">Bill To:</h3>
          <p class="bill">{_nl(data.get("customerName"))}<br>{_nl(data.get("address"))}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Description</th><th class="qty">Qty</th><th class="amt">Price</th><th class="amt">Total</th></tr>
        </thead>
        <tbody>
          {lines_html}
          <tr><th colspan="3">{total_label}</th><td class="amt">{total_amt}</td></tr>
        </tbody>
      </table>
      <h3>VEHICLE DETAILS</h3>
      <div class="vehicle">
        <table>
          <tr><th>Make</th><td>:</td><td>{html.escape(str(data.get("make") or "").upper())}</td></tr>
          <tr><th>Model</th><td>:</td><td>{html.escape(str(data.get("model") or "").upper())}</td></tr>
          <tr><th>Chassis NO</th><td>:</td><td>{_v(data, "chassisNr")}</td></tr>
          <tr><th>Engine</th><td>:</td><td>{_v(data, "engineNr")}</td></tr>
        </table>
        <table>
          <tr><th>Manufacture Year</th><td>:</td><td>{_v(data, "year")}</td></tr>
          <tr><th>Engine Capacity</th><td>:</td><td>{_v(data, "engineCapacity")}</td></tr>
          <tr><th>Manufacture Country</th><td>:</td><td>{_v(data, "country")}</td></tr>
          <tr><th>Vehicle Colour</th><td>:</td><td>{html.escape(str(data.get("colour") or "").upper())}</td></tr>
        </table>
      </div>
      <h3>TERMS AND CONDITIONS</h3>
      <ol>
        <li>Customer will be billed after indicating acceptance of this quote</li>
        <li>Payment will be due before delivery of the service and goods</li>
        <li>Please fax or mail the signed price quote to the address above</li>
        <li>Please note that all advance payments made are non-refundable under any circumstances</li>
        <li>The above prices may change due to government policies and currency exchange rates.</li>
      </ol>
      <p class="closing">Yours Faithfully</p>
      <div>{_v(data, "preparedByName")} — {_v(data, "designation")}</div>
      {_sign_html(data, "signatureImage")}
    </div>
  </div>
</body>
</html>"""


def _plain(data: dict, key: str, fallback: str = "") -> str:
    return str(data.get(key) or fallback).strip()


def _signature_png_bytes(src: str) -> bytes | None:
    raw_src = str(src or "").strip()
    if not raw_src.startswith("data:image/") or "," not in raw_src:
        return None
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        raw = base64.b64decode(raw_src.split(",", 1)[1])
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return None
    im = _knock_out_signature(im)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def _knock_out_signature(im):
    """Keep the original pen colour and drop the paper behind it."""
    from PIL import Image

    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    step = max(1, (w * h) // 6000)
    samples = clear = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            samples += 1
            if px[x, y][3] < 16:
                clear += 1
    if samples and clear / samples > 0.08:
        return _crop_ink(im)

    long_side = max(w, h)
    if long_side > 1400:
        scale = 1400 / long_side
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        w, h = im.size
        px = im.load()

    pts = []
    step_b = max(1, min(w, h) // 50)
    inset = 2
    for x in range(0, w, step_b):
        for y in (min(h - 1, inset), max(0, h - 1 - inset)):
            r, g, b, a = px[x, y]
            if a > 200:
                pts.append((r, g, b))
    for y in range(0, h, step_b):
        for x in (min(w - 1, inset), max(0, w - 1 - inset)):
            r, g, b, a = px[x, y]
            if a > 200:
                pts.append((r, g, b))
    if len(pts) < 8:
        return _crop_ink(im)

    def median(ch: int) -> int:
        vals = sorted(p[ch] for p in pts)
        return vals[len(vals) // 2]

    paper = (median(0), median(1), median(2))

    def dist(c) -> float:
        return ((c[0] - paper[0]) ** 2 + (c[1] - paper[1]) ** 2 + (c[2] - paper[2]) ** 2) ** 0.5

    dists = sorted(dist(p) for p in pts)
    noise = dists[int(len(dists) * 0.9)]
    paper_cut = max(16.0, noise * 2.4 + 8)
    ink_full = paper_cut + 42
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                op[x, y] = (0, 0, 0, 0)
                continue
            delta = dist((r, g, b))
            if delta <= paper_cut:
                op[x, y] = (0, 0, 0, 0)
                continue
            t = (delta - paper_cut) / (ink_full - paper_cut)
            t = max(0.0, min(1.0, t))
            t = t * t * (3 - 2 * t)
            if t < 0.04:
                op[x, y] = (0, 0, 0, 0)
                continue
            ir = max(0, min(255, int(round((r - paper[0] * (1 - t)) / t))))
            ig = max(0, min(255, int(round((g - paper[1] * (1 - t)) / t))))
            ib = max(0, min(255, int(round((b - paper[2] * (1 - t)) / t))))
            op[x, y] = (ir, ig, ib, int(round(t * (a / 255) * 255)))

    for y in range(h):
        for x in range(w):
            if op[x, y][3] < 20:
                continue
            friends = 0
            for yy in range(max(0, y - 1), min(h, y + 2)):
                for xx in range(max(0, x - 1), min(w, x + 2)):
                    if (xx != x or yy != y) and op[xx, yy][3] > 40:
                        friends += 1
            if friends < 1:
                op[x, y] = (0, 0, 0, 0)
    return _crop_ink(out)


def _crop_ink(im):
    w, h = im.size
    px = im.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    kept = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 18:
                kept += 1
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not kept or max_x < min_x or max_y < min_y:
        return im
    pad = 10
    return im.crop((
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + 1 + pad),
        min(h, max_y + 1 + pad),
    ))


def _wrap_pdf_text(text: str, font: str, size: float, max_w: float) -> list[str]:
    from reportlab.pdfbase import pdfmetrics

    out = []
    for para in str(text or "").replace("\r", "").split("\n"):
        words = para.split()
        if not words:
            out.append("")
            continue
        cur = words[0]
        for word in words[1:]:
            trial = f"{cur} {word}"
            if pdfmetrics.stringWidth(trial, font, size) <= max_w:
                cur = trial
            else:
                out.append(cur)
                cur = word
        out.append(cur)
    return out or [""]


def _invoice_reportlab_pdf(pdf_path: Path, data: dict, header_path: Path, footer_path: Path, copy_label: str = "CUSTOMER COPY") -> None:
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font_regular = "Helvetica"
    font_bold = "Helvetica-Bold"
    arial = Path(r"C:\Windows\Fonts\arial.ttf")
    arial_bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if arial.exists() and arial_bold.exists():
        names = set(pdfmetrics.getRegisteredFontNames())
        if "InvoiceSans" not in names:
            pdfmetrics.registerFont(TTFont("InvoiceSans", str(arial)))
        if "InvoiceSans-Bold" not in names:
            pdfmetrics.registerFont(TTFont("InvoiceSans-Bold", str(arial_bold)))
        font_regular = "InvoiceSans"
        font_bold = "InvoiceSans-Bold"

    page_w, page_h = A4
    # Printers cannot mark the outer edge of A4. Phone numbers are at the
    # top of the header art and the footer bar is at the bottom of the footer art.
    safe = 18
    navy = HexColor("#084083")
    ink = HexColor("#111111")
    muted = HexColor("#6a6a6a")
    label = HexColor("#535353")
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    header = ImageReader(str(header_path))
    hw, hh = header.getSize()
    header_h = min(page_w * hh / hw, 74)
    c.drawImage(
        header, 0, page_h - header_h - safe,
        width=page_w, height=header_h,
        preserveAspectRatio=True, mask="auto", anchor="n",
    )

    footer = ImageReader(str(footer_path))
    fw, fh = footer.getSize()
    footer_h = page_w * fh / fw
    footer_top = safe + footer_h

    left = 34
    right = page_w - 34
    y = page_h - header_h - safe - 16
    sign_top = footer_top + 100
    floor = sign_top
    gold = HexColor("#ff6505")

    c.setFillColor(navy)
    c.setFont(font_bold, 20)
    c.drawString(left, y, "INVOICE")
    c.setFillColor(ink)
    c.setFont(font_bold, 10)
    c.drawRightString(right, y + 8, f"INV NO: {_plain(data, 'id')}")
    c.setFont(font_regular, 10)
    _draw_ordinal_date(c, right, y - 6, _plain(data, "invoiceDate") or _plain(data, "agreementDate"), font_regular, 10)
    y -= 22

    c.setFillColor(label)
    c.setFont(font_bold, 11)
    c.drawString(left, y, "Bill To:")
    is_loan = str(copy_label or "").upper().startswith("LOAN")
    y -= 13
    c.setFillColor(ink)
    c.setFont(font_regular, 9)
    if is_loan:
        bill_src = "\n".join(x for x in (_plain(data, "loanBillTo"),) if str(x).strip()) or "\n".join(
            x for x in (_plain(data, "customerName"), _plain(data, "address"), _plain(data, "nic")) if str(x).strip()
        )
    else:
        bill_src = "\n".join(x for x in (_plain(data, "customerName"), _plain(data, "address"), _plain(data, "nic")) if str(x).strip())
    bill_lines = _wrap_pdf_text(bill_src, font_regular, 9, right - left)
    block_h = max(len(bill_lines), 1)
    for i in range(block_h):
        if i < len(bill_lines) and bill_lines[i]:
            c.drawString(left, y, bill_lines[i])
        y -= 11
    y -= 8

    usable = []
    for line in data.get("lines") or []:
        desc = str((line or {}).get("description") or "").strip()
        qty = str((line or {}).get("qty") or "").strip()
        price = str((line or {}).get("price") or "").strip()
        total = str((line or {}).get("total") or "").strip()
        if desc or price or total:
            usable.append((desc, qty, price, total))
    n_lines = max(1, len(usable))
    compact = 16 * (n_lines + 2) + 15 * 4 + 100
    extra = max(0.0, y - sign_top - compact)
    row_h = 16 + extra * 0.16 / (n_lines + 1)
    kv_h = 15 + extra * 0.32 / 4
    term_lh = 10 + extra * 0.30 / 6
    after_table = 18 + extra * 0.10
    after_vehicle = 12 + extra * 0.12
    y -= extra * 0.08

    qty_w = 46
    amt_w = 102
    desc_w = (right - left) - qty_w - amt_w * 2
    cols_x = [left, left + desc_w, left + desc_w + qty_w, left + desc_w + qty_w + amt_w, right]
    row_h = min(22, max(16, row_h))
    kv_h = min(18, max(14, kv_h))

    def draw_cell(x, y_top, w, h, text, *, fill=None, color=ink, font=font_regular, size=9, align="left"):
        if fill is not None:
            c.setFillColor(fill)
            c.rect(x, y_top - h, w, h, fill=1, stroke=0)
        c.setStrokeColor(ink)
        c.setLineWidth(0.6)
        c.rect(x, y_top - h, w, h, fill=0, stroke=1)
        if text is None:
            return
        c.setFillColor(color)
        c.setFont(font, size)
        text_y = y_top - h + 6
        pad = 6
        if align == "center":
            c.drawCentredString(x + w / 2, text_y, text)
        elif align == "right":
            c.drawRightString(x + w - pad, text_y, text)
        else:
            c.drawString(x + pad, text_y, text)

    headers = (("Description", "left"), ("Qty", "center"), ("Total", "right")) if is_loan else (
        ("Description", "left"), ("Qty", "center"), ("Price", "right"), ("Total", "right")
    )
    if is_loan:
        desc_w = (right - left) - qty_w - amt_w
        cols_x = [left, left + desc_w, left + desc_w + qty_w, right]
    for i, (title, align) in enumerate(headers):
        draw_cell(
            cols_x[i], y, cols_x[i + 1] - cols_x[i], row_h, title,
            fill=navy, color=white, font=font_bold, size=9, align=align,
        )
    y -= row_h

    if is_loan:
        price_desc = _plain(data, "loanLineDesc") or "Price"
        price_qty = _plain(data, "loanLineQty") or "1"
        price_total = _plain(data, "loanLineTotal")
        draw_cell(cols_x[0], y, desc_w, row_h, price_desc)
        draw_cell(cols_x[1], y, qty_w, row_h, price_qty, align="center")
        draw_cell(cols_x[2], y, amt_w, row_h, price_total, color=navy, align="right")
        y -= row_h
        label_w = desc_w + qty_w
        draw_cell(left, y, label_w, row_h, "Loan Amount", font=font_bold, size=9)
        draw_cell(cols_x[2], y, amt_w, row_h, _plain(data, "loanAmount"), color=navy, font=font_bold, size=9, align="right")
        y -= row_h
    else:
        drawn = 0
        for desc, qty, price, total in usable:
            wrapped = _wrap_pdf_text(desc, font_regular, 9, desc_w - 12) or [""]
            h = max(row_h, 12 * len(wrapped) + 6)
            if y - h < floor + 16:
                break
            draw_cell(cols_x[0], y, desc_w, h, None)
            c.setFillColor(ink)
            c.setFont(font_regular, 9)
            text_y = y - h + 6 + 11 * (len(wrapped) - 1)
            for part in wrapped:
                c.drawString(left + 6, text_y, part)
                text_y -= 11
            draw_cell(cols_x[1], y, qty_w, h, qty, align="center")
            draw_cell(cols_x[2], y, amt_w, h, price, align="right")
            draw_cell(cols_x[3], y, amt_w, h, total, color=navy, align="right")
            y -= h
            drawn += 1
        if drawn == 0:
            for i in range(4):
                draw_cell(cols_x[i], y, cols_x[i + 1] - cols_x[i], row_h, "")
            y -= row_h

        total_label = _plain(data, "totalLabel") or "TOTAL AMOUNT"
        total_amt = _plain(data, "totalAmount") or _plain(data, "balancePayment")
        total_label_w = desc_w + qty_w + amt_w
        draw_cell(left, y, total_label_w, row_h, total_label, font=font_bold, size=9, align="left")
        draw_cell(cols_x[3], y, amt_w, row_h, total_amt, color=navy, font=font_bold, size=9, align="right")
        y -= row_h

    y -= after_table

    c.setFillColor(muted)
    c.setFont(font_bold, 10)
    c.drawString(left, y, "VEHICLE DETAILS")
    y -= 14

    kv_left = [
        ("Make", _plain(data, "make").upper()),
        ("Model", _plain(data, "model").upper()),
        ("Chassis NO", _plain(data, "chassisNr")),
        ("Engine", _plain(data, "engineNr")),
    ]
    kv_right = [
        ("Manufacture Year", _plain(data, "year")),
        ("Engine Capacity", _plain(data, "engineCapacity")),
        ("Manufacture Country", _plain(data, "country")),
        ("Vehicle Colour", _plain(data, "colour").upper()),
    ]
    gap = 12
    box_w = (right - left - gap) / 2

    def draw_kv(x0, rows):
        colon_w = 16
        label_w = min(118, box_w * 0.42)
        value_w = box_w - label_w - colon_w
        row_top = y
        for k, v in rows:
            draw_cell(x0, row_top, label_w, kv_h, k, font=font_bold, size=8)
            draw_cell(x0 + label_w, row_top, colon_w, kv_h, ":", size=8, align="center")
            draw_cell(x0 + label_w + colon_w, row_top, value_w, kv_h, v, size=8)
            row_top -= kv_h
        return len(rows) * kv_h

    left_h = draw_kv(left, kv_left)
    right_h = draw_kv(left + box_w + gap, kv_right)
    y -= max(left_h, right_h) + after_vehicle

    if is_loan:
        c.setFillColor(muted)
        c.setFont(font_bold, 10)
        c.drawString(left, y, "CUSTOMER DETAILS")
        y -= 14
        cust_rows = [
            ("Name", _plain(data, "customerName")),
            ("Address", _plain(data, "address")),
            ("ID Number", _plain(data, "nic")),
        ]
        for k, v in cust_rows:
            draw_cell(left, y, 110, kv_h, k, font=font_bold, size=8)
            draw_cell(left + 110, y, 16, kv_h, ":", size=8, align="center")
            draw_cell(left + 126, y, right - left - 126, kv_h, v, size=8)
            y -= kv_h
        y -= 16

    c.setFillColor(muted)
    c.setFont(font_bold, 10)
    c.drawString(left, y, "TERMS AND CONDITIONS")
    y -= 13 + extra * 0.04
    terms = [
        "Customer will be billed after indicating acceptance of this quote",
        "Payment will be due before delivery of the service and goods",
        "Please fax or mail the signed price quote to the address above",
        "Please note that all advance payments made are non-refundable under any circumstances",
        "The above prices may change due to government policies and currency exchange rates.",
        "The vehicle will be delivered only after full settlement of this invoice.",
    ]
    c.setFillColor(muted)
    c.setFont(font_regular, 8)
    start_no = 1
    for i, term in enumerate(terms, start_no):
        wrapped = _wrap_pdf_text(f"{i}. {term}", font_regular, 8, right - left)
        for part in wrapped:
            if y < floor + 8:
                break
            c.drawString(left, y, part)
            y -= term_lh

    c.setFillColor(navy)
    c.setFont(font_bold, 10)
    c.drawString(left, footer_top + 86, "PREPARED BY")
    c.setStrokeColor(gold)
    c.setLineWidth(1)
    c.line(left, footer_top + 82, right, footer_top + 82)
    col_w = (right - left) / 4
    c.setFillColor(muted)
    c.setFont(font_bold, 8)
    for i, lbl in enumerate(("Name", "Designation", "Signature", "Customer Signature")):
        c.drawString(left + i * col_w, footer_top + 70, lbl)
    line_y = footer_top + 14
    c.setStrokeColor(HexColor("#c5d0dc"))
    c.setLineWidth(0.8)
    for i in (2, 3):
        c.line(left + i * col_w, line_y, left + (i + 1) * col_w - 12, line_y)
    name_y = line_y + 8
    c.setFillColor(HexColor("#1d5aaa"))
    prepared = _plain(data, "preparedByName")
    if prepared in ("Harshani", "H.M.C.Harshani Thilakarathna"):
        prepared = "H.M. C.Harshani Thilakarathna"
    c.setFont(font_bold, 9)
    c.drawString(left, name_y, prepared)
    c.setFont(font_bold, 9)
    c.drawString(left + col_w, name_y, _plain(data, "designation") or ("Admin" if prepared == "H.M. C.Harshani Thilakarathna" else ""))
    buyer_png = _signature_png_bytes(str(data.get("buyerSignature") or "").strip())
    if buyer_png:
        try:
            sign = ImageReader(io.BytesIO(buyer_png))
            sw, sh = sign.getSize()
            draw_h = 28
            draw_w = draw_h * sw / sh if sh else draw_h * 2.4
            c.drawImage(sign, left + 3 * col_w, line_y + 2, width=min(draw_w, col_w - 10), height=draw_h, mask="auto", preserveAspectRatio=True, anchor="sw")
        except Exception:
            pass
    src = str(data.get("signatureImage") or "").strip()
    png = _signature_png_bytes(src)
    sign = None
    if png:
        try:
            sign = ImageReader(io.BytesIO(png))
        except Exception:
            sign = None
    if sign is not None:
        try:
            sw, sh = sign.getSize()
            scale = max(28, min(56, int(data.get("signatureScale") or 40)))
            draw_h = scale * 0.7
            draw_w = draw_h * sw / sh if sh else draw_h * 2.4
            c.drawImage(
                sign,
                left + 2 * col_w,
                line_y + 2,
                width=min(draw_w, col_w - 10),
                height=draw_h,
                mask="auto",
                preserveAspectRatio=True,
                anchor="sw",
            )
        except Exception:
            pass

    c.drawImage(
        footer, 0, safe,
        width=page_w, height=footer_h,
        preserveAspectRatio=True, mask="auto", anchor="s",
    )
    c.save()


def write_agreement_pdf(pdf_path: Path, data: dict, root: Path, images_dir: Path | None = None) -> None:
    company = str(data.get("invoiceCompany") or "").strip()
    kind = _kind_of(data)
    if kind == "invoice" and company == "Genx Importanters":
        header = qs._letterhead_file(root, "genx-header.png", images_dir)
        if not header.exists():
            header = qs._letterhead_file(root, "genx-header.jpg", images_dir)
    elif kind == "invoice":
        header = qs._letterhead_file(root, "cs-invoice-header.jpg", images_dir)
    else:
        header = qs._letterhead_file(root, "cs-header.jpg", images_dir)
    if kind == "invoice":
        footer = qs._letterhead_file(root, "invoice-footer.png", images_dir)
    else:
        footer = qs._letterhead_file(root, "cs-footer.jpg", images_dir)
    if kind == "invoice":
        if not header.exists() or not footer.exists():
            raise RuntimeError("Letterhead images හොයා ගන්න බැරි වුණා")
        from pypdf import PdfReader, PdfWriter
        copy_mode = str(data.get("pdfCopy") or "both").strip().lower()
        if copy_mode in ("customer", "invoice", "customer-copy"):
            copies = [("CUSTOMER COPY", ".p1.pdf")]
        elif copy_mode in ("loan", "finance", "loan-copy"):
            copies = [("LOAN COPY", ".p2.pdf")]
        else:
            copies = [("CUSTOMER COPY", ".p1.pdf"), ("LOAN COPY", ".p2.pdf")]
        temps = []
        try:
            writer = PdfWriter()
            for label, suffix in copies:
                tmp = pdf_path.with_name(pdf_path.stem + suffix)
                temps.append(tmp)
                _invoice_reportlab_pdf(tmp, data, header, footer, label)
                writer.append(PdfReader(str(tmp)))
            with open(pdf_path, "wb") as fh:
                writer.write(fh)
        finally:
            for tmp in temps:
                qs._safe_unlink(tmp)
        return
    if kind == "preorder":
        html_fn = preorder_html
        keep_first = False
    else:
        html_fn = agreement_html
        keep_first = False
    html_text = html_fn(
        data,
        header_uri=qs._data_uri(header) if header.exists() else "",
        footer_uri=qs._data_uri(footer) if footer.exists() else "",
    )
    qs._browser_pdf(html_text, pdf_path, keep_first_page=keep_first)


def remove_agreement_files(root: Path, qid: str, keep_person: str | None = None) -> None:
    qid = safe_agreement_id(qid)
    if not qid:
        return
    for name in STAFF:
        if keep_person and name == keep_person:
            continue
        qs._safe_unlink(root / DATA_DIR / name / f"{qid}.json")
        qs._safe_unlink(root / name / f"{qid}.json")
        folder = root / name / qid
        if folder.exists():
            for path in folder.glob("*"):
                qs._safe_unlink(path)
            try:
                folder.rmdir()
            except OSError:
                pass
        qs._safe_unlink(root / name / f"{qid}.pdf")


def save_agreement(root: Path, data: dict, images_dir: Path | None = None) -> dict:
    person = qs.staff_name(data.get("preparedByName") or data.get("person"))
    if not person:
        raise ValueError("Select a Prepared By name")
    kind = _kind_of(data)
    requested = safe_agreement_id(data.get("id"))
    existing = find_agreement(root, requested) if requested else None
    if not requested:
        if kind != "invoice":
            raise ValueError("Type the reference number")
        qid = next_invoice_id(
            list_agreements(root),
            data.get("invoiceCompany") or "",
            data.get("invoiceDate") or data.get("agreementDate") or "",
        )
    else:
        qid = requested
    now = datetime.now().isoformat()
    data = dict(data)
    data["id"] = qid
    data["kind"] = kind
    data["preparedByName"] = person
    data["designation"] = qs.designation_for(person, kind)
    data["createdAt"] = (existing or {}).get("createdAt") or data.get("createdAt") or now
    data["updatedAt"] = now
    data["person"] = person
    data["make"] = str(data.get("make") or "").strip().upper()
    data["model"] = str(data.get("model") or "").strip().upper()
    if data.get("make") or data.get("model"):
        data["makeModel"] = " ".join(x for x in (data["make"], data["model"]) if x)
    for key in ("signatureImage", "buyerSignature", "buyerWitness", "sellerWitness"):
        raw = str(data.get(key) or "").strip()
        data[key] = raw if raw.startswith("data:image/") else ""
    remove_agreement_files(root, qid, keep_person=person)
    folder = root / person / qid
    folder.mkdir(parents=True, exist_ok=True)
    store = root / DATA_DIR / person
    store.mkdir(parents=True, exist_ok=True)
    qs._hide_windows(root / DATA_DIR)
    json_path = store / f"{qid}.json"
    pdf_path = folder / f"{qid}.pdf"
    json_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    pdf_ok = False
    pdf_error = ""
    try:
        write_agreement_pdf(pdf_path, data, root, images_dir)
        pdf_ok = pdf_path.exists() and pdf_path.stat().st_size >= 800
        if not pdf_ok:
            pdf_error = "PDF file හැදුණේ නැහැ"
    except Exception as err:
        pdf_error = str(err)[:240]
    data["path"] = str(json_path)
    data["pdfPath"] = str(pdf_path)
    data["pdfOk"] = pdf_ok
    if pdf_error:
        data["pdfError"] = pdf_error
    return data


def delete_agreement(root: Path, qid: str) -> bool:
    qid = safe_agreement_id(qid)
    if not qid:
        return False
    remove_agreement_files(root, qid)
    return True
