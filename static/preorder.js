const STORAGE_KEY = 'cs-agreements-v1';
const PREP_KEY = 'genx-prepared-by';
const SIG_KEY = 'genx-signature-';
const STAFF_ROLES = {
  Nipun: 'Sales Executive',
  Isuru: 'Sales Executive',
  Malki: 'Admin & Marketing',
  Harshani: 'Director',
  Rakitha: 'CEO'
};
const STAFF = Object.keys(STAFF_ROLES);
const TEXT_FIELDS = [
  'customerId', 'customerName', 'address', 'telephone', 'nic',
  'makeModel', 'year', 'colour', 'trim', 'mileage', 'auctionGrade',
  'transfereeName', 'transfereeNic', 'deliveryWeeks', 'exchangeRate',
  'preparedByName'
];
const MONEY_FIELDS = [
  'advanceAmount', 'advancePaid', 'vehicleCost', 'vehiclePaid',
  'importCharges', 'importPaid', 'otherCharges', 'otherPaid'
];
const DOC_FIELDS = [];
const PAID_FIELDS = ['advancePaid', 'vehiclePaid', 'importPaid', 'otherPaid'];
const AMOUNT_FIELDS = ['vehicleCost', 'importCharges', 'otherCharges'];

let apiItems = [];
let apiRoot = '';
let apiBase = '';
let saving = false;
let toastTimer = 0;
let sellerSign = '';
let buyerSign = '';
let buyerWitness = '';
let sellerWitness = '';

function val(id) {
  return document.getElementById(id);
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

function prettyDate(iso) {
  const text = String(iso || '').slice(0, 10);
  const d = new Date(text + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return text;
  const day = d.getDate();
  const suf = (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
      : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  const month = d.toLocaleString('en-GB', { month: 'long' });
  return `${day}${suf} ${month} ${d.getFullYear()}`;
}

function updateIntro() {
  const el = val('agree-intro');
  if (!el) return;
  const pretty = prettyDate(val('agreementDate').value || todayIso());
  el.textContent = `This agreement (“Agreement”) is entered into on this ${pretty}, between the undersigned Buyer and the Seller/Facilitator (CarSwitch (Pvt) Ltd), collectively referred to as the “Parties.”`;
}

function updateTotals() {
  const amount = AMOUNT_FIELDS.reduce((sum, id) => sum + parseNum(val(id) && val(id).value), 0);
  const paid = PAID_FIELDS.reduce((sum, id) => sum + parseNum(val(id) && val(id).value), 0);
  if (val('totalAmount')) val('totalAmount').value = formatMoneyValue(amount);
  if (val('totalPaid')) val('totalPaid').value = formatMoneyValue(paid);
  if (val('balancePayment')) val('balancePayment').value = formatMoneyValue(amount - paid);
}

function setQuoteNo(id) {
  if (val('agreementNo')) val('agreementNo').value = id || '';
  const toolbar = document.getElementById('toolbar-ref');
  if (toolbar) toolbar.textContent = id || 'New';
  const del = val('delete-btn');
  if (del) del.disabled = !id;
}

function warrantyValue() {
  const picked = document.querySelector('input[name="warranty"]:checked');
  return picked ? picked.value : 'No';
}

function readForm() {
  const data = {
    id: val('agreementNo').value.trim(),
    kind: 'preorder',
    agreementDate: val('agreementDate').value || todayIso(),
    designation: STAFF_ROLES[val('preparedByName').value] || '',
    signatureImage: sellerSign,
    buyerSignature: buyerSign,
    buyerWitness: buyerWitness,
    sellerWitness: sellerWitness,
    payBeforeShipment: val('payBeforeShipment') && val('payBeforeShipment').checked ? 'Yes' : 'No',
    payAfterBl: val('payAfterBl') && val('payAfterBl').checked ? 'Yes' : 'No',
    totalAmount: val('totalAmount').value.trim(),
    totalPaid: val('totalPaid').value.trim(),
    balancePayment: val('balancePayment').value.trim(),
    updatedAt: new Date().toISOString()
  };
  TEXT_FIELDS.forEach((id) => { data[id] = val(id) ? val(id).value.trim() : ''; });
  MONEY_FIELDS.forEach((id) => { data[id] = val(id) ? val(id).value.trim() : ''; });
  return data;
}

function setSign(kind, dataUrl) {
  const map = {
    buyer: { img: 'buyerPreview', pad: 'buyer-pad', set: (v) => { buyerSign = v; } },
    seller: { img: 'sellerPreview', pad: 'seller-pad', set: (v) => { sellerSign = v; } },
    buyerWitness: { img: 'buyerWitnessPreview', pad: 'buyer-w-pad', set: (v) => { buyerWitness = v; } },
    sellerWitness: { img: 'sellerWitnessPreview', pad: 'seller-w-pad', set: (v) => { sellerWitness = v; } }
  };
  const spec = map[kind] || map.seller;
  spec.set(dataUrl || '');
  const img = val(spec.img);
  const pad = val(spec.pad);
  if (img) img.src = dataUrl || '';
  if (pad) pad.classList.toggle('has-sign', !!dataUrl);
}

function fillForm(data) {
  setQuoteNo(data.id || '');
  val('agreementDate').value = data.agreementDate || todayIso();
  TEXT_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = data[id] || '';
  });
  MONEY_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = formatMoney(data[id]);
  });
  DOC_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = data[id] || '';
  });
  if (val('payBeforeShipment')) val('payBeforeShipment').checked = data.payBeforeShipment === 'Yes';
  if (val('payAfterBl')) val('payAfterBl').checked = data.payAfterBl === 'Yes';
  if (val('exchangeRate') && !val('exchangeRate').value) val('exchangeRate').value = data.exchangeRate || '2.17';
  if (val('deliveryWeeks') && !data.deliveryWeeks) val('deliveryWeeks').value = '10';
  val('designation').value = STAFF_ROLES[data.preparedByName] || data.designation || '';
  setSign('seller', data.signatureImage || (data.preparedByName ? localStorage.getItem(SIG_KEY + data.preparedByName) : '') || '');
  setSign('buyer', data.buyerSignature || '');
  setSign('buyerWitness', data.buyerWitness || '');
  setSign('sellerWitness', data.sellerWitness || '');
  updateTotals();
  updateIntro();
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

