const STORAGE_KEY = 'cs-agreements-v1';
const PREP_KEY = 'genx-prepared-by';
const SIG_KEY = 'genx-signature-';
const SIG_SCALE_KEY = 'genx-signature-scale-';
const STAFF_ROLES = {
  Nipun: 'Sales Executive',
  Isuru: 'Sales Executive',
  Malki: 'Admin & Marketing',
  Harshani: 'Director',
  Rakitha: 'CEO'
};
const STAFF = Object.keys(STAFF_ROLES);
const TEXT_FIELDS = [
  'customerName', 'address', 'make', 'model', 'chassisNr',
  'engineNr', 'year', 'engineCapacity', 'country', 'preparedByName'
];

let apiItems = [];
let apiRoot = '';
let lastUsingNetwork = false;
let apiBase = '';
let saving = false;
let toastTimer = 0;
let sellerSign = '';
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

function setQuoteNo(id) {
  if (val('invoiceNo')) val('invoiceNo').value = id || '';
  const toolbar = document.getElementById('toolbar-ref');
  if (toolbar) toolbar.textContent = id || 'New';
  const del = val('delete-btn');
  if (del) del.disabled = !id;
}

function lineAmount(line) {
  return parseNum(line && line.qty) * parseNum(line && line.price);
}

function updateTotals() {
  const sum = lines.reduce((total, line) => total + lineAmount(line), 0);
  lines.forEach((line) => {
    line.total = formatMoneyValue(lineAmount(line));
  });
  if (val('totalAmount')) val('totalAmount').value = formatMoneyValue(sum);
  const tbody = val('invoice-lines');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach((row, i) => {
    const totalEl = row.querySelector('[data-field="total"]');
    if (totalEl && lines[i]) totalEl.value = lines[i].total || '';
  });
}

function renderLines() {
  const tbody = val('invoice-lines');
  if (!tbody) return;
  tbody.innerHTML = lines.map((line, i) => `
    <tr data-i="${i}">
      <td><input data-field="description" type="text" maxlength="120" value="${escapeAttr(line.description)}"></td>
      <td class="qty"><input data-field="qty" class="money" type="text" inputmode="decimal" value="${escapeAttr(line.qty)}"></td>
      <td class="amt"><input data-field="price" class="money" type="text" inputmode="decimal" value="${escapeAttr(line.price)}"></td>
      <td class="amt"><input data-field="total" class="money" type="text" readonly value="${escapeAttr(line.total)}"></td>
      <td class="inv-row-act no-print"><button type="button" class="inv-remove" data-remove="${i}" ${lines.length < 2 ? 'disabled' : ''}>×</button></td>
    </tr>
  `).join('');
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
    signatureScale: Number(localStorage.getItem(SIG_SCALE_KEY + val('preparedByName').value) || 56),
    lines: lines.map((line) => ({
      description: String(line.description || '').trim(),
      qty: String(line.qty || '').trim(),
      price: formatMoney(line.price),
      total: formatMoneyValue(lineAmount(line))
    })),
    totalAmount: val('totalAmount').value.trim(),
    makeModel: makeModel(),
    updatedAt: new Date().toISOString()
  };
  TEXT_FIELDS.forEach((id) => { data[id] = val(id) ? val(id).value.trim() : ''; });
  data.make = data.make.toUpperCase();
  data.model = data.model.toUpperCase();
  data.makeModel = makeModel();
  return data;
}

function setSign(dataUrl) {
  sellerSign = dataUrl || '';
  const img = val('sellerPreview');
  const pad = val('seller-pad');
  if (img) img.src = dataUrl || '';
  if (pad) pad.classList.toggle('has-sign', !!dataUrl);
}

