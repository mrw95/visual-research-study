const MODELS = [
  'Toyota Aqua', 'Toyota Axio', 'Toyota Premio', 'Toyota Allion', 'Toyota Prius',
  'Toyota CHR', 'Toyota Raize', 'Toyota Fielder', 'Honda Vezel', 'Honda Fit',
  'Honda Grace', 'Honda Civic', 'Nissan Note', 'Nissan X-Trail', 'Suzuki Wagon R',
  'Suzuki Alto', 'Suzuki Swift', 'Daihatsu Mira', 'Other'
];

const YEARS = ['Any', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', 'Older'];

const COLORS = [
  { id: 'White', label: 'White / සුදු', swatch: '#f4f4f4' },
  { id: 'Pearl', label: 'Pearl', swatch: '#f7f1e3' },
  { id: 'Black', label: 'Black / කළු', swatch: '#1a1a1a' },
  { id: 'Silver', label: 'Silver', swatch: '#c5c9ce' },
  { id: 'Grey', label: 'Grey / අළු', swatch: '#7b838c' },
  { id: 'Red', label: 'Red / රතු', swatch: '#c0392b' },
  { id: 'Blue', label: 'Blue / නිල්', swatch: '#2f5d9e' },
  { id: 'Any', label: 'Any color', swatch: 'linear-gradient(135deg,#e8f0fb,#f4f4f4,#1a1a1a)' },
  { id: 'Other', label: 'Other', swatch: '#d4a017' }
];

const GRADES = ['5', '4.5', '4', '3.5', '3', 'R', 'Any', 'Not sure'];

const BUDGETS = [
  { label: '50 Lakh', value: 5000000 },
  { label: '70 Lakh', value: 7000000 },
  { label: '80 Lakh', value: 8000000 }
];

const CITIES = [
  'Colombo', 'Gampaha', 'Negombo', 'Kandy', 'Kurunegala', 'Anuradhapura',
  'Galle', 'Matara', 'Ratnapura', 'Jaffna', 'Trincomalee', 'Batticaloa', 'Other'
];

const INTENTS = [
  {
    id: 'buy_now',
    title: 'අද / හෙට ගන්නවා',
    sub: 'Ready to take it'
  },
  {
    id: 'asking',
    title: 'Just asking',
    sub: 'විස්තර විතරක් අහනවා'
  }
];

const STORAGE_KEY = 'vrs-vehicle-inquiries';

const form = document.getElementById('hotline-form');
const modelInput = document.getElementById('model');
const cityInput = document.getElementById('city');
const budgetInput = document.getElementById('budget');
const submitBtn = document.getElementById('submit');
const hint = document.getElementById('hint');
const preview = document.getElementById('preview');
const overlay = document.getElementById('overlay');
const thankyouSummary = document.getElementById('thankyou-summary');

const state = {
  model: '',
  year: '',
  color: '',
  grade: '',
  budget: '',
  intent: '',
  city: '',
  submitting: false
};

function formatRs(n) {
  const num = Number(String(n).replace(/[^\d]/g, ''));
  if (!num) return '';
  return num.toLocaleString('en-LK');
}

function parseBudget(raw) {
  return String(raw || '').replace(/[^\d]/g, '');
}

function intentLabel(id) {
  return INTENTS.find(x => x.id === id)?.title || id;
}

function getInquiry() {
  return {
    type: 'vehicle',
    model: state.model.trim(),
    year: state.year,
    color: state.color,
    grade: state.grade,
    budget: parseBudget(state.budget),
    budgetLabel: state.budget ? `Rs. ${formatRs(state.budget)}` : '',
    intent: state.intent,
    intentLabel: intentLabel(state.intent),
    city: state.city.trim(),
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    note: document.getElementById('note').value.trim()
  };
}

function isReady() {
  const q = getInquiry();
  return q.model && q.year && q.color && q.grade && q.budget && q.intent && q.city && q.name && q.phone;
}

function updatePreview() {
  const q = getInquiry();
  const bits = [q.model, q.year, q.color, q.grade && `Grade ${q.grade}`, q.budgetLabel, q.intentLabel, q.city, q.name, q.phone].filter(Boolean);
  if (!bits.length) {
    preview.classList.add('hidden');
    preview.textContent = '';
    return;
  }
  preview.classList.remove('hidden');
  preview.innerHTML = `<strong>බලන්නේ:</strong> ${bits.join(' · ')}`;
}

function updateUI() {
  updatePreview();
  const ready = isReady();
  submitBtn.disabled = !ready || state.submitting;
  hint.textContent = ready ? 'Inquiry යවන්න පුළුවන්.' : 'Model, year, color, grade, budget, intent, city, නම, WhatsApp fill කරන්න.';
  hint.classList.toggle('ready', ready);
}

function selectChip(container, value) {
  container.querySelectorAll('.chip, .intent-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === value);
  });
}