function nextRef(items) {
  const year = new Date().getFullYear();
  const used = new Set();
  items.forEach((item) => {
    const match = String(item.id || '').match(new RegExp(`^PO-${year}-(\\d+)$`));
    if (match) used.add(Number(match[1]));
  });
  let n = 1;
  while (used.has(n)) n += 1;
  return `PO-${year}-` + String(n).padStart(4, '0');
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
  throw lastErr || new Error('Folder API එක open වෙලා නැහැ.');
}

async function apiList() {
  const res = await apiFetch('/api/agreements', { cache: 'no-store' });
  if (!res.ok) throw new Error('API unavailable');
  const data = await res.json();
  apiRoot = data.root || '';
  apiItems = data.items || [];
  return data;
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

async function postAgreementPdf(saved) {
  const res = await fetch('/api/agreement-pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved)
  });
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok && type.indexOf('pdf') !== -1) return res.blob();
  return null;
}

async function downloadPdf(saved) {
  showToast('PDF හදනවා...', 'wait');
  try {
    const blob = await postAgreementPdf(saved);
    if (blob && blob.size > 800) {
      triggerBlobDownload(blob, (saved.id || 'agreement') + '.pdf');
      showToast('PDF downloaded', '');
      return;
    }
  } catch {
    /* print fallback */
  }
  showToast('Print → Save as PDF', '');
  window.print();
}

