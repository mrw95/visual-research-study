const STORAGE_KEY = 'genx-quotations';
const STORAGE_RESET = 'cs-start-1';
const PREP_KEY = 'genx-prepared-by';
const SIG_KEY = 'genx-signature-';
const SIG_SCALE_KEY = 'genx-signature-scale-';
const SIG_X_KEY = 'genx-signature-x-';
const SIGN_MIN = 28;
const SIGN_MAX = 96;
const SIGN_DEFAULT = 48;
const STAFF_ROLES = {
  Nipun: 'Sales Executive',
  Isuru: 'Sales Executive',
  Malki: 'Admin & Marketing',
  Harshani: 'Director',
  Rakitha: 'CEO'
};
const STAFF = Object.keys(STAFF_ROLES);

const MODELS_BY_MAKE = {
  Toyota: ['Aqua', 'Prius', 'Prius Alpha', 'Axio', 'Allion', 'Premio', 'Corolla', 'Corolla Fielder', 'Corolla Cross', 'Camry', 'Vitz', 'Yaris', 'Passo', 'Raize', 'Rush', 'CHR', 'Harrier', 'RAV4', 'Land Cruiser', 'Prado', 'Hilux', 'Hiace', 'Sienta', 'Noah', 'Voxy', 'Esquire', 'Alphard', 'Vellfire', 'Fortuner', 'Crown', 'Mark X', 'Wish', 'Tank', 'Roomy', 'Probox'],
  Honda: ['Fit', 'Vezel', 'Grace', 'Civic', 'Accord', 'Freed', 'Shuttle', 'Jade', 'CR-V', 'HR-V', 'Stepwgn', 'Odyssey', 'N-Box', 'N-WGN', 'Insight', 'City', 'WR-V'],
  Nissan: ['Note', 'Note e-Power', 'Leaf', 'Tiida', 'Sylphy', 'Sunny', 'X-Trail', 'Dualis', 'Juke', 'March', 'Dayz', 'Serena', 'NV200', 'Skyline', 'Teana', 'Qashqai'],
  Mazda: ['Axela', 'Atenza', 'Demio', 'CX-3', 'CX-5', 'CX-8', 'CX-30', 'Premacy', 'Flair', 'Roadster'],
  Suzuki: ['Swift', 'Wagon R', 'Alto', 'Spacia', 'Hustler', 'Jimny', 'Vitara', 'Baleno', 'Celerio', 'Every', 'Carry', 'Ignis', 'Solio'],
  Mitsubishi: ['Outlander', 'Outlander PHEV', 'Eclipse Cross', 'ASX', 'RVR', 'Delica', 'Pajero', 'Pajero Mini', 'eK Wagon', 'Mirage', 'Lancer', 'Triton'],
  Subaru: ['Impreza', 'Forester', 'XV', 'Crosstrek', 'Legacy', 'Levorg', 'Outback', 'WRX', 'BRZ'],
  Daihatsu: ['Mira', 'Move', 'Tanto', 'Cast', 'Rocky', 'Thor', 'Hijet', 'Atrai', 'Copen', 'Wake'],
  Lexus: ['CT', 'IS', 'ES', 'NX', 'RX', 'UX', 'LS', 'LX'],
  BMW: ['1 Series', '2 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'iX'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'V-Class']
};

function fillDatalist(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = values.map((value) => `<option value="${value}"></option>`).join('');
}

function matchedMake(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  return Object.keys(MODELS_BY_MAKE).find((name) => name.toLowerCase() === key) || '';
}

function fillModelSuggestions() {
  const make = matchedMake(val('make') ? val('make').value : '');
  fillDatalist('model-list', make ? MODELS_BY_MAKE[make] : []);
}

function setDesignation() {
  const name = val('preparedByName') ? val('preparedByName').value : '';
  if (val('designation')) val('designation').value = STAFF_ROLES[name] || '';
}

function clampSign(n) {
  const size = Number(n);
  if (!Number.isFinite(size)) return SIGN_DEFAULT;
  return Math.max(SIGN_MIN, Math.min(SIGN_MAX, Math.round(size)));
}

function currentSignScale() {
  const stage = val('sign-stage');
  const raw = stage && stage.style.getPropertyValue('--sign-h');
  return clampSign(parseInt(raw, 10) || SIGN_DEFAULT);
}

function applySignScale(size) {
  const stage = val('sign-stage');
  if (!stage) return;
  stage.style.setProperty('--sign-h', clampSign(size) + 'px');
}

function currentSignX() {
  const stage = val('sign-stage');
  return parseInt(stage && stage.style.left, 10) || 0;
}

function applySignX(x) {
  const pad = val('sign-pad');
  const stage = val('sign-stage');
  if (!pad || !stage) return;
  const max = Math.max(0, pad.clientWidth - (stage.offsetWidth || 0));
  const next = Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
  stage.style.left = next + 'px';
}

function persistSignLayout() {
  const name = val('preparedByName') && val('preparedByName').value;
  if (!name) return;
  localStorage.setItem(SIG_SCALE_KEY + name, String(currentSignScale()));
  localStorage.setItem(SIG_X_KEY + name, String(currentSignX()));
}

function signatureValue() {
  const img = val('signaturePreview');
  const src = img && img.getAttribute('src');
  return src && src.indexOf('data:image/') === 0 ? src : '';
}

function vehiclePhotoValue() {
  const img = val('vehiclePhotoPreview');
  const src = img && img.getAttribute('src');
  return src && src.indexOf('data:image/') === 0 ? src : '';
}

function setVehiclePhoto(dataUrl) {
  const img = val('vehiclePhotoPreview');
  const box = val('vehicle-photo');
  if (!img || !box) return;
  if (dataUrl && dataUrl.indexOf('data:image/') === 0) {
    img.src = dataUrl;
    box.classList.add('has-photo');
  } else {
    img.removeAttribute('src');
    box.classList.remove('has-photo');
  }
}

function compressVehiclePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 720 / img.width, 540 / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Vehicle photo read failed'));
    };
    img.src = url;
  });
}