function renderChips(el, items, onPick, selected) {
  el.innerHTML = items.map(item => {
    const value = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : item.label;
    const swatch = typeof item === 'object' && item.swatch
      ? `<span class="swatch" style="background:${item.swatch}"></span>`
      : '';
    return `<button type="button" class="chip${selected === value ? ' selected' : ''}" data-value="${value}">${swatch}${label}</button>`;
  }).join('');
  el.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => onPick(btn.dataset.value));
  });
}

function renderModels() {
  document.getElementById('model-list').innerHTML = MODELS.map(m => `<option value="${m}">`).join('');
  renderChips(document.getElementById('model-chips'), MODELS, value => {
    modelInput.value = value === 'Other' ? '' : value;
    state.model = modelInput.value;
    if (value === 'Other') modelInput.focus();
    selectChip(document.getElementById('model-chips'), value);
    updateUI();
  }, state.model);
}

function renderYears() {
  renderChips(document.getElementById('year-chips'), YEARS, value => {
    state.year = value;
    selectChip(document.getElementById('year-chips'), value);
    updateUI();
  }, state.year);
}

function renderColors() {
  renderChips(document.getElementById('color-chips'), COLORS, value => {
    state.color = value;
    selectChip(document.getElementById('color-chips'), value);
    updateUI();
  }, state.color);
}

function renderGrades() {
  renderChips(document.getElementById('grade-chips'), GRADES, value => {
    state.grade = value;
    selectChip(document.getElementById('grade-chips'), value);
    updateUI();
  }, state.grade);
}

function renderBudgets() {
  renderChips(document.getElementById('budget-chips'), BUDGETS.map(b => ({ id: String(b.value), label: b.label })), value => {
    state.budget = value;
    budgetInput.value = formatRs(value);
    selectChip(document.getElementById('budget-chips'), value);
    updateUI();
  }, state.budget);
}

function renderIntents() {
  const el = document.getElementById('intent-grid');
  el.innerHTML = INTENTS.map(item => `
    <button type="button" class="intent-card${state.intent === item.id ? ' selected' : ''}" data-value="${item.id}">
      <strong>${item.title}</strong>
      <span>${item.sub}</span>
    </button>
  `).join('');
  el.querySelectorAll('.intent-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.intent = btn.dataset.value;
      selectChip(el, state.intent);
      updateUI();
    });
  });
}

function renderCities() {
  document.getElementById('city-list').innerHTML = CITIES.map(c => `<option value="${c}">`).join('');
  renderChips(document.getElementById('city-chips'), CITIES, value => {
    cityInput.value = value === 'Other' ? '' : value;
    state.city = cityInput.value;
    if (value === 'Other') cityInput.focus();
    selectChip(document.getElementById('city-chips'), value);
    updateUI();
  }, state.city);
}

function saveLocal(inquiry) {
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    items = [];
  }
  items.unshift({
    ...inquiry,
    id: inquiry.sid,
    time: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 500)));
}

function sheetPhone(raw) {
  const p = String(raw || '').replace(/\s+/g, '');
  if (p.startsWith('+94')) return '0' + p.slice(3);
  if (p.startsWith('94') && p.length >= 11) return '0' + p.slice(2);
  return p.replace(/^\+/, '');
}

