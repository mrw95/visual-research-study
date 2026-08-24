const STORAGE_KEY = 'vrs-vehicle-inquiries';

const search = document.getElementById('search');
const yearFilter = document.getElementById('year-filter');
const colorFilter = document.getElementById('color-filter');
const cityFilter = document.getElementById('city-filter');
const summary = document.getElementById('summary');
const list = document.getElementById('list');
const intentFilters = document.getElementById('intent-filters');

let intent = '';

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function unique(items, key) {
  return [...new Set(items.map(x => x[key]).filter(Boolean))];
}

function fillSelect(el, values, allLabel) {
  const current = el.value;
  el.innerHTML = `<option value="">${allLabel}</option>` + values.map(v => `<option value="${v}">${v}</option>`).join('');
  if (values.includes(current)) el.value = current;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
}

function matches(item) {
  const q = search.value.trim().toLowerCase();
  if (intent && item.intent !== intent) return false;
  if (yearFilter.value && item.year !== yearFilter.value) return false;
  if (colorFilter.value && item.color !== colorFilter.value) return false;
  if (gradeFilter.value && item.grade !== gradeFilter.value) return false;
  if (cityFilter.value && item.city !== cityFilter.value) return false;
  if (!q) return true;
  const blob = [item.model, item.year, item.color, item.grade, item.budgetLabel, item.intentLabel, item.city, item.name, item.phone, item.note].join(' ').toLowerCase();
  return blob.includes(q);
}

function render() {
  const items = loadItems();
  fillSelect(yearFilter, unique(items, 'year'), 'All years');
  fillSelect(colorFilter, unique(items, 'color'), 'All colors');
  fillSelect(gradeFilter, unique(items, 'grade'), 'All grades');
  fillSelect(cityFilter, unique(items, 'city'), 'All cities');

  const shown = items.filter(matches);
  summary.textContent = `${shown.length} / ${items.length} inquiries`;
  if (!shown.length) {
    list.innerHTML = `<section class="card"><p class="hint">Inquiries නැහැ. Hotline form එකෙන් submit කරලා ආයෙත් මෙතනට එන්න.</p></section>`;
    return;
  }

  list.innerHTML = shown.map(item => `
    <article class="card inquiry-card">
      <div class="inquiry-top">
        <span class="intent-badge ${item.intent === 'buy_now' ? 'ready' : 'asking'}">${item.intentLabel || item.intent}</span>
        <span class="inquiry-time">${formatTime(item.time)}</span>
      </div>
      <h2>${item.model || '—'} <span class="year-tag">${item.year || ''}</span></h2>
      <p class="inquiry-meta">${[item.city, item.color, item.grade && `Grade ${item.grade}`, item.budgetLabel].filter(Boolean).join(' · ')}</p>
      ${item.name || item.phone ? `<p class="inquiry-contact">${[item.name, item.phone].filter(Boolean).join(' · ')}</p>` : ''}
      ${item.note ? `<p class="inquiry-note">${item.note}</p>` : ''}
    </article>
  `).join('');
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

document.getElementById('export-csv').addEventListener('click', () => {
  const items = loadItems().filter(matches);
  const headers = ['Time', 'Model', 'Year', 'Color', 'Grade', 'Budget', 'Intent', 'City', 'Name', 'Phone', 'Note'];
  const rows = items.map(i => [formatTime(i.time), i.model, i.year, i.color, i.grade, i.budgetLabel || i.budget, i.intentLabel || i.intent, i.city, i.name, i.phone, i.note].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vehicle-inquiries.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

intentFilters.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    intent = btn.dataset.intent;
    intentFilters.querySelectorAll('.chip').forEach(el => el.classList.toggle('selected', el === btn));
    render();
  });
});

[search, yearFilter, colorFilter, gradeFilter, cityFilter].forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

render();
