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
ID_RE = re.compile(r"^(SA|PO|INV)-\d{4}-\d{4}$")
DATA_DIR = "_data"

TEXT_KEYS = (
    "customerId", "customerName", "address", "telephone", "nic",
    "makeModel", "registrationNr", "chassisNr", "year", "colour",
    "trim", "mileage", "auctionGrade", "deliveryWeeks", "exchangeRate",
    "transfereeName", "transfereeNic", "warrantyYears", "warrantyMonths",
    "warranty", "docMta2", "docVrc", "docMta6", "docInsurance", "docEmission", "docRevenue",
    "payBeforeShipment", "payAfterBl", "kind",
    "make", "model", "engineNr", "engineCapacity", "country", "invoiceDate",
)
MONEY_KEYS = (
    "agreedAmount", "advanceAmount", "advancePaid", "secondPaid", "thirdPaid", "finalPaid",
    "vehicleCost", "vehiclePaid", "importCharges", "importPaid", "otherCharges", "otherPaid",
    "additionalFee", "additionalPaid", "registrationFee", "registrationPaid",
    "valuationFee", "valuationPaid", "salesTax", "salesTaxPaid",
    "totalAmount", "totalPaid", "balancePayment",
)


def agreement_root(project_root: Path) -> Path:
    env = os.environ.get("AGREEMENT_DIR")
    base = Path(project_root)
    for candidate in (Path(env) if env else None, NETWORK_AGREEMENTS, base / "agreements"):
        if candidate is None:
            continue
        if qs._writable(candidate):
            return candidate
    fallback = project_root / "agreements"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def ensure_layout(root: Path, images_dir: Path) -> None:
    for name in STAFF:
        (root / name).mkdir(parents=True, exist_ok=True)
        (root / DATA_DIR / name).mkdir(parents=True, exist_ok=True)
    (root / DATA_DIR).mkdir(exist_ok=True)
    qs._hide_windows(root / DATA_DIR)
    qs.ensure_layout(root, images_dir)


def safe_agreement_id(raw: str) -> str:
    qid = str(raw or "").strip().upper()
    return qid if ID_RE.match(qid) else ""


