const STORAGE_KEY = 'cs-agreements-v1';
const PREP_KEY = 'genx-prepared-by';
const SIG_KEY = 'genx-signature-';
const SIG_SCALE_KEY = 'genx-signature-scale-';
const STAFF_ROLES = {
  'B.M.N. S.Basnayaka': 'Sales Executive',
  'G.H.I. R.Nayanajith': 'Sales Executive',
  'Malki Rasanga Widanagamge': 'Executive Admin and Marketing',
  'H.M. C.Harshani Thilakarathna': 'Admin',
  'D.A.R. N.Dissanayaka': 'Director'
};
const STAFF_DISPLAY = {};
const STAFF_SIGNS = {
  'H.M. C.Harshani Thilakarathna': 'images/harshani-signature.png?v=1'
};
const STAFF = Object.keys(STAFF_ROLES);
const TEXT_FIELDS = [
  'customerName', 'address', 'make', 'model', 'chassisNr',
  'engineNr', 'year', 'engineCapacity', 'country', 'colour', 'preparedByName', 'invoiceCompany',
  'nic', 'loanBillTo', 'loanLineDesc', 'loanLineQty'
];
const COMPANY_BRAND = {
  Carswitch: {
    header: 'images/cs-invoice-header.jpg?v=1',
    footer: 'images/invoice-footer.png?v=1',
    title: 'CS Docs — Carswitch Invoice'
  },
  'Genx Importanters': {
    header: 'images/genx-header.png?v=3',
    footer: 'images/invoice-footer.png?v=1',
    title: 'CS Docs — Genx Invoice'
  }
};

let apiItems = [];
let apiRoot = '';
let lastUsingNetwork = false;
let apiBase = '';
let saving = false;
let toastTimer = 0;
let sellerSign = '';
let buyerSign = '';
let lines = [emptyLine(), emptyLine()];

function emptyLine() {
  return { description: '', qty: '1', price: '', total: '' };
}

function val(id) {
  return document.getElementById(id);
}

function forceCaps(el) {
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = String(el.value || '').toUpperCase();
  if (el.value !== next) {
    el.value = next;
    if (typeof start === 'number' && el === document.activeElement) {
      try { el.setSelectionRange(start, end); } catch { /* ignore */ }
    }
  }
}

