const STORAGE_KEY = 'genx-quotations';
const PREP_KEY = 'genx-prepared-by';
const STAFF = ['Nipun', 'Isuru', 'Malki', 'Harshani', 'Rakitha'];

const TEXT_FIELDS = [
  'customerName', 'contactNo', 'email',
  'make', 'model', 'year', 'grade', 'chassisNo', 'engineCapacity',
  'fuelType', 'transmission', 'mileage', 'colour', 'origin', 'estimatedArrival',
  'estimatedDeliveryWeeks', 'preparedByName', 'designation'
];

const MONEY_FIELDS = [
  'vehicleCost', 'importCharges', 'registrationCharges', 'otherCharges', 'bookingAdvance'
];

let apiItems = [];
let apiRoot = '';

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function digits(raw) {
  return String(raw || '').replace(/[^\d]/g, '');
}

function formatLkr(raw) {
  const n = Number(digits(raw));
  if (!n) return '';
  return n.toLocaleString('en-LK');
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextRef(items) {
  const year = new Date().getFullYear();
  const prefix = `GENX-${year}-`;
  let max = 0;
  items.forEach((item) => {
    const match = String(item.id || '').match(new RegExp(`^GENX-${year}-(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return prefix + String(max + 1).padStart(4, '0');
}

function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function val(id) {
  return document.getElementById(id);
}

function readForm() {
  const money = {};
  MONEY_FIELDS.forEach((id) => {
    money[id] = digits(val(id).value);
  });
  const total = MONEY_FIELDS
    .filter((id) => id !== 'bookingAdvance')
    .reduce((sum, id) => sum + Number(money[id] || 0), 0);

  const data = {
    id: val('quotationNo').value.trim(),
    quoteDate: val('quoteDate').value || todayIso(),
    origin: val('origin').value.trim() || 'Japan',
    designation: val('designation').value.trim() || 'Sales Executive',
    totalEstimatedPrice: String(total || ''),
    updatedAt: new Date().toISOString()
  };

  TEXT_FIELDS.forEach((id) => {
    data[id] = val(id).value.trim();
  });
  Object.assign(data, money);
  return data;
}

function fillForm(data) {
  val('quotationNo').value = data.id || '';
  val('quoteDate').value = data.quoteDate || todayIso();
  TEXT_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = data[id] || (id === 'origin' ? 'Japan' : id === 'designation' ? 'Sales Executive' : '');
  });
  MONEY_FIELDS.forEach((id) => {
    val(id).value = formatLkr(data[id]);
  });
  updateTotal();
  const toolbar = document.getElementById('toolbar-ref');
  if (toolbar) toolbar.textContent = data.id || 'New';
}

function updateTotal() {
  const total = MONEY_FIELDS
    .filter((id) => id !== 'bookingAdvance')
    .reduce((sum, id) => sum + Number(digits(val(id).value) || 0), 0);
  val('totalEstimatedPrice').value = formatLkr(total);
}

function setStatus(text) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = text;
}

async function apiList() {
  const res = await fetch('/api/quotations', { cache: 'no-store' });
  if (!res.ok) throw new Error('API unavailable');
  const data = await res.json();
  apiRoot = data.root || '';
  apiItems = data.items || [];
  return data;
}

async function apiGet(id) {
  const res = await fetch('/api/quotation?id=' + encodeURIComponent(id), { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.item || null;
}

async function apiSave(payload) {
  const res = await fetch('/api/quotation', {
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
  const res = await fetch('/api/quotation?id=' + encodeURIComponent(id), { method: 'DELETE' });
  return res.ok;
}

function allKnown() {
  const byId = new Map();
  [...apiItems, ...loadLocal()].forEach((item) => {
    if (item && item.id && !byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
}

function saveLocalCopy(data) {
  const next = loadLocal().filter((x) => x.id !== data.id);
  next.unshift(data);
  writeLocal(next.slice(0, 500));
  localStorage.setItem(PREP_KEY, data.preparedByName || '');
}

async function saveQuote() {
  const data = readForm();
  if (!STAFF.includes(data.preparedByName)) {
    setStatus('Prepared By name select කරන්න');
    val('preparedByName').focus();
    return null;
  }

  let items = allKnown();
  try {
    const listed = await apiList();
    items = listed.items || items;
  } catch {
    items = allKnown();
  }

  const existing = items.find((x) => x.id === data.id);
  if (!data.id || (!existing && items.some((x) => x.id === data.id))) {
    data.id = nextRef(items);
  }
  data.createdAt = existing ? existing.createdAt : new Date().toISOString();

  try {
    const saved = await apiSave(data);
    saveLocalCopy(saved);
    val('quotationNo').value = saved.id;
    document.getElementById('toolbar-ref').textContent = saved.id;
    history.replaceState({}, '', `quotation.html?ref=${encodeURIComponent(saved.id)}`);
    setStatus('Saved ' + saved.id + ' → ' + saved.person + ' folder');
    return saved;
  } catch (err) {
    setStatus(err.message || 'Folder save failed. START-QUOTATION.bat run කරන්න.');
    return null;
  }
}

function initEditor() {
  MONEY_FIELDS.forEach((id) => {
    val(id).addEventListener('input', () => {
      val(id).value = formatLkr(val(id).value);
      updateTotal();
    });
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    saveQuote();
  });

  document.getElementById('print-btn').addEventListener('click', async () => {
    const saved = await saveQuote();
    if (saved) window.print();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveQuote();
    }
  });

  (async () => {
    const ref = param('ref');
    const lastName = STAFF.includes(localStorage.getItem(PREP_KEY) || '') ? localStorage.getItem(PREP_KEY) : '';
    let saved = null;
    try {
      await apiList();
      if (ref) saved = await apiGet(ref);
    } catch {
      saved = ref ? loadLocal().find((x) => x.id === ref) : null;
    }
    if (!saved && ref) saved = loadLocal().find((x) => x.id === ref) || null;

    if (saved) {
      fillForm(saved);
    } else {
      fillForm({
        id: '',
        quoteDate: todayIso(),
        origin: 'Japan',
        designation: 'Sales Executive',
        preparedByName: lastName
      });
      if (ref) setStatus('That reference was not found. New quotation opened.');
    }

    if (param('print') === '1') {
      const printed = await saveQuote();
      if (printed) setTimeout(() => window.print(), 250);
    }
  })();
}

function vehicleLine(item) {
  return [item.make, item.model, item.year, item.colour].filter(Boolean).join(' ');
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
}

function initList() {
  const search = document.getElementById('search');
  const summary = document.getElementById('summary');
  const list = document.getElementById('list');
  const hint = document.getElementById('folder-hint');
  const staffFilters = document.getElementById('staff-filters');
  let person = '';

  async function refresh() {
    try {
      const data = await apiList();
      if (hint && data.root) hint.textContent = 'Save වෙන්නේ: ' + data.root;
    } catch {
      apiItems = loadLocal();
      if (hint) hint.textContent = 'Folder API එක open වෙලා නැහැ. START-QUOTATION.bat run කරලා localhost:8080/quotations open කරන්න.';
    }
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const source = apiItems.length ? apiItems : loadLocal();
    const items = source.filter((item) => {
      if (person && item.person !== person && item.preparedByName !== person) return false;
      if (!q) return true;
      return [item.id, item.customerName, item.contactNo, item.email, item.make, item.model, item.year, item.chassisNo, item.preparedByName, item.person]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    summary.textContent = `${items.length} / ${source.length} quotations`;
    if (!items.length) {
      list.innerHTML = `<section class="quote-card"><p>Saved quotations නැහැ. Prepared By name select කරලා Save කරන්න.</p></section>`;
      return;
    }

    list.innerHTML = items.map((item) => `
      <article class="quote-card">
        <div class="quote-card-top">
          <span class="quote-ref">${item.id}</span>
          <span>${item.preparedByName || item.person || ''} · ${item.quoteDate || ''}</span>
        </div>
        <h2>${item.customerName || 'No customer name'}</h2>
        <p>${vehicleLine(item) || 'Vehicle details pending'}</p>
        <p>${[item.contactNo, item.email].filter(Boolean).join(' · ')}</p>
        <p>Total: LKR ${formatLkr(item.totalEstimatedPrice) || '—'}</p>
        <p>Updated ${formatWhen(item.updatedAt)}</p>
        <div class="quote-card-actions">
          <a class="quote-btn quote-btn-save" href="quotation.html?ref=${encodeURIComponent(item.id)}">Open</a>
          <a class="quote-btn quote-btn-ghost" href="quotation.html?ref=${encodeURIComponent(item.id)}&print=1">Print</a>
          <button type="button" class="quote-btn quote-btn-danger" data-del="${item.id}">Delete</button>
        </div>
      </article>
    `).join('');

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

if (document.getElementById('quote-sheet')) initEditor();
if (document.getElementById('list')) initList();