def next_agreement_id(root: Path, prefix: str = "SA") -> str:
    raw = str(prefix).upper()
    prefix = "PO" if raw == "PO" else "INV" if raw == "INV" else "SA"
    year = datetime.now().year
    used = set()
    folders = [root / DATA_DIR / name for name in STAFF]
    folders.extend(root / name for name in STAFF)
    for folder in folders:
        if not folder.exists():
            continue
        for path in folder.iterdir():
            match = ID_RE.match(path.stem.upper()) if path.is_file() else None
            if match:
                parts = path.stem.upper().split("-")
                if len(parts) == 3 and parts[0] == prefix and parts[1].isdigit() and int(parts[1]) == year:
                    used.add(int(parts[2]))
    n = 1
    while n in used:
        n += 1
    return f"{prefix}-{year}-{n:04d}"


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
            for path in list(folder.glob("SA-*.json")) + list(folder.glob("PO-*.json")) + list(folder.glob("INV-*.json")):
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
        </div>
        <div>
          <div>CarSwitch (Pvt) Ltd (Seller)</div>
          <div>{_v(data, "preparedByName")} — {_v(data, "designation")}</div>
          {seller_html}
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
    before = "Yes" if str(data.get("payBeforeShipment") or "") in ("1", "true", "Yes", "on") else "No"
    after_bl = "Yes" if str(data.get("payAfterBl") or "") in ("1", "true", "Yes", "on") else "No"
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
        <tr><th class="bar" colspan="3">Price and Payment Terms</th></tr>
        <tr><th></th><th class="amt">Amount</th><th class="amt">Paid</th></tr>
        <tr><th>Advance Payment</th><td class="amt">{money("advanceAmount")}</td><td class="amt">{money("advancePaid")}</td></tr>
        <tr><th>Vehicle Cost</th><td class="amt">{money("vehicleCost")}</td><td class="amt">{money("vehiclePaid")}</td></tr>
        <tr><th>Import Charges</th><td class="amt">{money("importCharges")}</td><td class="amt">{money("importPaid")}</td></tr>
        <tr><th>Other Charges</th><td class="amt">{money("otherCharges")}</td><td class="amt">{money("otherPaid")}</td></tr>
        <tr><th>Total Estimated Amount</th><td class="amt">{money("totalAmount")}</td><td class="amt">{money("totalPaid")}</td></tr>
        <tr><th>Balance Payment</th><td class="amt">{money("balancePayment")}</td><td class="amt"></td></tr>
      </table>
      <p><strong>Payment No. 01</strong> - The “Advance payment” is to be made by the Customer to the Facilitator, to the Company Bank Account, or through another instrument acceptable to the Facilitator.</p>
      <p><strong>Payment No. 02</strong> - LC open funds should be arranged by the Customer when the LC opens on his bank account.</p>
      <p><strong>Payment No. 03</strong> - All Other Charges should be paid by the Customer to the facilitator as below:</p>
      <ul>
        <li>Before Shipment: {before}</li>
        <li>After receiving the Bill of Lading (BL): {after_bl}</li>
      </ul>
      <p><strong>Payment No. 03</strong> - Customer Holder should be directly paid to the customs of Sri Lanka. <strong>Payment No. 04</strong> - Facilitator’s Fee, before handing over the vehicle to the Customer.</p>
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
        </div>
        <div>
          <div>CarSwitch Pvt Ltd (Seller)</div>
          <div>{_v(data, "preparedByName")} — {_v(data, "designation")}</div>
          {_sign_html(data, "signatureImage")}
        </div>
        <div>
          <div>Witnesses (For Buyer)</div>
          {_sign_html(data, "buyerWitness")}
        </div>
        <div>
          <div>Witnesses (For Seller)</div>
          {_sign_html(data, "sellerWitness")}
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
      <p><strong>Delivery.</strong> The Vehicle, including all tools, accessories, keys, and applicable documentation, has been physically handed over to the Buyer in good condition as of the date of this Agreement.</p>
      <p><strong>Default.</strong> In the event of default by either party, the non-defaulting party may pursue legal remedies to enforce the terms of this Agreement.</p>
      <h3>Annexure 2</h3>
      <p>If the Vehicle is to be registered or transferred under a party other than the Customer, the following details shall apply:</p>
      <table>
        <tr><th>Name of the Registered/Transferee Party</th><td>:</td><td>{_v(data, "transfereeName")}</td></tr>
        <tr><th>National Identity Card (NIC) Number</th><td>:</td><td>{_v(data, "transfereeNic")}</td></tr>
      </table>
    </div>
    <img class="foot" src="{foot}" alt="">
  </div>