function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseNum(raw) {
  const text = String(raw || '').trim();
  if (!text) return 0;
  const neg = text.charAt(0) === '-';
  const cleaned = text.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

function formatMoneyValue(n) {
  if (!Number.isFinite(n) || !n) return '';
  const neg = n < 0;
  const [intPart, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + '.' + frac;
}

function formatMoney(raw) {
  if (raw === '' || raw == null) return '';
  return formatMoneyValue(typeof raw === 'number' ? raw : parseNum(raw));
}

function formatMoneyTyping(raw) {
  const text = String(raw ?? '');
  if (!text.trim()) return '';
  const neg = text.trim().charAt(0) === '-';
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned) return neg ? '-' : '';
  const dot = cleaned.indexOf('.');
  const hasDot = dot !== -1;
  const intRaw = (hasDot ? cleaned.slice(0, dot) : cleaned).replace(/\D/g, '');
  const frac = hasDot ? cleaned.slice(dot + 1).replace(/\D/g, '').slice(0, 2) : '';
  const intPart = intRaw.replace(/^0+(?=\d)/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let out = (neg ? '-' : '') + grouped;
  if (hasDot) out += '.' + frac;
  return out;
}

function isHomeCloud() {
  return location.hostname.endsWith('vercel.app');
}

function showToast(text, kind) {
  const el = document.getElementById('save-toast');
  setStatus(text);
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.className = 'save-toast no-print' + (kind ? ' is-' + kind : '');
  clearTimeout(toastTimer);
  if (kind !== 'wait') {
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
}

function setStatus(text) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = text || '';
}

function setSaveBusy(on) {
  saving = on;
  const btn = val('save-btn');
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? 'Saving...' : 'Save';
  }
}

let invoiceLockedId = '';

function setQuoteNo(id) {
  if (val('invoiceNo')) val('invoiceNo').value = id || '';
  if (val('loanInvoiceNo')) val('loanInvoiceNo').value = id || '';
  const toolbar = document.getElementById('toolbar-ref');
  if (toolbar) toolbar.textContent = id || 'New';
  const del = val('delete-btn');
  if (del) del.disabled = !id;
}

async function previewNextInvoiceNo() {
  if (invoiceLockedId) return;
  const company = val('invoiceCompany') && val('invoiceCompany').value;
  if (!company) {
    setQuoteNo('');
    return;
  }
  let items = allKnown();
  try {
    const listed = await apiList();
    items = listed.items || items;
  } catch {
    /* local preview */
  }
  const when = (val('invoiceDate') && val('invoiceDate').value) || todayIso();
  setQuoteNo(nextRef(items, company, when));
}

function lineAmount(line) {
  return parseNum(line && line.qty) * parseNum(line && line.price);
}

function lineIsAdvance(line, index) {
  const desc = String((line && line.description) || '').trim().toLowerCase();
  if (desc.includes('advance')) return true;
  const firstPrice = parseNum(lines[0] && lines[0].price);
  return index === 1 && !desc && firstPrice > 0 && parseNum(line && line.price) > 0;
}

function lineIsFinance(line) {
  const desc = String((line && line.description) || '').trim().toLowerCase();
  return desc.includes('finance');
}

function syncGrandTotal() {
  let net = 0;
  let finance = 0;
  let any = false;
  lines.forEach((line, index) => {
    const amount = parseNum(line.total);
    if (!amount) return;
    if (lineIsFinance(line)) {
      finance += Math.abs(amount);
      return;
    }
    any = true;
    net += lineIsAdvance(line, index) ? -Math.abs(amount) : amount;
  });
  const el = val('totalAmount');
  if (el) el.value = any ? (net ? formatMoneyValue(net) : '0.00') : '';
  const loanTotal = val('loanLineTotal');
  if (loanTotal && loanTotal.dataset.touched !== '1' && any) loanTotal.value = el.value;
  const loanAmt = val('loanAmount');
  if (loanAmt && loanAmt.dataset.touched !== '1' && finance) loanAmt.value = formatMoneyValue(finance);
}

function ordinalDateHtml(iso) {
  const text = String(iso || '').slice(0, 10);
  const d = new Date(text + 'T00:00:00');
  if (!text || Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const teen = day % 100;
  const suf = (teen >= 11 && teen <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
  const month = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return day + '<sup>' + suf + '</sup> ' + month;
}

function renderLines() {
  const tbody = val('invoice-lines');
  if (!tbody) return;
  tbody.innerHTML = lines.map((line, i) => `
    <tr data-i="${i}">
      <td><input data-field="description" type="text" maxlength="120" value="${escapeAttr(line.description)}"></td>
      <td class="qty"><input data-field="qty" class="money" type="text" inputmode="decimal" value="${escapeAttr(line.qty)}"></td>
      <td class="amt"><input data-field="price" class="money" type="text" inputmode="decimal" value="${escapeAttr(line.price)}"></td>
      <td class="amt"><input data-field="total" class="money" type="text" inputmode="decimal" value="${escapeAttr(line.total)}"></td>
    </tr>
  `).join('');
  syncLoanCopy();
}

function escapeAttr(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function makeModel() {
  return [val('make') && val('make').value.trim().toUpperCase(), val('model') && val('model').value.trim().toUpperCase()]
    .filter(Boolean)
    .join(' ');
}

function readForm() {
  const date = (val('invoiceDate') && val('invoiceDate').value) || todayIso();
  const data = {
    id: val('invoiceNo').value.trim(),
    kind: 'invoice',
    invoiceDate: date,
    agreementDate: date,
    designation: STAFF_ROLES[val('preparedByName').value] || '',
    signatureImage: sellerSign,
    buyerSignature: buyerSign,
    invoiceCompany: val('invoiceCompany') ? val('invoiceCompany').value.trim() : '',
    signatureScale: Number(localStorage.getItem(SIG_SCALE_KEY + val('preparedByName').value) || 56),
    lines: lines.map((line) => ({
      description: String(line.description || '').trim(),
      qty: String(line.qty || '').trim(),
      price: formatMoney(line.price),
      total: formatMoney(line.total) || formatMoneyValue(lineAmount(line))
    })),
    totalLabel: (val('totalLabel') && val('totalLabel').value.trim()) || 'TOTAL AMOUNT',
    totalAmount: formatMoney(val('totalAmount') && val('totalAmount').value),
    loanAmount: formatMoney(val('loanAmount') && val('loanAmount').value),
    loanLineTotal: formatMoney(val('loanLineTotal') && val('loanLineTotal').value),
    makeModel: makeModel(),
    updatedAt: new Date().toISOString()
  };
  TEXT_FIELDS.forEach((id) => { data[id] = val(id) ? val(id).value.trim() : ''; });
  data.make = data.make.toUpperCase();
  data.model = data.model.toUpperCase();
  data.colour = (data.colour || '').toUpperCase();
  data.makeModel = makeModel();
  return data;
}

function applyCompanyBrand(company) {
  const brand = COMPANY_BRAND[company] || COMPANY_BRAND.Carswitch;
  ['inv-header-img', 'loan-header-img'].forEach((id) => {
    const el = val(id);
    if (el) el.src = brand.header;
  });
  ['inv-footer-img', 'loan-footer-img'].forEach((id) => {
    const el = val(id);
    if (el) el.src = brand.footer;
  });
  document.title = brand.title;
  const sel = val('invoiceCompany');
  if (sel && company && COMPANY_BRAND[company]) {
    sel.value = company;
    sel.disabled = !!param('company');
  }
}

function syncLoanCopy() {
  const company = (val('invoiceCompany') && val('invoiceCompany').value) || '';
  applyCompanyBrand(company);
  if (val('loanInvoiceNo')) val('loanInvoiceNo').value = val('invoiceNo').value;
  if (val('loanInvoiceDate')) val('loanInvoiceDate').value = val('invoiceDate').value;
  if (val('loanMake')) val('loanMake').textContent = (val('make') && val('make').value) || '';
  if (val('loanModel')) val('loanModel').textContent = (val('model') && val('model').value) || '';
  if (val('loanChassisNr')) val('loanChassisNr').textContent = (val('chassisNr') && val('chassisNr').value) || '';
  if (val('loanEngineNr')) val('loanEngineNr').textContent = (val('engineNr') && val('engineNr').value) || '';
  if (val('loanYear')) val('loanYear').textContent = (val('year') && val('year').value) || '';
  if (val('loanEngineCapacity')) val('loanEngineCapacity').textContent = (val('engineCapacity') && val('engineCapacity').value) || '';
  if (val('loanCountry')) val('loanCountry').textContent = (val('country') && val('country').value) || '';
  if (val('loanColour')) val('loanColour').textContent = (val('colour') && val('colour').value) || '';
  if (val('loanCustomerName')) val('loanCustomerName').textContent = (val('customerName') && val('customerName').value) || '';
  if (val('loanCustomerAddress')) val('loanCustomerAddress').textContent = (val('address') && val('address').value) || '';
  if (val('loanNic')) val('loanNic').textContent = (val('nic') && val('nic').value) || '';
  const pretty = ordinalDateHtml(val('invoiceDate') && val('invoiceDate').value);
  if (val('pretty-date')) val('pretty-date').innerHTML = pretty;
  if (val('loan-pretty-date')) val('loan-pretty-date').innerHTML = pretty;
  const prep = (val('preparedByName') && val('preparedByName').value) || '';
  if (val('loanPreparedName')) val('loanPreparedName').textContent = displayName(prep);
  if (val('loanPreparedRole')) {
    val('loanPreparedRole').textContent = prep
      ? (STAFF_ROLES[prep] || val('designation').value || '')
      : '';
  }
  const buyer = val('loanBuyerPreview');
  const seller = val('loanSellerPreview');
  if (buyer) buyer.src = buyerSign || '';
  if (seller) seller.src = sellerSign || '';
}

function displayName(name) {
  const clean = typeof csCanonical === 'function' ? (csCanonical(name) || name) : name;
  return STAFF_DISPLAY[clean] || clean || '';
}

async function defaultSellerSign(name) {
  const url = STAFF_SIGNS[name];
  if (!url) return '';
  if (!defaultSellerSign.cache) defaultSellerSign.cache = {};
  if (defaultSellerSign.cache[name]) return defaultSellerSign.cache[name];
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    defaultSellerSign.cache[name] = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    defaultSellerSign.cache[name] = '';
  }
  return defaultSellerSign.cache[name];
}

async function applySellerSign(name, explicit) {
  if (explicit) {
    setSign('seller', explicit);
    return;
  }
  const versionKey = 'genx-signature-ver-' + name;
  const saved = name ? localStorage.getItem(SIG_KEY + name) : '';
  if (STAFF_SIGNS[name] && localStorage.getItem(versionKey) !== '1') {
    const data = await defaultSellerSign(name);
    if (data) {
      localStorage.setItem(SIG_KEY + name, data);
      localStorage.setItem(versionKey, '1');
      setSign('seller', data);
      return;
    }
  }
  if (saved) {
    setSign('seller', saved);
    return;
  }
  setSign('seller', await defaultSellerSign(name));
}

function setSign(kind, dataUrl) {
  if (arguments.length === 1) { dataUrl = kind; kind = 'seller'; }
  const isBuyer = kind === 'buyer';
  if (isBuyer) buyerSign = dataUrl || '';
  else sellerSign = dataUrl || '';
  const img = val(isBuyer ? 'buyerPreview' : 'sellerPreview');
  const pad = val(isBuyer ? 'buyer-pad' : 'seller-pad');
  if (img) img.src = dataUrl || '';
  if (pad) pad.classList.toggle('has-sign', !!dataUrl);
  if (typeof syncLoanCopy === 'function') syncLoanCopy();
}

function fillForm(data) {
  invoiceLockedId = data.id || '';
  setQuoteNo(data.id || '');
  val('invoiceDate').value = data.invoiceDate || data.agreementDate || todayIso();
  TEXT_FIELDS.forEach((id) => {
    if (!val(id)) return;
    if (id === 'make' || id === 'model' || id === 'colour') val(id).value = String(data[id] || '').toUpperCase();
    else val(id).value = data[id] || '';
  });
  if (Array.isArray(data.lines) && data.lines.length) {
    lines = data.lines.map((line) => ({
      description: line.description || '',
      qty: line.qty || '1',
      price: formatMoney(line.price),
      total: formatMoney(line.total)
    }));
  } else if (data.vehiclePrice || data.advanceAmount || data.balancePayment) {
    lines = [
      { description: 'full amount', qty: '1', price: formatMoney(data.vehiclePrice), total: formatMoney(data.vehiclePriceTotal || data.vehiclePrice) },
      { description: 'advanced payment', qty: '1', price: formatMoney(data.advanceAmount), total: formatMoney(data.advanceAmount) }
    ];
  } else {
    lines = [emptyLine(), emptyLine()];
  }
  if (val('invoiceCompany')) val('invoiceCompany').value = data.invoiceCompany || param('company') || '';
  if (val('totalLabel')) val('totalLabel').value = data.totalLabel || 'TOTAL AMOUNT';
  if (val('totalAmount')) val('totalAmount').value = formatMoney(data.totalAmount || data.balancePayment || '');
  if (val('loanAmount')) val('loanAmount').value = formatMoney(data.loanAmount || '');
  if (val('loanLineTotal')) val('loanLineTotal').value = formatMoney(data.loanLineTotal || '');
  if (val('loanLineDesc') && !val('loanLineDesc').value) val('loanLineDesc').value = 'Price';
  if (val('loanLineQty') && !val('loanLineQty').value) val('loanLineQty').value = '1';
  if (val('loanBillTo')) val('loanBillTo').value = data.loanBillTo || '';
  if (val('nic')) val('nic').value = data.nic || '';
  val('designation').value = STAFF_ROLES[data.preparedByName] || data.designation || '';
  if (val('preparedByName')) {
    const canon = typeof csCanonical === 'function' ? csCanonical(val('preparedByName').value) : '';
    if (canon) {
      val('preparedByName').value = canon;
      val('designation').value = STAFF_ROLES[canon] || val('designation').value;
    }
  }
  setSign('seller', data.signatureImage || '');
  setSign('buyer', data.buyerSignature || '');
  renderLines();
  applyCompanyBrand(val('invoiceCompany').value || param('company') || 'Carswitch');
  syncLoanCopy();
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 80)));
}