function inquiryParams(inquiry) {
  const phone = sheetPhone(inquiry.phone);
  const note = [
    inquiry.name,
    phone,
    inquiry.model,
    inquiry.year,
    inquiry.color,
    inquiry.grade,
    inquiry.budgetLabel,
    inquiry.intent,
    inquiry.city,
    inquiry.note
  ].filter(Boolean).join(' | ').slice(0, 400);
  const params = new URLSearchParams();
  params.set('s1', '1');
  params.set('s2', '1');
  params.set('s3', '1');
  params.set('note', note);
  params.set('type', 'vehicle');
  if (inquiry.sid) params.set('sid', String(inquiry.sid));
  if (inquiry.model) params.set('model', String(inquiry.model));
  if (inquiry.name) params.set('name', String(inquiry.name));
  if (phone) params.set('phone', phone);
  if (inquiry.city) params.set('city', String(inquiry.city));
  if (inquiry.year) params.set('year', String(inquiry.year));
  if (inquiry.color) params.set('color', String(inquiry.color));
  return params;
}

async function saveToSheet(inquiry) {
  const params = inquiryParams(inquiry);
  let apiOk = false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('/api/inquiry?' + params.toString(), {
      cache: 'no-store',
      signal: ctrl.signal
    });
    const data = await res.json();
    apiOk = !!(data && data.ok);
  } catch {
    apiOk = false;
  } finally {
    clearTimeout(timer);
  }

  const scriptUrl = typeof SHEET_URL === 'string' ? SHEET_URL : '';
  if (scriptUrl) {
    await new Promise((resolve) => {
      const img = new Image();
      const done = () => resolve(true);
      img.onload = done;
      img.onerror = done;
      img.src = scriptUrl + '?' + params.toString();
      setTimeout(done, 1800);
    });
  }
  return apiOk || !!scriptUrl;
}

modelInput.addEventListener('input', () => {
  state.model = modelInput.value;
  const match = MODELS.find(m => m.toLowerCase() === modelInput.value.trim().toLowerCase());
  selectChip(document.getElementById('model-chips'), match || (modelInput.value ? 'Other' : ''));
  updateUI();
});

cityInput.addEventListener('input', () => {
  state.city = cityInput.value;
  const match = CITIES.find(c => c.toLowerCase() === cityInput.value.trim().toLowerCase());
  selectChip(document.getElementById('city-chips'), match || (cityInput.value ? 'Other' : ''));
  updateUI();
});

budgetInput.addEventListener('input', () => {
  const digits = parseBudget(budgetInput.value);
  state.budget = digits;
  budgetInput.value = formatRs(digits);
  const match = BUDGETS.find(b => String(b.value) === digits);
  selectChip(document.getElementById('budget-chips'), match ? String(match.value) : '');
  updateUI();
});

['name', 'phone', 'note'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateUI);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isReady() || state.submitting) return;
  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';

  const inquiry = getInquiry();
  inquiry.sid = Date.now() + '-' + Math.random().toString(36).slice(2, 9);

  try {
    saveLocal(inquiry);
    const saved = await saveToSheet(inquiry);
    if (!saved) {
      throw new Error('Sheet save failed');
    }
    thankyouSummary.textContent = [inquiry.model, inquiry.year, inquiry.color, `Grade ${inquiry.grade}`, inquiry.budgetLabel, inquiry.intentLabel, inquiry.city, inquiry.name, inquiry.phone].join(' · ');
    overlay.classList.remove('hidden');
  } catch {
    alert('Submit වෙලා නැහැ. නැවත උත්සාහ කරන්න.');
    state.submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Inquiry යවන්න';
  }
});

document.getElementById('close-page')?.addEventListener('click', () => {
  window.close();
  setTimeout(() => {
    location.replace('closed.html');
  }, 150);
});

renderModels();
renderYears();
renderColors();
renderGrades();
renderBudgets();
renderIntents();
renderCities();
updateUI();
