const REQUIRED = 3;
const NOTIFY_EMAIL = 'mr1.widanagamage@gmail.com';

const IMG_V = '10';

const IMAGES = [
  { id: 1, url: `images/1.png?v=${IMG_V}`, label: 'Smart Study Area with AC / Free Wifi' },
  { id: 2, url: `images/2.png?v=${IMG_V}`, label: 'Mobile Accessories' },
  { id: 3, url: `images/3.png?v=${IMG_V}`, label: 'Branded Decants Perfumes' },
  { id: 4, url: `images/4.png?v=${IMG_V}`, label: 'Bookshop and Stationery' },
  { id: 5, url: `images/5.png?v=${IMG_V}`, label: 'Budget Price Cafe' },
  { id: 6, url: `images/6.png?v=${IMG_V}`, label: 'Smart Cafe' },
];

const selected = new Set();
const grid = document.getElementById('grid');
const counter = document.getElementById('counter');
const hint = document.getElementById('hint');
const submitBtn = document.getElementById('submit');
const overlay = document.getElementById('overlay');
const selectedPicks = document.getElementById('selected-picks');
const extraNote = document.getElementById('extra-note');
let submitting = false;

function labelFor(id) {
  return IMAGES.find(img => img.id === id)?.label || '';
}

function formatSelected(ids) {
  return ids.map(id => labelFor(id)).join(' · ');
}

function updateUI() {
  const count = selected.size;
  const sorted = [...selected].sort((a, b) => a - b);
  counter.textContent = `${count} / ${REQUIRED} තෝරා ඇත`;
  const left = REQUIRED - count;

  if (count === REQUIRED) {
    hint.textContent = 'Submit කරන්න පුළුවන්.';
    hint.classList.add('ready');
    submitBtn.disabled = false;
  } else {
    hint.textContent = `තව විකල්ප ${left}ක් තෝරන්න.`;
    hint.classList.remove('ready');
    submitBtn.disabled = true;
  }

  if (count > 0) {
    selectedPicks.innerHTML = `<strong>තෝරා ඇත:</strong><br>${formatSelected(sorted).replace(/ · /g, '<br>')}`;
    selectedPicks.classList.remove('hidden');
  } else {
    selectedPicks.textContent = '';
    selectedPicks.classList.add('hidden');
  }

  document.querySelectorAll('.image-item').forEach(el => {
    const id = Number(el.dataset.id);
    const isSelected = selected.has(id);
    el.classList.toggle('selected', isSelected);
    el.classList.toggle('disabled', count >= REQUIRED && !isSelected);
  });
}

function toggle(id) {
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < REQUIRED) selected.add(id);
  updateUI();
}

function renderImages() {
  grid.innerHTML = IMAGES.map(img => `
    <div class="image-item" data-id="${img.id}" tabindex="0" role="button" aria-label="${img.label}">
      <div class="image-wrap">
        <img src="${img.url}" alt="${img.label}">
      </div>
      <p class="caption"><span class="caption-name">${img.label}</span></p>
    </div>
  `).join('');

  grid.querySelectorAll('.image-item').forEach(el => {
    const id = Number(el.dataset.id);
    const activate = () => toggle(id);
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
  updateUI();
}

function saveToSheet(numbers, note, sid) {
  if (typeof SHEET_URL !== 'string' || !SHEET_URL.trim()) return Promise.resolve(false);
  const params = new URLSearchParams({
    note: note || '',
    sid: sid,
  });
  for (let i = 1; i <= 6; i++) {
    params.set('s' + i, numbers.includes(i) ? '1' : '');
  }
  const url = `${SHEET_URL.trim()}?${params.toString()}`;
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;border:0';
    iframe.onload = () => setTimeout(() => { iframe.remove(); resolve(true); }, 800);
    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

async function saveToEmail(numbers, note) {
  const body = new FormData();
  body.append('_subject', 'Anuradhapura Survey — new response');
  IMAGES.forEach(img => {
    body.append(img.label, numbers.includes(img.id) ? '✓' : '—');
  });
  body.append('Extra note', note || '—');
  body.append('_captcha', 'false');
  body.append('_template', 'table');
  const res = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('Submit failed');
}

submitBtn.addEventListener('click', async () => {
  if (selected.size !== REQUIRED || submitting) return;
  submitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';

  const numbers = [...selected].sort((a, b) => a - b);
  const note = extraNote.value.trim();
  const sid = Date.now() + '-' + Math.random().toString(36).slice(2, 9);

  try {
    if (typeof SHEET_URL === 'string' && SHEET_URL.trim()) {
      await saveToSheet(numbers, note, sid);
    }
    try {
      await saveToEmail(numbers, note);
    } catch {
      // Sheet save unoth email fail unath OK
    }
    overlay.classList.remove('hidden');
  } catch {
    alert('Submit වෙලා නැහැ. නැවත උත්සාහ කරන්න.');
    submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit කරන්න';
  }
});

renderImages();