function saveLocalQuote(data) {
  if (!data.id) data.id = nextRef(allKnown());
  data.updatedAt = new Date().toISOString();
  data.createdAt = data.createdAt || data.updatedAt;
  data.person = data.preparedByName;
  data.designation = STAFF_ROLES[data.preparedByName] || '';
  saveLocalCopy(data);
  setQuoteNo(data.id);
  history.replaceState({}, '', `preorder.html?ref=${encodeURIComponent(data.id)}`);
  return data;
}

async function saveAgreement() {
  if (saving) return null;
  if (!STAFF.includes(val('preparedByName').value)) {
    showToast('Seller name select කරන්න', 'error');
    val('preparedByName').focus();
    return null;
  }
  setSaveBusy(true);
  showToast('Saving...', 'wait');
  updateTotals();
  const data = readForm();
  let items = allKnown();
  try {
    const listed = await apiList();
    items = listed.items || items;
  } catch {
    items = allKnown();
  }
  const existing = items.find((x) => x.id === data.id);
  if (!existing) data.id = '';
  data.createdAt = existing ? existing.createdAt : new Date().toISOString();
  try {
    const saved = await apiSave(data);
    const merged = Object.assign({}, saved, data, { id: saved.id });
    saveLocalCopy(merged);
    setQuoteNo(merged.id);
    history.replaceState({}, '', `preorder.html?ref=${encodeURIComponent(merged.id)}`);
    const onShare = /\\\\carswitch\\/i.test(String(apiRoot || merged.pdfPath || ''));
    showToast('Saved successfully', '');
    return merged;
  } catch {
    const saved = saveLocalQuote(data);
    showToast('Saved successfully', '');
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

function bindUpload(btn, file, kind) {
  if (!btn || !file) return;
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const picked = file.files && file.files[0];
    file.value = '';
    if (!picked) return;
    try {
      const dataUrl = await fileToDataUrl(picked);
      setSign(kind, dataUrl);
      if (kind === 'seller' && val('preparedByName').value) {
        localStorage.setItem(SIG_KEY + val('preparedByName').value, dataUrl);
      }
    } catch {
      showToast('Signature upload failed', 'error');
    }
  });
}

function initEditor() {
  val('save-btn').addEventListener('click', (e) => { e.preventDefault(); saveAgreement(); });
  val('print-btn').addEventListener('click', () => window.print());
  val('pdf-btn').addEventListener('click', async () => {
    updateTotals();
    const live = readForm();
    if (!STAFF.includes(live.preparedByName)) {
      showToast('Seller name select කරන්න', 'error');
      return;
    }
    live.id = live.id || 'preorder';
    await downloadPdf(live);
  });
  val('delete-btn').addEventListener('click', async () => {
    const id = val('agreementNo').value.trim() || param('ref');
    if (!id) return;
    if (!confirm(id + ' delete කරනවද?')) return;
    await apiDelete(id);
    writeLocal(loadLocal().filter((x) => x.id !== id));
    location.href = 'agreements.html';
  });
  val('preparedByName').addEventListener('change', () => {
    const name = val('preparedByName').value;
    val('designation').value = STAFF_ROLES[name] || '';
    if (name) setSign('seller', localStorage.getItem(SIG_KEY + name) || sellerSign);
  });
  val('agreementDate').addEventListener('input', updateIntro);
  MONEY_FIELDS.forEach((id) => {
    const el = val(id);
    if (!el) return;
    el.addEventListener('input', updateTotals);
    el.addEventListener('blur', () => {
      if (el.value.trim()) el.value = formatMoney(el.value);
      updateTotals();
    });
  });
  const fileIds = {
    seller: 'sellerFile',
    buyer: 'buyerFile',
    buyerWitness: 'buyerWitnessFile',
    sellerWitness: 'sellerWitnessFile'
  };
  document.querySelectorAll('[data-upload]').forEach((btn) => {
    const kind = btn.getAttribute('data-upload');
    bindUpload(btn, val(fileIds[kind]), kind);
  });

  (async () => {
    const ref = param('ref');
    let saved = null;
    try {
      await apiList();
      if (ref) saved = await apiGet(ref);
    } catch {
      saved = ref ? loadLocal().find((x) => x.id === ref) : null;
    }
    if (!saved && ref) saved = loadLocal().find((x) => x.id === ref) || null;
    if (saved) fillForm(saved);
    else {
      fillForm({
        id: '',
        agreementDate: todayIso(),
        preparedByName: localStorage.getItem(PREP_KEY) || '',
        exchangeRate: '2.17',
        deliveryWeeks: '10',
        kind: 'preorder'
      });
    }
  })();
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
}