function saveLocalCopy(data) {
  const next = loadLocal().filter((x) => x.id !== data.id);
  next.unshift(data);
  writeLocal(next);
  localStorage.setItem(PREP_KEY, data.preparedByName || '');
  if (data.preparedByName && data.signatureImage) {
    localStorage.setItem(SIG_KEY + data.preparedByName, data.signatureImage);
  }
}

function nextRef(items, company, when) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dt = when ? new Date(when) : new Date();
  const year = Number.isNaN(dt.getTime()) ? new Date().getFullYear() : dt.getFullYear();
  const mon = months[(Number.isNaN(dt.getTime()) ? new Date() : dt).getMonth()];
  const wanted = String(company || '').trim();
  const used = [];
  (items || []).forEach((item) => {
    const name = String((item && item.invoiceCompany) || '').trim();
    if (wanted === 'Genx Importanters') {
      if (name !== 'Genx Importanters') return;
    } else if (name === 'Genx Importanters') {
      return;
    } else if (wanted === 'Carswitch' && name && name !== 'Carswitch') {
      return;
    }
    const id = String((item && item.id) || '').toUpperCase();
    let match = id.match(/^INV-(\d{4})-[A-Z]{3}-(\d+)$/);
    if (!match) match = id.match(/^INV-(\d{4})-(\d+)$/);
    if (!match) return;
    const y = Number(match[1]);
    if (y === year || y === year - 1) used.push(Number(match[2]));
  });
  const n = used.length ? Math.max(...used) + 1 : 1;
  return `INV-${year}-${mon}-` + String(n).padStart(4, '0');
}