function fillForm(data) {
  setQuoteNo(data.id || '');
  val('invoiceDate').value = data.invoiceDate || data.agreementDate || todayIso();
  TEXT_FIELDS.forEach((id) => {
    if (!val(id)) return;
    if (id === 'make' || id === 'model') val(id).value = String(data[id] || '').toUpperCase();
    else val(id).value = data[id] || '';
  });
  if (Array.isArray(data.lines) && data.lines.length) {
    lines = data.lines.map((line) => ({
      description: line.description || '',
      qty: line.qty || '1',
      price: formatMoney(line.price),
      total: formatMoney(line.total)
    }));
  } else {
    lines = [emptyLine(), emptyLine()];
  }
  val('designation').value = STAFF_ROLES[data.preparedByName] || data.designation || '';
  setSign(data.signatureImage || (data.preparedByName ? localStorage.getItem(SIG_KEY + data.preparedByName) : '') || '');
  renderLines();
  updateTotals();
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
    const match = String(item.id || '').match(new RegExp(`^INV-${year}-(\\d+)$`));
    if (match) used.add(Number(match[1]));
  });
  let n = 1;
  while (used.has(n)) n += 1;
  return `INV-${year}-` + String(n).padStart(4, '0');
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
    hint.textContent = 'Save වෙන්නේ: ' + root;
    return;
  }
  if (isHomeCloud() || root === 'cloud') {
    hint.hidden = false;
    hint.textContent = 'මේක lifetime link එක. PC එක on වෙන්න ඕන නැහැ. Save සහ Download PDF මෙතනින්ම.';
    return;
  }
  if (root) {
    hint.hidden = false;
    hint.textContent = 'Office share එක open නැහැ. දැන් save වෙන්නේ: ' + root;
    return;
  }
  hint.hidden = false;
  hint.textContent = 'Saved on this device. Download PDF මෙතනින්.';
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
      triggerBlobDownload(blob, (saved.id || 'invoice') + '.pdf');
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
  history.replaceState({}, '', `invoice.html?ref=${encodeURIComponent(data.id)}`);
  return data;
}