function initVehiclePhoto() {
  const box = val('vehicle-photo');
  const file = val('vehiclePhotoFile');
  const upload = val('vehicle-photo-upload');
  if (!box || !file || !upload) return;

  function pick() {
    file.click();
  }

  upload.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pick();
  });
  box.addEventListener('click', () => pick());
  box.addEventListener('dblclick', pick);

  file.addEventListener('change', async () => {
    const picked = file.files && file.files[0];
    file.value = '';
    if (!picked) return;
    try {
      setVehiclePhoto(await compressVehiclePhoto(picked));
    } catch {
      showToast('Vehicle photo upload failed. Image එකක් select කරන්න.', 'error');
    }
  });
}

function setSignature(dataUrl, scale, x) {
  const img = val('signaturePreview');
  const pad = val('sign-pad');
  if (!img || !pad) return;
  if (dataUrl) {
    img.src = dataUrl;
    pad.classList.add('has-sign');
    pad.classList.remove('is-editing');
    applySignScale(scale != null ? scale : currentSignScale());
    const place = () => applySignX(x != null ? x : currentSignX());
    if (img.complete) place();
    else img.onload = place;
  } else {
    img.removeAttribute('src');
    pad.classList.remove('has-sign', 'is-editing');
  }
}

function loadPersonSignature() {
  const name = val('preparedByName').value;
  if (!name) {
    setSignature('');
    return;
  }
  setSignature(
    localStorage.getItem(SIG_KEY + name) || '',
    localStorage.getItem(SIG_SCALE_KEY + name) || SIGN_DEFAULT,
    localStorage.getItem(SIG_X_KEY + name) || 0
  );
}

function compressSignature(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 520 / img.width, 180 / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(knockOutSignatureBackground(canvas).toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Signature image read failed'));
    };
    img.src = url;
  });
}

function knockOutSignatureBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
      || (luma > 188 && chroma < 24)
      || (Math.abs(luma - bgLuma) < 20 && chroma < 30);

    if (paperLike) {
      d[i + 3] = 0;
      continue;
    }

    let t = (dist - paperCut) / (inkFull - paperCut);
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t);
    const alpha = Math.round(Math.max(t, chroma / 90) * (a / 255) * 255);
    if (alpha < 18) {
      d[i + 3] = 0;
      continue;
    }

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = alpha;

    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  ctx.putImageData(image, 0, 0);
  if (maxX < minX || maxY < minY) return canvas;

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