function initList() {
  const search = val('search');
  const summary = val('summary');
  const list = val('agree-list');
  const hint = val('folder-hint');
  const staffFilters = val('staff-filters');
  let person = '';

  async function refresh() {
    try {
      const data = await apiList();
      if (hint && data.root) {
        hint.textContent = data.root === 'cloud' || isHomeCloud()
          ? 'Saved online. PC එක on වෙන්න ඕන නැහැ.'
          : (/\\\\carswitch\\/i.test(String(data.root)) ? 'Save වෙන්නේ: ' + data.root : 'Saved');
      }
    } catch {
      apiItems = loadLocal();
      if (hint) hint.textContent = 'Saved on this device. Download PDF මෙතනින්.';
    }
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const source = allKnown();
    const items = source.filter((item) => {
      if (person && item.person !== person && item.preparedByName !== person) return false;
      if (!q) return true;
      return [item.id, item.kind, item.customerName, item.telephone, item.nic, item.makeModel, item.chassisNr, item.preparedByName]
        .join(' ').toLowerCase().includes(q);
    });
    summary.textContent = `${items.length} / ${source.length} agreements`;
    if (!items.length) {
      list.innerHTML = '<section class="quote-card"><p>Saved agreements නැහැ. Seller name select කරලා Save කරන්න.</p></section>';
      return;
    }
    list.innerHTML = items.map((item) => {
      const pre = item.kind === 'preorder' || String(item.id || '').startsWith('PO-');
      const page = pre ? 'preorder.html' : 'agreement.html';
      const label = pre ? 'Pre-Order' : 'Sales';
      return `
      <article class="quote-card">
        <div class="quote-card-top">
          <span class="quote-ref">${item.id}</span>
          <span>${label} · ${item.preparedByName || item.person || ''} · ${item.agreementDate || ''}</span>
        </div>
        <p>${item.customerName || '—'} · ${item.makeModel || ''}</p>
        <p>Total: LKR ${item.totalAmount || '—'} · ${formatWhen(item.updatedAt)}</p>
        <div class="quote-card-actions">
          <a class="quote-btn quote-btn-save" href="${page}?ref=${encodeURIComponent(item.id)}">Open</a>
          <button type="button" class="quote-btn quote-btn-ghost" data-pdf="${item.id}">PDF</button>
          <button type="button" class="quote-btn quote-btn-danger" data-del="${item.id}">Delete</button>
        </div>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-pdf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-pdf');
        const item = source.find((x) => x.id === id) || loadLocal().find((x) => x.id === id);
        if (item) await downloadPdf(item);
      });
    });
    list.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        if (!confirm(id + ' delete කරනවද?')) return;
        await apiDelete(id);
        writeLocal(loadLocal().filter((x) => x.id !== id));
        await refresh();
      });
    });
  }

  staffFilters.querySelectorAll('.staff-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      person = btn.getAttribute('data-person') || '';
      staffFilters.querySelectorAll('.staff-chip').forEach((el) => el.classList.toggle('selected', el === btn));
      render();
    });
  });
  search.addEventListener('input', render);
  refresh();
}

function homeCloudLink() {
  const name = (location.pathname.split('/').pop() || 'preorder.html').replace(/\.html$/i, '') || 'preorder';
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

if (val('preorder-sheet')) initEditor();
initPhoneShare();