async function saveInvoice() {
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
    history.replaceState({}, '', `invoice.html?ref=${encodeURIComponent(merged.id)}`);
    const onShare = lastUsingNetwork || officeSharePath(apiRoot || merged.pdfPath);
    setFolderHint(apiRoot || merged.pdfPath, onShare);
    if (merged.pdfOk === false) {
      showToast('Folder එකට save උනා, PDF fail: ' + (merged.pdfError || 'retry Save'), 'error');
    } else {
      showToast('Saved successfully', '');
      if (onShare) openSavedFolder(merged.pdfPath);
    }
    return merged;
  } catch {
    const saved = saveLocalQuote(data);
    setFolderHint('', false);
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

function knockOutSignatureBackground(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const original = new Uint8ClampedArray(image.data);
  const d = image.data;
  const w = canvas.width;
  const h = canvas.height;

  function sample(x, y) {
    const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  }

  const corners = [
    ...sample(2, 2), ...sample(w - 3, 2), ...sample(2, h - 3), ...sample(w - 3, h - 3),
    ...sample(Math.floor(w / 2), 2), ...sample(Math.floor(w / 2), h - 3)
  ];
  const bg = [
    (corners[0] + corners[3] + corners[6] + corners[9] + corners[12] + corners[15]) / 6,
    (corners[1] + corners[4] + corners[7] + corners[10] + corners[13] + corners[16]) / 6,
    (corners[2] + corners[5] + corners[8] + corners[11] + corners[14] + corners[17]) / 6
  ];

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  const paperCut = 40;
  const inkFull = 88;
  const bgLuma = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const paperLike = a < 16
      || dist < paperCut
      || (luma > 210 && chroma < 18)
      || (Math.abs(luma - bgLuma) < 16 && chroma < 22);

    if (paperLike) {
      d[i + 3] = 0;
      continue;
    }

    let t = (dist - paperCut) / (inkFull - paperCut);
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t);
    const alpha = Math.round(Math.max(t, chroma / 90, 0.55) * (a / 255) * 255);
    if (alpha < 18) {
      d[i + 3] = 0;
      continue;
    }

    d[i + 3] = alpha;
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  if (maxX < minX || maxY < minY) {
    image.data.set(original);
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  ctx.putImageData(image, 0, 0);
  const pad = 8;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const cw = Math.min(w - x, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - y, maxY - minY + 1 + pad * 2);
  const cropped = document.createElement('canvas');
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext('2d').drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
  return cropped;
}

function compressSignature(file) {
  return fileToDataUrl(file).then((dataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 520 / img.width, 180 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(knockOutSignatureBackground(canvas).toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  }));
}

function initEditor() {
  val('save-btn').addEventListener('click', (e) => { e.preventDefault(); saveInvoice(); });
  val('print-btn').addEventListener('click', () => window.print());
  val('pdf-btn').addEventListener('click', async () => {
    updateTotals();
    const live = readForm();
    if (!STAFF.includes(live.preparedByName)) {
      showToast('Seller name select කරන්න', 'error');
      return;
    }
    live.id = live.id || 'invoice';
    await downloadPdf(live);
  });
  val('delete-btn').addEventListener('click', async () => {
    const id = val('invoiceNo').value.trim() || param('ref');
    if (!id) return;
    if (!confirm(id + ' delete කරනවද?')) return;
    await apiDelete(id);
    writeLocal(loadLocal().filter((x) => x.id !== id));
    location.href = 'agreements.html';
  });
  ['make', 'model'].forEach((id) => {
    val(id).addEventListener('input', () => forceCaps(val(id)));
    val(id).addEventListener('change', () => forceCaps(val(id)));
  });
  val('preparedByName').addEventListener('change', () => {
    const name = val('preparedByName').value;
    val('designation').value = STAFF_ROLES[name] || '';
    if (name) setSign(localStorage.getItem(SIG_KEY + name) || sellerSign);
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
    if (field === 'price') {
      const shown = formatMoneyTyping(input.value);
      if (input.value !== shown) input.value = shown;
      lines[i].price = shown;
      updateTotals();
      return;
    }
    lines[i][field] = input.value;
    if (field !== 'description') updateTotals();
  });
  val('invoice-lines').addEventListener('blur', (e) => {
    const input = e.target.closest('[data-field]');
    const row = e.target.closest('tr');
    if (!input || !row) return;
    const field = input.getAttribute('data-field');
    if (field !== 'price' && field !== 'qty') return;
    const i = Number(row.getAttribute('data-i'));
    if (!lines[i]) return;
    if (field === 'price' && input.value.trim()) {
      lines[i].price = formatMoney(input.value);
      input.value = lines[i].price;
    }
    updateTotals();
  }, true);
  val('invoice-lines').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn || lines.length < 2) return;
    lines.splice(Number(btn.getAttribute('data-remove')), 1);
    renderLines();
    updateTotals();
  });
  const uploadBtn = document.querySelector('[data-upload="seller"]');
  const file = val('sellerFile');
  const pad = val('seller-pad');
  function pickSellerFile(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (file) file.click();
  }
  if (uploadBtn && file) uploadBtn.addEventListener('click', pickSellerFile);
  if (pad && file) pad.addEventListener('click', pickSellerFile);
  if (file) {
    file.addEventListener('change', async () => {
      const picked = file.files && file.files[0];
      file.value = '';
      if (!picked) return;
      try {
        const dataUrl = await compressSignature(picked);
        if (!dataUrl) throw new Error('empty');
        setSign(dataUrl);
        if (val('preparedByName').value) {
          localStorage.setItem(SIG_KEY + val('preparedByName').value, dataUrl);
        }
      } catch {
        showToast('Signature upload failed. Image එකක් select කරන්න.', 'error');
      }
    });
  }

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
        invoiceDate: todayIso(),
        preparedByName: localStorage.getItem(PREP_KEY) || '',
        kind: 'invoice'
      });
    }
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

if (val('invoice-sheet')) initEditor();
initPhoneShare();