function initSignatureUpload() {
  const pad = val('sign-pad');
  const file = val('signatureFile');
  const upload = val('sign-upload');
  if (!pad || !file || !upload) return;

  function pickFile() {
    file.click();
  }

  upload.addEventListener('click', pickFile);
  val('sign-stage').addEventListener('dblclick', pickFile);
  pad.addEventListener('click', (e) => {
    if (!pad.classList.contains('has-sign') && !e.target.closest('.sign-handle')) pickFile();
  });

  file.addEventListener('change', async () => {
    const picked = file.files && file.files[0];
    file.value = '';
    if (!picked) return;
    try {
      const dataUrl = await compressSignature(picked);
      setSignature(dataUrl, currentSignScale(), currentSignX());
      persistSignLayout();
      const name = val('preparedByName').value;
      if (name) localStorage.setItem(SIG_KEY + name, dataUrl);
    } catch {
      setStatus('Signature upload failed. Image එකක් select කරන්න.');
    }
  });

  let drag = null;
  const stage = val('sign-stage');

  function setSignEditing(on) {
    pad.classList.toggle('is-editing', !!on);
  }

  document.addEventListener('pointerdown', (e) => {
    if (!pad.contains(e.target)) setSignEditing(false);
  });

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sign-handle')) return;
    e.preventDefault();
    setSignEditing(true);
    drag = { type: 'move', startX: e.clientX, left: currentSignX() };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || drag.type !== 'move') return;
    applySignX(drag.left + (e.clientX - drag.startX));
  });
  stage.addEventListener('pointerup', () => {
    if (!drag) return;
    persistSignLayout();
    drag = null;
  });

  pad.querySelectorAll('.sign-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSignEditing(true);
      drag = {
        type: 'scale',
        startY: e.clientY,
        startH: currentSignScale(),
        corner: handle.getAttribute('data-handle')
      };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag || drag.type !== 'scale') return;
      const goingUp = drag.corner.indexOf('n') === 0;
      const delta = goingUp ? drag.startY - e.clientY : e.clientY - drag.startY;
      applySignScale(drag.startH + delta);
    });
    handle.addEventListener('pointerup', () => {
      if (!drag) return;
      persistSignLayout();
      drag = null;
    });
  });
}

const TEXT_FIELDS = [
  'customerName', 'contactNo', 'email',
  'make', 'model', 'year', 'grade', 'engineCapacity',
  'fuelType', 'transmission', 'mileage', 'colour', 'origin', 'estimatedArrival',
  'preparedByName', 'designation'
];

const PRICE_INPUTS = ['cifJpy', 'lcJpy', 'balJpy', 'balLkr', 'customsDuty', 'clearingCharges', 'agencyFee'];
const RATE_FIELDS = ['lcRate', 'balRate'];

let apiItems = [];
let apiRoot = '';
let apiBase = '';
let saving = false;
let toastTimer = 0;

function showToast(text, kind) {
  const el = document.getElementById('save-toast');
  setStatus(text);
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.className = 'save-toast no-print' + (kind ? ' is-' + kind : '');
  clearTimeout(toastTimer);
  if (kind !== 'wait') {
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }
}

function setSaveBusy(on) {
  saving = on;
  const btn = document.getElementById('save-btn');
  const printBtn = document.getElementById('print-btn');
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? 'Saving...' : 'Save';
  }
  if (printBtn) printBtn.disabled = on;
}

function isHomeCloud() {
  return location.hostname.endsWith('vercel.app');
}

function apiCandidates() {
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  const list = [];
  if (apiBase) list.push(apiBase);
  list.push('');
  if (isHomeCloud()) return list;
  if (local) {
    ['http://127.0.0.1:8090', 'http://localhost:8090'].forEach((base) => {
      if (base !== location.origin && !list.includes(base)) list.push(base);
    });
  }
  return list;
}