</body>
</html>"""


def _nl(text: str) -> str:
    return html.escape(str(text or "").strip()).replace("\n", "<br>")


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
        <div>
          <h3 class="label">From:</h3>
          <p class="from">CarSwitch (Pvt) Ltd,<br>Jayanthi Mawatha, Anuradhapura<br>+94 25 222 9292 | +94 70 555 9292</p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Description</th><th class="qty">Qty</th><th class="amt">Price</th><th class="amt">Total</th></tr>
        </thead>
        <tbody>
          {lines_html}
          <tr><th colspan="3">TOTAL AMOUNT</th><td class="amt">{_v(data, "totalAmount")}</td></tr>
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
    w, h = im.size
    scale = min(1.0, 520 / max(w, 1), 180 / max(h, 1))
    if scale < 0.999:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        w, h = im.size
    original = im.copy()
    px = im.load()

    def sample(x: int, y: int) -> tuple[int, int, int]:
        r, g, b, _a = px[max(0, min(w - 1, x)), max(0, min(h - 1, y))]
        return r, g, b

    corners = [
        sample(2, 2), sample(w - 3, 2), sample(2, h - 3), sample(w - 3, h - 3),
        sample(w // 2, 2), sample(w // 2, h - 3),
    ]
    bg = (
        sum(p[0] for p in corners) / 6,
        sum(p[1] for p in corners) / 6,
        sum(p[2] for p in corners) / 6,
    )
    bg_luma = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    paper_cut = 40
    ink_full = 88
    min_x, min_y, max_x, max_y = w, h, 0, 0
    kept = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            chroma = max(r, g, b) - min(r, g, b)
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            paper = (
                a < 16
                or dist < paper_cut
                or (luma > 210 and chroma < 18)
                or (abs(luma - bg_luma) < 16 and chroma < 22)
            )
            if paper:
                px[x, y] = (r, g, b, 0)
                continue
            t = (dist - paper_cut) / (ink_full - paper_cut)
            t = max(0.0, min(1.0, t))
            t = t * t * (3 - 2 * t)
            alpha = int(max(t, chroma / 90, 0.55) * (a / 255) * 255)
            if alpha < 18:
                px[x, y] = (r, g, b, 0)
                continue
            px[x, y] = (r, g, b, alpha)
            kept += 1
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y
    if kept == 0:
        im = original
    elif max_x >= min_x and max_y >= min_y:
        pad = 8
        box = (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(w, max_x + 1 + pad),
            min(h, max_y + 1 + pad),
        )
        im = im.crop(box)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


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


def _invoice_reportlab_pdf(pdf_path: Path, data: dict, header_path: Path, footer_path: Path) -> None:
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
    navy = HexColor("#084083")
    ink = HexColor("#111111")
    muted = HexColor("#6a6a6a")
    label = HexColor("#535353")
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    header = ImageReader(str(header_path))
    hw, hh = header.getSize()
    header_h = min(page_w * hh / hw, 74)
    c.drawImage(header, 0, page_h - header_h, width=page_w, height=header_h, preserveAspectRatio=True, mask="auto")

    footer = ImageReader(str(footer_path))
    fw, fh = footer.getSize()
    footer_h = page_w * fh / fw

    left = 34
    right = page_w - 34
    y = page_h - header_h - 18
    sign_top = footer_h + 110
    floor = sign_top
    gold = HexColor("#ff6505")

    c.setFillColor(navy)
    c.setFont(font_bold, 20)
    c.drawString(left, y, "INVOICE")
    c.setFillColor(ink)
    c.setFont(font_bold, 10)
    c.drawRightString(right, y + 8, f"INV NO: {_plain(data, 'id')}")
    c.setFont(font_regular, 10)
    pretty = _pretty_date(_plain(data, "invoiceDate") or _plain(data, "agreementDate"))
    c.drawRightString(right, y - 6, f"Date: {pretty}")
    y -= 22

    col_w = (right - left - 16) / 2
    c.setFillColor(label)
    c.setFont(font_bold, 11)
    c.drawString(left, y, "Bill To:")
    c.drawString(left + col_w + 16, y, "From:")
    y -= 13
    c.setFillColor(ink)
    c.setFont(font_regular, 9)
    bill_lines = _wrap_pdf_text(
        "\n".join(x for x in (_plain(data, "customerName"), _plain(data, "address")) if x),
        font_regular,
        9,
        col_w,
    )
    from_lines = [
        "CarSwitch (Pvt) Ltd,",
        "Jayanthi Mawatha, Anuradhapura",
        "+94 25 222 9292 | +94 70 555 9292",
    ]
    block_h = max(len(bill_lines), len(from_lines))
    for i in range(block_h):
        if i < len(bill_lines) and bill_lines[i]:
            c.drawString(left, y, bill_lines[i])
        if i < len(from_lines):
            c.drawString(left + col_w + 16, y, from_lines[i])
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

    headers = (("Description", "left"), ("Qty", "center"), ("Price", "right"), ("Total", "right"))
    for i, (title, align) in enumerate(headers):
        draw_cell(
            cols_x[i], y, cols_x[i + 1] - cols_x[i], row_h, title,
            fill=navy, color=white, font=font_bold, size=9, align=align,
        )
    y -= row_h

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

    total_label_w = desc_w + qty_w + amt_w
    draw_cell(left, y, total_label_w, row_h, "TOTAL AMOUNT", font=font_bold, size=9, align="left")
    draw_cell(
        cols_x[3], y, amt_w, row_h, _plain(data, "totalAmount"),
        color=navy, font=font_bold, size=9, align="right",
    )
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
    ]
    c.setFillColor(muted)
    c.setFont(font_regular, 8)
    for i, term in enumerate(terms, 1):
        wrapped = _wrap_pdf_text(f"{i}. {term}", font_regular, 8, right - left)
        for part in wrapped:
            if y < floor + 8:
                break
            c.drawString(left, y, part)
            y -= term_lh

    c.setFillColor(navy)
    c.setFont(font_bold, 10)
    c.drawString(left, footer_h + 96, "PREPARED BY")
    c.setStrokeColor(gold)
    c.setLineWidth(1)
    c.line(left, footer_h + 92, right, footer_h + 92)
    sign_right = left + (right - left) * 0.72
    col_w = (sign_right - left) / 3
    c.setFillColor(muted)
    c.setFont(font_bold, 8)
    for i, lbl in enumerate(("Name", "Designation", "Signature")):
        c.drawString(left + i * col_w, footer_h + 80, lbl)
    line_y = footer_h + 18
    c.setStrokeColor(HexColor("#c5d0dc"))
    c.setLineWidth(0.8)
    for i in range(3):
        c.line(left + i * col_w, line_y, left + (i + 1) * col_w - 12, line_y)
    name_y = line_y + 8
    c.setFillColor(ink)
    c.setFont(font_regular, 9)
    c.drawString(left, name_y, _plain(data, "preparedByName"))
    c.drawString(left + col_w, name_y, _plain(data, "designation"))
    src = str(data.get("signatureImage") or "").strip()
    png = _signature_png_bytes(src)
    if png:
        try:
            sign = ImageReader(io.BytesIO(png))
            sw, sh = sign.getSize()
            scale = max(28, min(56, int(data.get("signatureScale") or 40)))
            draw_h = scale * 0.7
            draw_w = draw_h * sw / sh if sh else draw_h * 2.4
            x_off = max(0, min(90, int(data.get("signatureX") or 0)))
            c.drawImage(
                sign,
                left + 2 * col_w + x_off,
                line_y + 2,
                width=min(draw_w, col_w - 10),
                height=draw_h,
                mask="auto",
                preserveAspectRatio=True,
                anchor="sw",
            )
        except Exception:
            pass

    c.drawImage(footer, 0, 0, width=page_w, height=footer_h, preserveAspectRatio=False, mask="auto")
    c.save()


def write_agreement_pdf(pdf_path: Path, data: dict, root: Path, images_dir: Path | None = None) -> None:
    header = qs._letterhead_file(root, "cs-header.jpg", images_dir)
    footer = qs._letterhead_file(root, "cs-footer.jpg", images_dir)
    kind = _kind_of(data)
    if kind == "invoice":
        if not header.exists() or not footer.exists():
            raise RuntimeError("Letterhead images හොයා ගන්න බැරි වුණා")
        tmp = pdf_path.with_name(pdf_path.stem + ".building.pdf")
        try:
            _invoice_reportlab_pdf(tmp, data, header, footer)
            qs._install_pdf(tmp, pdf_path)
        finally:
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
        raise ValueError("Prepared By name select කරන්න")
    requested = safe_agreement_id(data.get("id"))
    existing = find_agreement(root, requested) if requested else None
    kind = _kind_of(data)
    prefix = "INV" if kind == "invoice" else "PO" if kind == "preorder" else "SA"
    qid = requested or next_agreement_id(root, prefix)
    now = datetime.now().isoformat()
    data = dict(data)
    data["id"] = qid
    data["kind"] = kind
    data["preparedByName"] = person
    data["designation"] = STAFF_ROLES[person]
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
