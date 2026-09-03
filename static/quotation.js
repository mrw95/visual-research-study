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
  el.innerHTML = values.map((value) => `<option value="${String(value).toUpperCase()}"></option>`).join('');
}

function matchedMake(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  return Object.keys(MODELS_BY_MAKE).find((name) => name.toLowerCase() === key) || '';
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

const PRICE_INPUTS = ['cifJpy', 'lcJpy', 'customsDuty', 'clearingCharges', 'agencyFee'];
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
  throw lastErr || new Error('Save API එක open වෙලා නැහැ.');
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
  } else if (!location.hostname.endsWith('vercel.app') && !/trycloudflare|cfargotunnel/i.test(location.hostname)) {
    urls.push(`${location.origin}/${path}`);
  }
  return { ok: true, urls, public: '', pin: '', vercel: 'https://visual-research-study.vercel.app', path };
}

function lifetimeShareUrls(data) {
  const vercel = String((data && data.vercel) || 'https://visual-research-study.vercel.app').replace(/\/$/, '');
  const path = String((data && data.path) || currentQuotePath()).replace(/^\//, '');
  const forever = `${vercel}/${path}`;
  const extra = ((data && data.urls) || []).filter((url) => {
    const u = String(url || '');
    if (!u || u === forever) return false;
    return !/trycloudflare\.com|cfargotunnel\.com/i.test(u);
  });
  return [forever, ...extra];
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
  const urls = lifetimeShareUrls(data);
  const first = urls[0] || '';
  const qr = first
    ? `<img class="phone-qr" alt="QR" width="220" height="220" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(first)}">`
    : '';
  sheet.innerHTML = `
    <div class="phone-sheet-inner">
      <h2>Phone / Tab</h2>
      <p><strong>Lifetime share link</strong> — මේක කවදාවත් change වෙන්නේ නැහැ. අනිත් අයට මේකම දෙන්න.</p>
      ${qr}
      ${urls.map((url) => `<a class="phone-url" href="${url}">${url}</a>`).join('')}
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
      hint.innerHTML = 'මේක lifetime link එක. PC එක on වෙන්න ඕන නැහැ. Save සහ Download PDF මෙතනින්ම කරන්න.';
    }
    return;
  }

  async function refreshHint() {
    if (!hint || !local) return;
    try {
      const data = await loadAccessUrls();
      const url = lifetimeShareUrls(data)[0];
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
        sheet.innerHTML = '<div class="phone-sheet-inner"><p>Link copy කරන්න බැරි උනා. <a href="https://visual-research-study.vercel.app/desk">https://visual-research-study.vercel.app/desk</a></p><button type="button" class="quote-btn quote-btn-ghost" id="phone-close">Close</button></div>';
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
  const text = String(raw || '').replace(/,/g, '').trim();
  if (!text) return 0;
  const neg = text.charAt(0) === '-';
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned || cleaned === '.') return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

function formatMoneyValue(n) {
  if (!Number.isFinite(n)) return '';
  const neg = n < 0;
  const [intPart, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + '.' + frac;
}

function formatMoney(raw) {
  if (raw === '' || raw == null) return '';
  const n = typeof raw === 'number' ? raw : parseNum(raw);
  if (!n && String(raw).trim() === '') return '';
  if (!Number.isFinite(n)) return '';
  return formatMoneyValue(n);
}

function formatRate(raw) {
  const n = parseNum(raw);
  if (!n) return '';
  const text = String(n);
  if (text.indexOf('.') === -1) return text + '.00';
  const parts = text.split('.');
  const frac = (parts[1] || '').slice(0, 4).replace(/0+$/, '');
  if (!frac) return parts[0] + '.00';
  if (frac.length === 1) return parts[0] + '.' + frac + '0';
  return parts[0] + '.' + frac;
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
  const cifJpy = parseNum(val('cifJpy') && val('cifJpy').value);
  const lcJpy = parseNum(val('lcJpy') && val('lcJpy').value);
  const lcRate = parseNum(val('lcRate') && val('lcRate').value);
  const balRate = parseNum(val('balRate') && val('balRate').value);
  const balJpy = cifJpy - lcJpy;
  const lcLkr = lcJpy * lcRate;
  const balLkr = balJpy * balRate;
  const japanCostLkr = lcLkr + balLkr;
  const customsDuty = parseNum(val('customsDuty') && val('customsDuty').value);
  const clearingCharges = parseNum(val('clearingCharges') && val('clearingCharges').value);
  const agencyFee = parseNum(val('agencyFee') && val('agencyFee').value);
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
  const data = {
    id: val('quotationNo').value.trim(),
    quoteDate: val('quoteDate').value || todayIso(),
    origin: val('origin').value.trim() || 'Japan',
    designation: STAFF_ROLES[val('preparedByName').value] || '',
    cifJpy: fieldText('cifJpy'),
    lcRate: fieldText('lcRate'),
    lcJpy: fieldText('lcJpy'),
    lcLkr: fieldText('lcLkr'),
    balRate: fieldText('balRate'),
    balJpy: fieldText('balJpy'),
    balLkr: fieldText('balLkr'),
    japanCostLkr: fieldText('japanCostLkr'),
    customsDuty: fieldText('customsDuty'),
    clearingCharges: fieldText('clearingCharges'),
    agencyFee: fieldText('agencyFee'),
    totalEstimatedPrice: fieldText('totalEstimatedPrice'),
    updatedAt: new Date().toISOString()
  };

  TEXT_FIELDS.forEach((id) => {
    data[id] = val(id).value.trim();
  });
  data.make = data.make.toUpperCase();
  data.model = data.model.toUpperCase();
  data.estimatedArrival = data.estimatedArrival || '2 Months';
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

function pdfEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function shownAmount(saved, key) {
  const el = val(key);
  if (el && String(el.value || '').trim()) return String(el.value).trim();
  const raw = saved ? saved[key] : '';
  if (raw === '' || raw == null) return '';
  return formatMoney(raw) || String(raw);
}

function shownRate(saved, key) {
  const el = val(key);
  if (el && String(el.value || '').trim()) return String(el.value).trim();
  const raw = saved ? saved[key] : '';
  if (raw === '' || raw == null) return '';
  return formatRate(raw) || String(raw);
}

function shownText(saved, key) {
  const el = val(key);
  if (el && String(el.value || '').trim()) return String(el.value).trim();
  return String((saved && saved[key]) || '').trim();
}

function strBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 255;
  return out;
}

function jpegSize(u8) {
  let i = 2;
  while (i + 8 < u8.length) {
    if (u8[i] !== 0xFF) {
      i += 1;
      continue;
    }
    const marker = u8[i + 1];
    if (marker === 0xD8 || marker === 0xD9 || marker === 0x01) {
      i += 2;
      continue;
    }
    if (marker >= 0xD0 && marker <= 0xD7) {
      i += 2;
      continue;
    }
    const len = (u8[i + 2] << 8) | u8[i + 3];
    if (marker >= 0xC0 && marker <= 0xC3) {
      return {
        height: (u8[i + 5] << 8) | u8[i + 6],
        width: (u8[i + 7] << 8) | u8[i + 8]
      };
    }
    i += 2 + len;
  }
  return { width: 1600, height: 220 };
}

function jpegFromDataUrl(raw) {
  const s = String(raw || '');
  const m = s.match(/^data:image\/jpe?g;base64,(.+)$/i);
  if (!m) return null;
  const bin = atob(m[1]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return u8;
}

function toJpegBytes(raw) {
  return new Promise((resolve) => {
    const s = String(raw || '');
    if (s.indexOf('data:image/') !== 0) {
      resolve(null);
      return;
    }
    const jpeg = jpegFromDataUrl(s);
    if (jpeg) {
      resolve(jpeg);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, img.naturalWidth || img.width);
      canvas.height = Math.max(1, img.naturalHeight || img.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(jpegFromDataUrl(canvas.toDataURL('image/jpeg', 0.92)));
    };
    img.onerror = () => resolve(null);
    img.src = s;
  });
}

async function fetchJpeg(path) {
  try {
    const res = await fetch(path, { cache: 'force-cache' });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

const QUOTE_TERMS = [
  '1. This quotation is valid for 07 days from the quotation date.',
  '2. The Letter of Credit (LC) must be opened within 07 days of signing the Proforma Invoice.',
  '3. Final price may vary due to exchange rate, shipping cost, taxes, and government regulations.',
  '4. Booking advance is required to confirm the order.',
  '5. Delivery time depends on shipping schedules and customs clearance.',
  '6. Any additional government taxes or levies imposed after booking will be borne by the customer.'
];

async function makeQuotePdfBlob(saved) {
  const savedData = saved || {};
  const header = await fetchJpeg('images/cs-header.jpg?v=3');
  const footer = await fetchJpeg('images/cs-footer.jpg?v=9');
  const signJpeg = await toJpegBytes(savedData.signatureImage || signatureValue());
  const photoJpeg = await toJpegBytes(savedData.vehiclePhoto || vehiclePhotoValue());

  const cmds = [];
  function color(r, g, b) {
    cmds.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  }
  function text(x, y, size, str, bold) {
    cmds.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(str)}) Tj ET`);
  }
  function helveticaWidth(str, size, bold) {
    const s = String(str || '');
    const units = {
      ' ': 278, '.': 278, ',': 278, '-': 333, ':': 278, '|': 260,
      '0': 556, '1': 556, '2': 556, '3': 556, '4': 556,
      '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
      A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
      K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
      U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
      a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
      k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
      u: 556, v: 500, w: 722, x: 500, y: 500, z: 500
    };
    let w = 0;
    for (let i = 0; i < s.length; i += 1) w += (units[s.charAt(i)] || 560);
    return (w / 1000) * size * (bold ? 1.06 : 1);
  }
  function textRight(rightX, y, size, str, bold) {
    const w = helveticaWidth(str, size, bold);
    text(rightX - w, y, size, str, bold);
  }
  function box(x, y, w, h, fill) {
    if (fill) cmds.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
    else cmds.push(`0.75 0.8 0.86 RG ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S 0 0 0 rg`);
  }
  function drawJpeg(name, x, y, w, h) {
    cmds.push(`q ${w.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} cm /${name} Do Q`);
  }

  const pageW = 595;
  const pageH = 842;
  const headerH = header ? Math.min(78, pageW * (jpegSize(header).height / jpegSize(header).width)) : 0;
  const footerH = footer ? Math.min(52, pageW * (jpegSize(footer).height / jpegSize(footer).width)) : 0;
  if (header) drawJpeg('ImH', 0, pageH - headerH, pageW, headerH);
  if (footer) drawJpeg('ImF', 0, 0, pageW, footerH);

  let y = pageH - headerH - 14;
  const left = 36;
  const right = 559;
  const width = right - left;

  color(29, 90, 170);
  text(left, y, 13, 'PRE-ORDER VEHICLE QUOTATION', true);
  color(20, 32, 46);
  textRight(right, y + 6, 9, 'Quotation No: ' + (savedData.id || shownText(savedData, 'quotationNo')), true);
  textRight(right, y - 6, 9, 'Date: ' + (savedData.quoteDate || shownText(savedData, 'quoteDate')), false);
  y -= 18;
  cmds.push('1 0.4 0.02 RG ' + left + ' ' + y.toFixed(1) + ' m ' + right + ' ' + y.toFixed(1) + ' l S 0 0 0 rg');
  y -= 14;

  function heading(label) {
    color(29, 90, 170);
    text(left, y, 10, label, true);
    y -= 4;
    cmds.push('0.11 0.35 0.67 RG ' + left + ' ' + y.toFixed(1) + ' m ' + right + ' ' + y.toFixed(1) + ' l S 0 0 0 rg');
    y -= 12;
  }

  heading('CUSTOMER DETAILS');
  color(20, 32, 46);
  text(left, y, 8, 'Customer: ' + shownText(savedData, 'customerName'), false);
  text(left + 250, y, 8, 'Contact: ' + shownText(savedData, 'contactNo'), false);
  y -= 12;
  text(left, y, 8, 'Email: ' + shownText(savedData, 'email'), false);
  y -= 16;

  heading('VEHICLE DETAILS');
  const vehicleRows = [
    ['Make', shownText(savedData, 'make').toUpperCase()],
    ['Model', shownText(savedData, 'model').toUpperCase()],
    ['Year', shownText(savedData, 'year')],
    ['Grade', shownText(savedData, 'grade')],
    ['Engine Capacity', shownText(savedData, 'engineCapacity')],
    ['Fuel Type', shownText(savedData, 'fuelType')],
    ['Transmission', shownText(savedData, 'transmission')],
    ['Mileage', shownText(savedData, 'mileage')],
    ['Colour', shownText(savedData, 'colour')],
    ['Origin', shownText(savedData, 'origin')],
    ['Estimated Arrival', shownText(savedData, 'estimatedArrival') || '2 Months']
  ];
  const vRow = 11;
  const tableRight = photoJpeg ? right - 120 : right;
  vehicleRows.forEach((row, i) => {
    const rowY = y - i * vRow;
    if (i % 2 === 0) {
      cmds.push('0.95 0.96 0.98 rg ' + left + ' ' + (rowY - 3).toFixed(1) + ' ' + (tableRight - left).toFixed(1) + ' ' + vRow + ' re f');
    }
    color(29, 90, 170);
    text(left + 4, rowY, 7, row[0], true);
    color(20, 32, 46);
    text(left + 108, rowY, 7, row[1], false);
  });
  if (photoJpeg) {
    const ph = vehicleRows.length * vRow;
    const pw = 110;
    drawJpeg('ImV', right - pw, y - ph + 4, pw, ph - 2);
  }
  y -= vehicleRows.length * vRow + 10;

  heading('PRICE DETAILS');
  const rateRight = left + width * 0.60 - 6;
  const jpyRight = left + width * 0.80 - 6;
  const lkrRight = right - 6;
  const rowH = 14;

  function row(cells, kind) {
    y -= rowH;
    const isHead = kind === 'head';
    const isTotal = kind === 'total';
    const isBlue = kind === 'blue';
    const lkrBlue = kind === 'lkrblue' || isBlue;
    if (isHead) {
      color(29, 90, 170);
      box(left, y - 4, width, rowH + 1, true);
    }
    const size = isHead ? 7 : 8;
    if (isHead) color(255, 255, 255);
    else if (isTotal) color(196, 30, 58);
    else if (isBlue) color(29, 90, 170);
    else color(20, 32, 46);
    text(left + 4, y, size, String(cells[0] || ''), isHead || isTotal || isBlue);
    function num(rightX, val, asBlue) {
      const shown = String(val || '');
      if (!shown) return;
      if (isHead) color(255, 255, 255);
      else if (isTotal) color(196, 30, 58);
      else if (asBlue) color(29, 90, 170);
      else color(20, 32, 46);
      textRight(rightX, y, size, shown, isHead || isTotal || asBlue);
    }
    num(rateRight, cells[1], false);
    num(jpyRight, cells[2], false);
    num(lkrRight, cells[3], lkrBlue);
    color(20, 32, 46);
  }

  row(['', 'Ex. Rate', 'AMOUNT JPY', 'AMOUNT LKR'], 'head');
  row(['Total Cost CIF JPY', '', shownAmount(savedData, 'cifJpy'), '']);
  row(['LC Amount', shownRate(savedData, 'lcRate'), shownAmount(savedData, 'lcJpy'), shownAmount(savedData, 'lcLkr')], 'lkrblue');
  row(['CIF Balance Amount - JPY', shownRate(savedData, 'balRate'), shownAmount(savedData, 'balJpy'), shownAmount(savedData, 'balLkr')]);
  y -= 5;
  cmds.push('0.11 0.35 0.67 RG ' + left + ' ' + y.toFixed(1) + ' m ' + right + ' ' + y.toFixed(1) + ' l S 0 0 0 rg');
  y -= 2;
  row(['Total Japan Cost - LKR', '', '', shownAmount(savedData, 'japanCostLkr')], 'blue');
  row(['Customs Duty - LKR', '', '', shownAmount(savedData, 'customsDuty')]);
  row(['Customs Clearing & Other Charges - LKR', '', '', shownAmount(savedData, 'clearingCharges')]);
  row(['Agency Fee', '', '', shownAmount(savedData, 'agencyFee')]);
  row(['Total Upto Hand - LKR', '', '', shownAmount(savedData, 'totalEstimatedPrice')], 'total');
  y -= 16;

  heading('TERMS & CONDITIONS');
  color(20, 32, 46);
  QUOTE_TERMS.forEach((line) => {
    text(left, y, 7, line, false);
    y -= 10;
  });
  y -= 8;

  heading('PREPARED BY');
  color(92, 107, 122);
  text(left, y, 7, 'Name', false);
  text(left + 170, y, 7, 'Designation', false);
  text(left + 340, y, 7, 'Signature', false);
  y -= 16;
  color(20, 32, 46);
  text(left, y, 10, shownText(savedData, 'preparedByName') || savedData.preparedByName || '', true);
  color(29, 90, 170);
  text(left + 170, y, 10, shownText(savedData, 'designation') || savedData.designation || '', true);
  if (signJpeg) {
    const size = jpegSize(signJpeg);
    const sh = 32;
    const sw = Math.min(120, sh * ((size.width || 2) / (size.height || 1)));
    drawJpeg('ImS', left + 340, y - 8, sw, sh);
    y -= sh + 2;
  } else {
    y -= 8;
  }

  const stream = strBytes(cmds.join('\n') + '\n');
  const images = [];
  if (header) {
    images.push({ name: 'ImH', bytes: header, size: jpegSize(header) });
  }
  if (footer) {
    images.push({ name: 'ImF', bytes: footer, size: jpegSize(footer) });
  }
  if (signJpeg) {
    images.push({ name: 'ImS', bytes: signJpeg, size: jpegSize(signJpeg) });
  }
  if (photoJpeg) {
    images.push({ name: 'ImV', bytes: photoJpeg, size: jpegSize(photoJpeg) });
  }

  const fontRes = '/Font << /F1 5 0 R /F2 6 0 R >>';
  let imgRes = '';
  if (images.length) {
    imgRes = ' /XObject << ' + images.map((img, i) => '/' + img.name + ' ' + (7 + i) + ' 0 R').join(' ') + ' >>';
  }

  const objects = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << ${fontRes}${imgRes} >> /Contents 4 0 R >>`
  ];

  const writerParts = [];
  let offset = 0;
  function pushBytes(u8) {
    writerParts.push(u8);
    offset += u8.length;
  }
  function pushStr(s) {
    pushBytes(strBytes(s));
  }

  pushStr('%PDF-1.4\n');
  const offs = [0];

  function addObject(index, headerStr, streamBytes) {
    offs[index] = offset;
    if (streamBytes) {
      pushStr(`${index} 0 obj\n${headerStr}\nstream\n`);
      pushBytes(streamBytes);
      pushStr('\nendstream\nendobj\n');
    } else {
      pushStr(`${index} 0 obj\n${headerStr}\nendobj\n`);
    }
  }

  addObject(1, objects[1]);
  addObject(2, objects[2]);
  addObject(3, objects[3]);
  addObject(4, `<< /Length ${stream.length} >>`, stream);
  addObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  images.forEach((img, i) => {
    const n = 7 + i;
    addObject(
      n,
      `<< /Type /XObject /Subtype /Image /Width ${img.size.width} /Height ${img.size.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`,
      img.bytes
    );
  });

  const xref = offset;
  const count = 7 + images.length;
  pushStr(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i += 1) {
    pushStr(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer << /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(writerParts, { type: 'application/pdf' });
}

async function postQuotePdf(saved) {
  const res = await fetch('/api/quote-pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved)
  });
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok && type.indexOf('pdf') !== -1) return res.blob();
  return null;
}

async function downloadClientPdf(saved) {
  try {
    const blob = await postQuotePdf(saved);
    if (blob && blob.size > 800) {
      triggerBlobDownload(blob, (saved.id || 'quotation') + '.pdf');
      return;
    }
  } catch {
    /* use on-screen PDF */
  }
  triggerBlobDownload(await makeQuotePdfBlob(saved), (saved.id || 'quotation') + '.pdf');
}

async function downloadQuotePdf(saved) {
  const data = Object.assign({}, saved || {});
  if (val('cifJpy')) {
    const live = readForm();
    Object.keys(live).forEach((key) => {
      data[key] = live[key];
    });
    data.id = (saved && saved.id) || live.id;
  }
  if (!data.id) return false;
  showToast('PDF හදනවා...', 'wait');
  try {
    await downloadClientPdf(data);
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
    if (!val(id)) return;
    if (id === 'origin') val(id).value = data[id] || 'Japan';
    else if (id === 'estimatedArrival') val(id).value = data[id] || '2 Months';
    else if (id === 'make' || id === 'model') val(id).value = String(data[id] || '').toUpperCase();
    else val(id).value = data[id] || '';
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
  const hasLc = !!(val('lcJpy').value.trim() && val('lcRate').value.trim());
  const hasCifAndLc = !!(val('cifJpy').value.trim() && val('lcJpy').value.trim());
  val('lcLkr').value = hasLc ? formatMoneyValue(price.lcLkr) : '';
  val('balJpy').value = hasCifAndLc ? formatMoneyValue(price.balJpy) : '';
  val('balLkr').value = (hasCifAndLc && val('balRate').value.trim()) ? formatMoneyValue(price.balLkr) : '';
  const hasJapan = !!(val('lcLkr').value.trim() || val('balLkr').value.trim());
  val('japanCostLkr').value = hasJapan ? formatMoneyValue(price.japanCostLkr) : '';
  const hasTotal = hasJapan
    || !!(val('customsDuty').value.trim() || val('clearingCharges').value.trim() || val('agencyFee').value.trim());
  val('totalEstimatedPrice').value = hasTotal ? formatMoneyValue(price.totalEstimatedPrice) : '';
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
  if (!STAFF.includes(val('preparedByName').value)) {
    showToast('Prepared By name select කරන්න', 'error');
    val('preparedByName').focus();
    return null;
  }

  setSaveBusy(true);
  showToast('Saving...', 'wait');
  updateTotal();
  const data = readForm();

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
    const merged = Object.assign({}, saved, data, {
      id: saved.id,
      createdAt: saved.createdAt || data.createdAt,
      updatedAt: saved.updatedAt || data.updatedAt
    });
    saveLocalCopy(merged);
    setQuoteNo(merged.id);
    history.replaceState({}, '', `quotation.html?ref=${encodeURIComponent(merged.id)}`);
    const folder = merged.pdfPath || merged.path || apiRoot;
    const onShare = /\\\\carswitch\\/i.test(String(apiRoot || folder || ''));
    showToast('Saved successfully', '');
    setStatus(apiRoot === 'cloud' ? 'Saved online' : (onShare ? 'Folder: ' + folder : 'Saved'));
    return merged;
  } catch (err) {
    const saved = saveLocalQuote(data);
    showToast('Saved successfully', '');
    setStatus('Saved');
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

  val('make').addEventListener('input', () => {
    forceCaps(val('make'));
    fillModelSuggestions();
  });
  val('make').addEventListener('change', () => {
    forceCaps(val('make'));
    fillModelSuggestions();
  });
  val('model').addEventListener('input', () => forceCaps(val('model')));
  val('model').addEventListener('change', () => forceCaps(val('model')));
  val('preparedByName').addEventListener('change', () => {
    setDesignation();
    loadPersonSignature();
  });
  initSignatureUpload();
  initVehiclePhoto();

  PRICE_INPUTS.forEach((id) => {
    const el = val(id);
    if (!el) return;
    el.addEventListener('input', () => {
      updateTotal();
    });
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

  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });

  const pdfBtn = document.getElementById('pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', async () => {
      updateTotal();
      const live = readForm();
      if (!STAFF.includes(live.preparedByName)) {
        showToast('Prepared By name select කරන්න', 'error');
        val('preparedByName').focus();
        return;
      }
      live.id = live.id || val('quotationNo').value.trim() || 'quotation';
      showToast('PDF හදනවා...', 'wait');
      try {
        await downloadClientPdf(live);
        showToast('PDF downloaded', '');
      } catch {
        showToast('PDF download failed. Page refresh කරලා ආයෙත් try කරන්න.', 'error');
      }
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
        estimatedArrival: '2 Months',
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
      if (hint && data.root) {
        const onShare = /\\\\carswitch\\/i.test(String(data.root));
        hint.textContent = data.root === 'cloud'
          ? 'Saved online. PC එක on වෙන්න ඕන නැහැ.'
          : (onShare ? 'Save වෙන්නේ: ' + data.root : 'Saved');
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
        const source = allKnown();
        const item = Object.assign(
          {},
          source.find((x) => x.id === id) || {},
          loadLocal().find((x) => x.id === id) || {}
        );
        if (!item.id) {
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