async function apiFetch(path, options) {
  let lastErr = null;
  for (const base of apiCandidates()) {
    try {
      const res = await fetch(base + path, options);
      if (res.status === 401) {
        location.href = '/quote-login?next=' + encodeURIComponent(location.pathname + location.search);
        throw new Error('Login required');
      }
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (type.indexOf('application/json') !== -1) {
        apiBase = base;
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Folder API එක open වෙලා නැහැ. START-QUOTATION.bat run කරන්න.');
}

function currentQuotePath() {
  const file = location.pathname.split('/').pop() || 'quotation.html';
  return file + location.search;
}

function fallbackAccess() {
  const path = currentQuotePath();
  const port = location.port || '8090';
  const urls = [`https://visual-research-study.vercel.app/${path}`];
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    urls.push(`http://192.168.1.15:${port}/${path}`);
  } else if (!location.hostname.endsWith('vercel.app')) {
    urls.push(`${location.origin}/${path}`);
  }
  return { ok: true, urls, public: '', pin: '9292', vercel: 'https://visual-research-study.vercel.app' };
}

async function loadAccessUrls() {
  try {
    const res = await apiFetch('/api/access-urls?path=' + encodeURIComponent(currentQuotePath()));
    const data = await res.json();
    if (data && data.urls && data.urls.length) return data;
  } catch {
    /* use same-WiFi IP if the new API is not running yet */
  }
  return fallbackAccess();
}

function fillPhoneSheet(sheet, data) {
  const urls = (data && data.urls) || [];
  const pin = data && data.pin
    ? `<p>Mobile data PIN: <strong>${data.pin}</strong></p>`
    : '';
  const first = urls[0] || '';
  const qr = first
    ? `<img class="phone-qr" alt="QR" width="220" height="220" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(first)}">`
    : '';
  sheet.innerHTML = `
    <div class="phone-sheet-inner">
      <h2>Phone / Tab</h2>
      <p><strong>Mobile data / ගෙදර:</strong> උඩින් පේන https link එක. PIN 9292.</p>
      <p>Office WiFi IP link එක data වලින් open වෙන්නේ නැහැ.</p>
      ${qr}
      ${urls.map((url) => `<a class="phone-url" href="${url}">${url}</a>`).join('')}
      ${pin}
      <div class="phone-sheet-actions">
        <button type="button" class="quote-btn quote-btn-save" id="phone-copy"${first ? '' : ' disabled'}>Copy link</button>
        <button type="button" class="quote-btn quote-btn-ghost" id="phone-close">Close</button>
      </div>
    </div>`;
  const copyBtn = sheet.querySelector('#phone-copy');
  if (copyBtn && first) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(first);
        copyBtn.textContent = 'Copied';
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
    });
  }
  const closeBtn = sheet.querySelector('#phone-close');
  if (closeBtn) closeBtn.addEventListener('click', () => { sheet.hidden = true; });
}

function initPhoneShare() {
  const btn = document.getElementById('phone-btn');
  const sheet = document.getElementById('phone-sheet');
  const hint = document.getElementById('lan-hint');
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isHomeCloud() && btn) {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        showToast('Home link copied', '');
      } catch {
        showToast(location.href, '');
      }
    });
    if (hint) {
      hint.hidden = false;
      hint.innerHTML = 'ගෙදර: මේ link එකෙන් quotation හදන්න. Office PC එක on වෙන්න ඕනේ නැහැ.';
    }
    return;
  }

  async function refreshHint() {
    if (!hint || !local) return;
    try {
      const data = await loadAccessUrls();
      const url = (data.urls || [])[0];
      if (!url) return;
      hint.hidden = false;
      hint.innerHTML = `Phone / Tab: <a href="${url}">${url}</a>`;
    } catch {
      hint.hidden = true;
    }
  }

  if (btn && sheet) {
    btn.addEventListener('click', async () => {
      sheet.hidden = false;
      sheet.innerHTML = '<div class="phone-sheet-inner"><p>Link හදනවා...</p></div>';
      try {
        fillPhoneSheet(sheet, await loadAccessUrls());
      } catch {
        sheet.innerHTML = '<div class="phone-sheet-inner"><p>START-QUOTATION.bat run කරන්න. PC එකේ WiFi එකේම phone එකත් තියෙන්න ඕනේ.</p><button type="button" class="quote-btn quote-btn-ghost" id="phone-close">Close</button></div>';
        const closeBtn = sheet.querySelector('#phone-close');
        if (closeBtn) closeBtn.addEventListener('click', () => { sheet.hidden = true; });
      }
    });
    sheet.addEventListener('click', (ev) => {
      if (ev.target === sheet) sheet.hidden = true;
    });
  }
  refreshHint();
}