function allKnown() {
  const byId = new Map();
  [...apiItems, ...loadLocal()].forEach((item) => {
    if (item && item.id && !byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
}

async function apiFetch(path, options) {
  const bases = apiBase ? [apiBase, ''] : [''];
  let lastErr = null;
  for (const base of bases) {
    try {
      const res = await fetch(base + path, options);
      if (res.status === 401) {
        location.href = '/quote-login?next=' + encodeURIComponent(location.pathname + location.search);
        throw new Error('Login required');
      }
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (type.indexOf('application/json') !== -1 || type.indexOf('pdf') !== -1) {
        apiBase = base;
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Save API is not available.');
}

async function apiList() {
  const res = await apiFetch('/api/agreements', { cache: 'no-store' });
  if (!res.ok) throw new Error('API unavailable');
  const data = await res.json();
  apiRoot = data.root || '';
  lastUsingNetwork = !!data.usingNetwork;
  apiItems = data.items || [];
  setFolderHint(data.root, lastUsingNetwork);
  return data;
}

function setFolderHint(root, onShare) {
  const hint = val('folder-hint');
  if (!hint) return;
  if (root && onShare) {
    hint.hidden = false;
    hint.textContent = 'Saved to: ' + root;
    return;
  }
  if (isHomeCloud() || root === 'cloud') {
    hint.hidden = false;
    hint.textContent = 'Saved online. Save and Download PDF here.';
    return;
  }
  if (root) {
    hint.hidden = false;
    hint.textContent = 'Office folder is not open. Saving to: ' + root;
    return;
  }
  hint.hidden = false;
  hint.textContent = 'Saved on this device. Download PDF here.';
}

function officeSharePath(raw) {
  return /\\\\carswitch\\/i.test(String(raw || ''));
}

async function openSavedFolder(pdfPath) {
  if (isHomeCloud() || !pdfPath) return;
  try {
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pdfPath })
    });
  } catch {
    /* office PC only */
  }
}

async function apiGet(id) {
  const res = await apiFetch('/api/agreement?id=' + encodeURIComponent(id), { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.item || null;
}

async function apiSave(payload) {
  const res = await apiFetch('/api/agreement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Folder save failed');
  apiRoot = data.root || apiRoot;
  lastUsingNetwork = !!data.usingNetwork;
  return data.item;
}

async function apiDelete(id) {
  const res = await apiFetch('/api/agreement?id=' + encodeURIComponent(id), { method: 'DELETE' });
  return res.ok;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function postAgreementPdf(saved, copy) {
  const payload = Object.assign({}, saved, { pdfCopy: copy || 'customer' });
  const res = await fetch('/api/agreement-pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok && type.indexOf('pdf') !== -1) return res.blob();
  return null;
}

async function downloadPdf(saved, copy) {
  const mode = copy || 'customer';
  const label = mode === 'loan' ? 'loan PDF' : 'PDF';
  showToast('Creating ' + label + '...', 'wait');
  try {
    const blob = await postAgreementPdf(saved, mode);
    if (blob && blob.size > 800) {
      const name = (saved.id || 'invoice') + (mode === 'loan' ? '-loan.pdf' : '.pdf');
      triggerBlobDownload(blob, name);
      showToast(mode === 'loan' ? 'Loan PDF downloaded' : 'PDF downloaded', '');
      return;
    }
  } catch {
    /* print fallback */
  }
  showToast('Print → Save as PDF', '');
  window.print();
}

function saveLocalQuote(data) {
  if (!data.id) throw new Error('Type the invoice number');
  data.updatedAt = new Date().toISOString();
  data.createdAt = data.createdAt || data.updatedAt;
  data.person = data.preparedByName;
  data.designation = STAFF_ROLES[data.preparedByName] || '';
  saveLocalCopy(data);
  setQuoteNo(data.id);
  history.replaceState({}, '', `invoice.html?ref=${encodeURIComponent(data.id)}`);
  return data;
}

async function saveInvoice() {
  if (saving) return null;
  if (!(val('invoiceCompany') && val('invoiceCompany').value)) {
    showToast('Select Carswitch or Genx Importanters', 'error');
    val('invoiceCompany').focus();
    return null;
  }
  if (!STAFF.includes(val('preparedByName').value)) {
    showToast('Select a seller name', 'error');
    val('preparedByName').focus();
    return null;
  }
  setSaveBusy(true);
  showToast('Saving...', 'wait');
  const data = readForm();
  let items = allKnown();
  let online = false;
  try {
    const listed = await apiList();
    items = listed.items || items;
    online = true;
  } catch {
    items = allKnown();
  }
  const existing = data.id && items.find((x) => x.id === data.id);
  if (!existing) data.id = '';
  data.createdAt = existing ? existing.createdAt : new Date().toISOString();
  try {
    const saved = await apiSave(data);
    const merged = Object.assign({}, saved, data, { id: saved.id });
    saveLocalCopy(merged);
    invoiceLockedId = merged.id;
    setQuoteNo(merged.id);
    history.replaceState({}, '', `invoice.html?ref=${encodeURIComponent(merged.id)}`);
    const onShare = lastUsingNetwork || officeSharePath(apiRoot || merged.pdfPath);
    setFolderHint(apiRoot || merged.pdfPath, onShare);
    if (merged.pdfOk === false) {
      showToast('Saved, but PDF failed: ' + (merged.pdfError || 'try Save again'), 'error');
    } else {
      showToast('Saved successfully', '');
      if (onShare) openSavedFolder(merged.pdfPath);
    }
    return merged;
  } catch (err) {
    if (!data.id) {
      if (!online) {
        data.id = nextRef(items, data.invoiceCompany, data.invoiceDate);
      } else {
        showToast('Could not get the next invoice number. Try Save again.', 'error');
        return null;
      }
    }
    const saved = saveLocalQuote(data);
    setFolderHint('', false);
    showToast('Saved on this device', '');
    return saved;
  } finally {
    setSaveBusy(false);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressSignature(file) {
  return prepareSignatureFile(file);
}

function initEditor() {
  val('save-btn').addEventListener('click', (e) => { e.preventDefault(); saveInvoice(); });
  val('print-btn').addEventListener('click', () => {
    syncLoanCopy();
    window.print();
  });
  window.addEventListener('beforeprint', syncLoanCopy);
  if (val('invoiceCompany')) {
    val('invoiceCompany').addEventListener('change', () => {
      applyCompanyBrand(val('invoiceCompany').value);
      syncLoanCopy();
      previewNextInvoiceNo();
    });
  }
  if (val('invoiceDate')) {
    val('invoiceDate').addEventListener('change', () => {
      syncLoanCopy();
      previewNextInvoiceNo();
    });
  }
  ['customerName', 'address', 'make', 'model', 'chassisNr', 'engineNr', 'year', 'engineCapacity', 'country', 'colour',
    'invoiceNo', 'invoiceDate', 'totalAmount', 'preparedByName', 'loanBillTo', 'loanAmount', 'loanLineTotal', 'nic'
  ].forEach((id) => {
    const el = val(id);
    if (el) el.addEventListener('input', syncLoanCopy);
    if (el) el.addEventListener('change', syncLoanCopy);
  });
  async function downloadInvoiceCopy(copy) {
    const live = readForm();
    if (!STAFF.includes(live.preparedByName)) {
      showToast('Select a seller name', 'error');
      return;
    }
    live.id = live.id || 'invoice';
    await downloadPdf(live, copy);
  }
  val('pdf-btn').addEventListener('click', () => downloadInvoiceCopy('customer'));
  if (val('loan-pdf-btn')) {
    val('loan-pdf-btn').addEventListener('click', () => downloadInvoiceCopy('loan'));
  }
  val('delete-btn') && val('delete-btn').addEventListener('click', async () => {
    const id = val('invoiceNo').value.trim() || param('ref');
    if (!id) return;
    if (!confirm('Delete ' + id + '?')) return;
    await apiDelete(id);
    writeLocal(loadLocal().filter((x) => x.id !== id));
    location.href = 'agreements.html';
  });
  ['make', 'model', 'colour'].forEach((id) => {
    val(id).addEventListener('input', () => forceCaps(val(id)));
    val(id).addEventListener('change', () => forceCaps(val(id)));
  });
  val('preparedByName').addEventListener('change', () => {
    const name = (typeof csCanonical === 'function' && csCanonical(val('preparedByName').value)) || val('preparedByName').value;
    if (name) val('preparedByName').value = name;
    val('designation').value = STAFF_ROLES[name] || '';
    setSign('seller', '');
  });
  val('add-line').addEventListener('click', () => {
    lines.push(emptyLine());
    renderLines();
  });
  val('invoice-lines').addEventListener('input', (e) => {
    const input = e.target.closest('[data-field]');
    const row = e.target.closest('tr');
    if (!input || !row) return;
    const i = Number(row.getAttribute('data-i'));
    if (!lines[i]) return;
    const field = input.getAttribute('data-field');
    if (field === 'price' || field === 'total') {
      const shown = formatMoneyTyping(input.value);
      if (input.value !== shown) input.value = shown;
      lines[i][field] = shown;
      if (field === 'price') {
        lines[i].total = String(lines[i].price || '').trim() ? formatMoneyValue(lineAmount(lines[i])) : '';
        const totalEl = row.querySelector('[data-field="total"]');
        if (totalEl) totalEl.value = lines[i].total || '';
      }
      syncGrandTotal();
      syncLoanCopy();
      return;
    }
    lines[i][field] = input.value;
    if (field === 'qty' || field === 'description') {
      if (String(lines[i].price || '').trim()) {
        lines[i].total = formatMoneyValue(lineAmount(lines[i]));
        const totalEl = row.querySelector('[data-field="total"]');
        if (totalEl) totalEl.value = lines[i].total || '';
      }
      syncGrandTotal();
    }
    syncLoanCopy();
  });
  val('invoice-lines').addEventListener('blur', (e) => {
    const input = e.target.closest('[data-field]');
    const row = e.target.closest('tr');
    if (!input || !row) return;
    const field = input.getAttribute('data-field');
    if (field !== 'price' && field !== 'qty' && field !== 'total') return;
    const i = Number(row.getAttribute('data-i'));
    if (!lines[i]) return;
    if ((field === 'price' || field === 'total') && input.value.trim()) {
      lines[i][field] = formatMoney(input.value);
      input.value = lines[i][field];
    }
  }, true);
  if (val('totalAmount')) val('totalAmount').readOnly = true;
  ['loanLineTotal', 'loanAmount'].forEach((id) => {
    const el = val(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.dataset.touched = '1';
      const shown = formatMoneyTyping(el.value);
      if (el.value !== shown) el.value = shown;
    });
    el.addEventListener('blur', () => {
      if (el.value.trim()) el.value = formatMoney(el.value);
    });
  });
  const newLink = document.getElementById('new-invoice-link');
  if (newLink) {
    const company = param('company') || (val('invoiceCompany') && val('invoiceCompany').value) || '';
    if (company) newLink.href = 'invoice.html?company=' + encodeURIComponent(company);
  }
  async function stampSellerSign() {
    const name = val('preparedByName').value;
    if (!name) {
      showToast('Select a seller name', 'error');
      return;
    }
    const saved = localStorage.getItem(SIG_KEY + name) || '';
    if (saved && saved !== sellerSign) {
      setSign('seller', saved);
      return;
    }
    const fallback = await defaultSellerSign(name);
    if (fallback && fallback !== sellerSign) {
      setSign('seller', fallback);
      return;
    }
    const file = val('sellerFile');
    if (file) file.click();
  }

  function bindSignUpload(kind) {
    const uploadBtn = document.querySelector('[data-upload="' + kind + '"]');
    const clearBtn = document.querySelector('[data-clear="' + kind + '"]');
    const file = val(kind === 'buyer' ? 'buyerFile' : 'sellerFile');
    const pad = val(kind === 'buyer' ? 'buyer-pad' : 'seller-pad');
    function pick(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (kind === 'seller') {
        stampSellerSign();
        return;
      }
      if (file) file.click();
    }
    if (uploadBtn) uploadBtn.addEventListener('click', pick);
    if (pad) pad.addEventListener('click', pick);
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSign(kind, '');
      });
    }
    if (file) {
      file.addEventListener('change', async () => {
        const picked = file.files && file.files[0];
        file.value = '';
        if (!picked) return;
        try {
          const dataUrl = await compressSignature(picked);
          if (!dataUrl) throw new Error('empty');
          setSign(kind, dataUrl);
          if (kind === 'seller' && val('preparedByName').value) {
            localStorage.setItem(SIG_KEY + val('preparedByName').value, dataUrl);
          }
        } catch {
          showToast('Signature upload failed. Select an image.', 'error');
        }
      });
    }
  }
  bindSignUpload('seller');
  bindSignUpload('buyer');

  (async () => {
    const ref = param('ref');
    const companyParam = param('company');
    let saved = null;
    try {
      await apiList();
      if (ref) saved = await apiGet(ref);
    } catch {
      saved = ref ? loadLocal().find((x) => x.id === ref) : null;
    }
    if (!saved && ref) saved = loadLocal().find((x) => x.id === ref) || null;
    const staffDefault = (typeof csStaffName === 'function' && csStaffName())
      || localStorage.getItem(PREP_KEY)
      || '';
    if (saved) {
      if (companyParam && !saved.invoiceCompany) saved.invoiceCompany = companyParam;
      fillForm(saved);
    } else {
      fillForm({
        id: '',
        invoiceDate: todayIso(),
        preparedByName: staffDefault,
        invoiceCompany: companyParam || '',
        kind: 'invoice'
      });
      await previewNextInvoiceNo();
    }
    if (!val('preparedByName').value && staffDefault) {
      val('preparedByName').value = staffDefault;
      val('designation').value = STAFF_ROLES[staffDefault] || '';
    }
    if (companyParam) applyCompanyBrand(companyParam);
    // Non-admin: lock seller to logged-in user; only open own invoices
    const me = (typeof csStaffName === 'function' && csStaffName()) || '';
    const admin = typeof csIsAdmin === 'function' && csIsAdmin();
    if (me && !admin) {
      const same = typeof csSamePerson === 'function' ? csSamePerson : (a, b) => a === b;
      if (saved && (saved.preparedByName || saved.person) && !same(saved.preparedByName, me) && !same(saved.person, me)) {
        showToast('That invoice belongs to another user', 'error');
        setTimeout(() => { location.href = 'agreements.html'; }, 900);
        return;
      }
      if (val('preparedByName')) {
        val('preparedByName').value = me;
        val('preparedByName').disabled = true;
        val('designation').value = STAFF_ROLES[me] || '';
      }
    }
    syncLoanCopy();
  })();
}

function homeCloudLink() {
  const name = (location.pathname.split('/').pop() || 'invoice.html').replace(/\.html$/i, '') || 'invoice';
  return 'https://visual-research-study.vercel.app/' + name + location.search;
}

function initPhoneShare() {
  const btn = val('phone-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const url = isHomeCloud() ? location.href.split('#')[0] : homeCloudLink();
    try {
      await navigator.clipboard.writeText(url);
      showToast('Phone data link copied', '');
    } catch {
      showToast(url, '');
    }
  });
}

if (val('invoice-sheet')) {
  const bootCompany = param('company');
  if (bootCompany) applyCompanyBrand(bootCompany);
  initEditor();
}
(function () {
  const el = document.getElementById('year');
  if (!el) return;
  el.removeAttribute('inputmode');
  el.setAttribute('maxlength', '20');
})();
initPhoneShare();
