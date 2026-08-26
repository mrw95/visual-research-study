const YEARS = ['2023', '2024', '2025', '2026'];
const COLORS = [
  { id: 'Black', label: 'Black / කළු', swatch: '#1a1a1a' },
  { id: 'White', label: 'White / සුදු', swatch: '#f4f4f4' }
];
const LEASING = [
  { id: 'yes', label: 'ඔව් / Yes' },
  { id: 'no', label: 'නැහැ / No' }
];

const STORAGE_KEY = 'vrs-vehicle-inquiries';

const form = document.getElementById('hotline-form');
const modelInput = document.getElementById('model');
const yearInput = document.getElementById('year');
const colorInput = document.getElementById('color');
const cityInput = document.getElementById('city');
const budgetInput = document.getElementById('budget');
const submitBtn = document.getElementById('submit');
const preview = document.getElementById('preview');
const overlay = document.getElementById('overlay');
const thankyouSummary = document.getElementById('thankyou-summary');

const state = {
  leasing: '',
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

function leasingLabel(id) {
  if (id === 'yes') return 'ඔව්';
  if (id === 'no') return 'නැහැ';
  return '';
}

function getInquiry() {
  const leasing = state.leasing;
  return {
    type: 'vehicle',
    model: modelInput.value.trim(),
    year: yearInput.value.trim(),
    color: colorInput.value.trim(),
    budget: parseBudget(budgetInput.value),
    budgetLabel: parseBudget(budgetInput.value) ? `Rs. ${formatRs(parseBudget(budgetInput.value))}` : '',
    leasing,
    intent: leasing,
    intentLabel: leasing ? `Leasing ${leasingLabel(leasing)}` : '',
    city: cityInput.value.trim(),
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    note: document.getElementById('note').value.trim()
  };
}

function isReady() {
  const q = getInquiry();
  return q.model && q.year && q.color && q.budget && q.leasing && q.city && q.name && q.phone;
}

function updatePreview() {
  const q = getInquiry();
  const bits = [q.model, q.year, q.color, q.budgetLabel, q.intentLabel, q.city, q.name, q.phone].filter(Boolean);
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
}

function selectChip(container, value) {
  container.querySelectorAll('.chip').forEach(el => {
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

function renderYears() {
  renderChips(document.getElementById('year-chips'), YEARS, value => {
    yearInput.value = value;
    selectChip(document.getElementById('year-chips'), value);
    updateUI();
  }, yearInput.value);
}

function renderColors() {
  renderChips(document.getElementById('color-chips'), COLORS, value => {
    colorInput.value = value;
    selectChip(document.getElementById('color-chips'), value);
    updateUI();
  }, colorInput.value);
}

function renderLeasing() {
  renderChips(document.getElementById('leasing-chips'), LEASING, value => {
    state.leasing = value;
    selectChip(document.getElementById('leasing-chips'), value);
    updateUI();
  }, state.leasing);
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
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0094')) d = d.slice(4);
  else if (d.startsWith('94') && d.length >= 11) d = d.slice(2);
  if (d && d[0] !== '0' && d.length === 9) d = '0' + d;
  return d;
}

function inquiryPayload(inquiry) {
  return {
    name: String(inquiry.name || '').trim(),
    phone: sheetPhone(inquiry.phone),
    model: inquiry.model,
    year: inquiry.year,
    color: inquiry.color,
    budget: inquiry.budget,
    intent: inquiry.intentLabel,
    city: inquiry.city,
    note: inquiry.note
  };
}

async function saveToSheet(inquiry) {
  const payload = inquiryPayload(inquiry);
  const api = 'https://visual-research-study.vercel.app/api/inquiry';
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      const data = await res.json();
      if (data && data.ok) return true;
    } catch {
      // retry with GET
    }
    try {
      const params = new URLSearchParams();
      Object.keys(payload).forEach((key) => {
        if (payload[key]) params.set(key, String(payload[key]));
      });
      const res = await fetch(api + '?' + params.toString(), { cache: 'no-store' });
      const data = await res.json();
      if (data && data.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

modelInput.addEventListener('input', updateUI);
cityInput.addEventListener('input', updateUI);

yearInput.addEventListener('input', () => {
  const year = yearInput.value.replace(/[^\d]/g, '').slice(0, 4);
  yearInput.value = year;
  selectChip(document.getElementById('year-chips'), YEARS.includes(year) ? year : '');
  updateUI();
});

colorInput.addEventListener('input', () => {
  const color = colorInput.value.trim();
  const match = COLORS.find(c => c.id.toLowerCase() === color.toLowerCase());
  selectChip(document.getElementById('color-chips'), match ? match.id : '');
  updateUI();
});

budgetInput.addEventListener('input', () => {
  const digits = parseBudget(budgetInput.value);
  budgetInput.value = formatRs(digits);
  updateUI();
});

['name', 'note'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateUI);
});
document.getElementById('phone').addEventListener('input', updateUI);
document.getElementById('phone').addEventListener('blur', () => {
  const phone = document.getElementById('phone');
  phone.value = sheetPhone(phone.value);
  updateUI();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isReady() || state.submitting) return;
  state.submitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';

  const inquiry = getInquiry();
  inquiry.phone = sheetPhone(inquiry.phone);
  document.getElementById('phone').value = inquiry.phone;
  inquiry.sid = Date.now() + '-' + Math.random().toString(36).slice(2, 9);

  try {
    const saved = saveToSheet(inquiry);
    saveLocal(inquiry);
    if (!(await saved)) {
      throw new Error('Sheet save failed');
    }
    thankyouSummary.textContent = [inquiry.model, inquiry.year, inquiry.color, inquiry.budgetLabel, inquiry.intentLabel, inquiry.city, inquiry.name, inquiry.phone].join(' · ');
    overlay.classList.remove('hidden');
  } catch {
    alert('Google Sheet එකට ගිහින් නැහැ. Signal එක හොඳද බලලා නැවත Submit කරන්න.');
    state.submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Inquiry Submit';
  }
});

document.getElementById('close-page')?.addEventListener('click', () => {
  window.close();
  setTimeout(() => {
    location.replace('closed.html');
  }, 150);
});

renderYears();
renderColors();
renderLeasing();
updateUI();