function loadLocal() {
  try {
    if (localStorage.getItem('genx-quotations-reset') !== STORAGE_RESET) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem('genx-quotations-reset', STORAGE_RESET);
      return [];
    }
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

function parseNum(raw) {
  const s = String(raw || '').replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(raw) {
  const n = parseNum(raw);
  if (!n) return '';
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRate(raw) {
  const n = parseNum(raw);
  if (!n) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatLkr(raw) {
  return formatMoney(raw);
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextRef(items) {
  const year = new Date().getFullYear();
  const used = new Set();
  items.forEach((item) => {
    const match = String(item.id || '').match(new RegExp(`^(?:CS|GENX)-${year}-(\\d+)$`));
    if (match) used.add(Number(match[1]));
  });
  let n = 1;
  while (used.has(n)) n += 1;
  return `CS-${year}-` + String(n).padStart(4, '0');
}

function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function val(id) {
  return document.getElementById(id);
}

function calcPrice() {
  const cifJpy = parseNum(val('cifJpy').value);
  const lcJpy = parseNum(val('lcJpy').value);
  const lcRate = parseNum(val('lcRate').value);
  const balRate = parseNum(val('balRate').value);
  const typedBalJpy = val('balJpy') && val('balJpy').value.trim();
  const balJpy = typedBalJpy ? parseNum(typedBalJpy) : Math.max(0, cifJpy - lcJpy);
  const lcLkr = lcJpy * lcRate;
  const typedBalLkr = val('balLkr') && val('balLkr').value.trim();
  const balLkr = typedBalLkr ? parseNum(typedBalLkr) : balJpy * balRate;
  const japanCostLkr = lcLkr + balLkr;
  const customsDuty = parseNum(val('customsDuty').value);
  const clearingCharges = parseNum(val('clearingCharges').value);
  const agencyFee = parseNum(val('agencyFee').value);
  const totalEstimatedPrice = japanCostLkr + customsDuty + clearingCharges + agencyFee;
  return {
    cifJpy, lcRate, lcJpy, lcLkr, balRate, balJpy, balLkr,
    japanCostLkr, customsDuty, clearingCharges, agencyFee, totalEstimatedPrice
  };
}

function storeNum(n) {
  return n ? String(n) : '';
}

function fieldText(id) {
  const el = val(id);
  return el ? el.value.trim() : '';
}

function readForm() {
  const price = calcPrice();
  const data = {
    id: val('quotationNo').value.trim(),
    quoteDate: val('quoteDate').value || todayIso(),
    origin: val('origin').value.trim() || 'Japan',
    designation: STAFF_ROLES[val('preparedByName').value] || '',
    cifJpy: fieldText('cifJpy') || storeNum(price.cifJpy),
    lcRate: fieldText('lcRate') || storeNum(price.lcRate),
    lcJpy: fieldText('lcJpy') || storeNum(price.lcJpy),
    lcLkr: fieldText('lcLkr') || storeNum(price.lcLkr),
    balRate: fieldText('balRate') || storeNum(price.balRate),
    balJpy: fieldText('balJpy') || storeNum(price.balJpy),
    balLkr: fieldText('balLkr') || storeNum(price.balLkr),
    japanCostLkr: fieldText('japanCostLkr') || storeNum(price.japanCostLkr),
    customsDuty: fieldText('customsDuty') || storeNum(price.customsDuty),
    clearingCharges: fieldText('clearingCharges') || storeNum(price.clearingCharges),
    agencyFee: fieldText('agencyFee') || storeNum(price.agencyFee),
    totalEstimatedPrice: fieldText('totalEstimatedPrice') || storeNum(price.totalEstimatedPrice),
    updatedAt: new Date().toISOString()
  };

  TEXT_FIELDS.forEach((id) => {
    data[id] = val(id).value.trim();
  });
  data.signatureImage = signatureValue();
  data.signatureScale = currentSignScale();
  data.signatureX = currentSignX();
  data.vehiclePhoto = vehiclePhotoValue();
  return data;
}

function setQuoteNo(id) {
  val('quotationNo').value = id || '';
  const toolbar = document.getElementById('toolbar-ref');
  if (toolbar) toolbar.textContent = id || 'New';
  const del = document.getElementById('delete-btn');
  if (del) del.disabled = !id;
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((el) => el.src.indexOf('jspdf') !== -1) && window.jspdf) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

function dataUrlKind(raw) {
  const s = String(raw || '');
  if (s.indexOf('image/png') !== -1) return 'PNG';
  if (s.indexOf('image/jpeg') !== -1 || s.indexOf('image/jpg') !== -1) return 'JPEG';
  return '';
}

async function imageDataUrl(path) {
  const res = await fetch(path, { cache: 'force-cache' });
  if (!res.ok) return '';
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

async function postQuotePdf(saved) {
  const res = await fetch('/api/quote-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved)
  });
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok && type.indexOf('pdf') !== -1) return res.blob();
  return null;
}

async function downloadClientPdf(saved) {
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) throw new Error('PDF library load failed');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  let y = 8;
  try {
    const header = await imageDataUrl('images/cs-header.jpg');
    if (header) {
      doc.addImage(header, 'JPEG', 0, 0, pageW, 28);
      y = 34;
    }
  } catch {
    y = 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(29, 90, 170);
  doc.text('PRE-ORDER VEHICLE QUOTATION', 14, y);
  doc.setFontSize(10);
  doc.text(saved.id || '', pageW - 14, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 32, 46);
  doc.setFontSize(9);
  const lines = [
    ['Date', saved.quoteDate || ''],
    ['Customer', saved.customerName || ''],
    ['Contact', saved.contactNo || ''],
    ['Email', saved.email || ''],
    ['Vehicle', [saved.make, saved.model, saved.year, saved.colour].filter(Boolean).join(' ')],
    ['Grade', saved.grade || ''],
    ['Engine', saved.engineCapacity || ''],
    ['Fuel / Gear', [saved.fuelType, saved.transmission].filter(Boolean).join(' / ')],
    ['CIF JPY', saved.cifJpy || ''],
    ['LC Rate / JPY / LKR', [saved.lcRate, saved.lcJpy, saved.lcLkr].filter(Boolean).join('  |  ')],
    ['CIF Balance Rate / JPY / LKR', [saved.balRate, saved.balJpy, saved.balLkr].filter(Boolean).join('  |  ')],
    ['Japan Cost LKR', saved.japanCostLkr || ''],
    ['Customs Duty', saved.customsDuty || ''],
    ['Clearing', saved.clearingCharges || ''],
    ['Agency Fee', saved.agencyFee || ''],
    ['Total Upto Hand', saved.totalEstimatedPrice || ''],
    ['Prepared By', [saved.preparedByName, saved.designation].filter(Boolean).join(' · ')]
  ];
  lines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '—'), 58, y);
    y += 6;
  });
  if (saved.vehiclePhoto && dataUrlKind(saved.vehiclePhoto)) {
    try {
      doc.addImage(saved.vehiclePhoto, dataUrlKind(saved.vehiclePhoto), 140, 42, 54, 36);
    } catch {
      /* skip photo */
    }
  }
  if (saved.signatureImage && dataUrlKind(saved.signatureImage)) {
    try {
      doc.addImage(saved.signatureImage, dataUrlKind(saved.signatureImage), 14, y + 4, 42, 16);
    } catch {
      /* skip signature */
    }
  }
  try {
    const footer = await imageDataUrl('images/cs-footer.jpg');
    if (footer) doc.addImage(footer, 'JPEG', 0, 277, pageW, 20);
  } catch {
    /* skip footer */
  }
  doc.save((saved.id || 'quotation') + '.pdf');
}

async function downloadQuotePdf(saved) {
  if (!saved || !saved.id) return false;
  if (val('cifJpy')) {
    const live = readForm();
    saved = Object.assign({}, saved, live, { id: saved.id || live.id });
  }
  const filename = saved.id + '.pdf';
  showToast('PDF හදනවා...', 'wait');
  const slim = Object.assign({}, saved, {
    vehiclePhoto: '',
    signatureImage: String(saved.signatureImage || '').length > 180000 ? '' : (saved.signatureImage || '')
  });
  const attempts = [];
  if (!isHomeCloud()) {
    attempts.push(async () => {
      const res = await fetch((apiBase || '') + '/api/quotation/pdf?id=' + encodeURIComponent(saved.id), { cache: 'no-store' });
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && type.indexOf('pdf') !== -1) return res.blob();
      return null;
    });
  }
  attempts.push(() => postQuotePdf(saved));
  attempts.push(() => postQuotePdf(slim));
  for (const attempt of attempts) {
    try {
      const blob = await attempt();
      if (blob && blob.size > 800) {
        triggerBlobDownload(blob, filename);
        showToast('PDF downloaded', '');
        return true;
      }
    } catch {
      /* next attempt */
    }
  }
  try {
    await downloadClientPdf(saved);
    showToast('PDF downloaded', '');
    return true;
  } catch {
    showToast('PDF download failed. Page refresh කරලා ආයෙත් try කරන්න.', 'error');
    return false;
  }
}

function saveLocalQuote(data) {
  if (!data.id) data.id = nextRef(allKnown());
  data.updatedAt = new Date().toISOString();
  data.createdAt = data.createdAt || data.updatedAt;
  data.person = data.preparedByName;
  data.designation = STAFF_ROLES[data.preparedByName] || data.designation || '';
  saveLocalCopy(data);
  setQuoteNo(data.id);
  history.replaceState({}, '', `quotation.html?ref=${encodeURIComponent(data.id)}`);
  return data;
}

function fillForm(data) {
  setQuoteNo(data.id || '');
  val('quoteDate').value = data.quoteDate || todayIso();
  TEXT_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = data[id] || (id === 'origin' ? 'Japan' : '');
  });
  setDesignation();
  PRICE_INPUTS.forEach((id) => {
    if (val(id)) val(id).value = formatMoney(data[id]);
  });
  RATE_FIELDS.forEach((id) => {
    if (val(id)) val(id).value = formatRate(data[id]);
  });
  updateTotal();
  fillModelSuggestions();
  setSignature(
    data.id
      ? (data.signatureImage || localStorage.getItem(SIG_KEY + (data.preparedByName || '')) || '')
      : (data.signatureImage || ''),
    data.signatureScale || localStorage.getItem(SIG_SCALE_KEY + (data.preparedByName || '')) || SIGN_DEFAULT,
    data.signatureX != null ? data.signatureX : localStorage.getItem(SIG_X_KEY + (data.preparedByName || '')) || 0
  );
  setVehiclePhoto(data.vehiclePhoto || '');
}

function updateTotal() {
  if (!val('cifJpy')) return;
  const price = calcPrice();
  if (val('balJpy') && !val('balJpy').value.trim()) val('balJpy').value = formatMoney(price.balJpy);
  val('lcLkr').value = formatMoney(price.lcLkr);
  if (val('balLkr') && !val('balLkr').value.trim()) val('balLkr').value = formatMoney(price.balLkr);
  val('japanCostLkr').value = formatMoney(price.japanCostLkr);
  val('totalEstimatedPrice').value = formatMoney(price.totalEstimatedPrice);
}

function setStatus(text) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = text;
}

async function apiList() {
  const res = await apiFetch('/api/quotations', { cache: 'no-store' });
  if (!res.ok) throw new Error('API unavailable');
  const data = await res.json();
  apiRoot = data.root || '';
  apiItems = data.items || [];
  return data;
}

async function apiGet(id) {
  const res = await apiFetch('/api/quotation?id=' + encodeURIComponent(id), { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.item || null;
}

async function apiSave(payload) {
  const res = await apiFetch('/api/quotation', {
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
  const res = await apiFetch('/api/quotation?id=' + encodeURIComponent(id), { method: 'DELETE' });
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
  writeLocal(next.slice(0, 80));
  localStorage.setItem(PREP_KEY, data.preparedByName || '');
  if (data.preparedByName && data.signatureImage) {
    localStorage.setItem(SIG_KEY + data.preparedByName, data.signatureImage);
    localStorage.setItem(SIG_SCALE_KEY + data.preparedByName, String(data.signatureScale || SIGN_DEFAULT));
    localStorage.setItem(SIG_X_KEY + data.preparedByName, String(data.signatureX || 0));
  }
}

async function saveQuote() {
  if (saving) return null;
  const data = readForm();
  if (!STAFF.includes(data.preparedByName)) {
    showToast('Prepared By name select කරන්න', 'error');
    val('preparedByName').focus();
    return null;
  }

  setSaveBusy(true);
  showToast('Saving...', 'wait');

  let items = allKnown();
  try {
    const listed = await apiList();
    items = listed.items || items;
  } catch {
    items = allKnown();
  }

  const existing = items.find((x) => x.id === data.id);
  if (!existing) {
    data.id = '';
  }
  data.createdAt = existing ? existing.createdAt : new Date().toISOString();

  try {
    const saved = await apiSave(data);
    saveLocalCopy(saved);
    setQuoteNo(saved.id);
    history.replaceState({}, '', `quotation.html?ref=${encodeURIComponent(saved.id)}`);
    showToast('Saved successfully', '');
    return saved;
  } catch (err) {
    const saved = saveLocalQuote(data);
    showToast('Saved. PDF download කරලා customer ට යවන්න පුළුවන්.', '');
    return saved;
  } finally {
    setSaveBusy(false);
  }
}

function initEditor() {
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveQuote();
    });
  }

  fillDatalist('make-list', Object.keys(MODELS_BY_MAKE));
  fillModelSuggestions();

  val('make').addEventListener('input', fillModelSuggestions);
  val('make').addEventListener('change', fillModelSuggestions);
  val('preparedByName').addEventListener('change', () => {
    setDesignation();
    loadPersonSignature();
  });
  initSignatureUpload();
  initVehiclePhoto();

  PRICE_INPUTS.forEach((id) => {
    const el = val(id);
    if (!el) return;
    el.addEventListener('input', updateTotal);
    el.addEventListener('blur', () => {
      if (el.value.trim()) el.value = formatMoney(el.value);
      updateTotal();
    });
  });
  RATE_FIELDS.forEach((id) => {
    const el = val(id);
    if (!el) return;
    el.addEventListener('input', updateTotal);
    el.addEventListener('blur', () => {
      if (el.value.trim()) el.value = formatRate(el.value);
      updateTotal();
    });
  });

  document.getElementById('print-btn').addEventListener('click', async () => {
    const saved = await saveQuote();
    if (saved) window.print();
  });

  const pdfBtn = document.getElementById('pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', async () => {
      const saved = await saveQuote();
      if (!saved) return;
      await downloadQuotePdf(saved);
    });
  }

  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const id = val('quotationNo').value.trim() || param('ref');
      if (!id) return;
      if (!confirm(id + ' delete කරනවද? Number එක ඊළඟ quotation එකට ආයෙත් යනවා.')) return;
      await apiDelete(id);
      writeLocal(loadLocal().filter((x) => x.id !== id));
      location.href = 'quotation.html';
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveQuote();
    }
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

    if (saved) {
      fillForm(saved);
    } else {
      fillForm({
        id: '',
        quoteDate: todayIso(),
        origin: 'Japan',
        preparedByName: '',
        designation: '',
        signatureImage: '',
        vehiclePhoto: ''
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
      if (hint) {
        hint.textContent = isHomeCloud()
          ? 'ගෙදර mode: මේ phone/laptop එකේ save වෙනවා. PDF download කරලා customer ට යවන්න.'
          : 'Folder API එක open වෙලා නැහැ. START-QUOTATION.bat run කරලා quotations open කරන්න.';
      }
    }
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const source = apiItems.length ? apiItems : loadLocal();
    const items = source.filter((item) => {
      if (person && item.person !== person && item.preparedByName !== person) return false;
      if (!q) return true;
      return [item.id, item.customerName, item.contactNo, item.email, item.make, item.model, item.year, item.preparedByName, item.person]
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
          <button type="button" class="quote-btn quote-btn-ghost" data-pdf="${item.id}">Download PDF</button>
          <a class="quote-btn quote-btn-ghost" href="quotation.html?ref=${encodeURIComponent(item.id)}&print=1">Print</a>
          <button type="button" class="quote-btn quote-btn-danger" data-del="${item.id}">Delete</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-pdf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-pdf');
        const source = apiItems.length ? apiItems : loadLocal();
        const item = source.find((x) => x.id === id) || loadLocal().find((x) => x.id === id);
        if (!item) {
          showToast('Quotation එක හොයා ගන්න බැරි වුණා', 'error');
          return;
        }
        await downloadQuotePdf(item);
      });
    });

    list.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        if (!confirm(id + ' delete කරනවද? Number එක ඊළඟ quotation එකට ආයෙත් යනවා.')) return;
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
initPhoneShare();
