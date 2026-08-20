const REQUIRED = 3;
const NOTIFY_EMAIL = 'mr1.widanagamage@gmail.com';

const IMAGES = [
  { id: 1, url: 'images/1.png', label: 'Smart Study Area / Free Wifi' },
  { id: 2, url: 'images/2.png', label: 'Mobile Accessories' },
  { id: 3, url: 'images/3.png', label: 'Branded Decants Perfumes' },
  { id: 4, url: 'images/4.png', label: 'Bookshop and Stationery' },
  { id: 5, url: 'images/5.png', label: 'Budget Rice Cafe' },
  { id: 6, url: 'images/6.png', label: 'Smart Cafe' },
];

const selected = new Set();
const grid = document.getElementById('grid');
const counter = document.getElementById('counter');
const hint = document.getElementById('hint');
const submitBtn = document.getElementById('submit');
const overlay = document.getElementById('overlay');
const selectedPicks = document.getElementById('selected-picks');
const extraNote = document.getElementById('extra-note');

function formatNumbers(nums) {
  return nums.map(n => String(n)).join(' · ');
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
    selectedPicks.textContent = `තෝරා ඇත: ${formatNumbers(sorted)}`;
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
    const badge = el.querySelector('.num-badge');
    if (badge) badge.textContent = String(id);
  });
}

function toggle(id) {
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < REQUIRED) selected.add(id);
  updateUI();
}

function renderImages() {
  grid.innerHTML = IMAGES.map(img => `
    <div class="image-item" data-id="${img.id}" tabindex="0" role="button" aria-label="Option ${img.id}">
      <div class="image-wrap">
        <span class="num-badge">${img.id}</span>
        <img src="${img.url}" alt="Option ${img.id}">
      </div>
      <p class="caption"><span class="caption-num">${img.id}</span></p>
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

async function saveToSheet(numbers, note) {
  if (typeof SHEET_URL !== 'string' || !SHEET_URL.trim()) return;
  const params = new URLSearchParams({
    t: new Date().toISOString(),
    c1: numbers[0] || '',
    c2: numbers[1] || '',
    c3: numbers[2] || '',
    note: note || '',
  });
  await fetch(`${SHEET_URL.trim()}?${params}`, { mode: 'no-cors' });
}

async function saveToEmail(numbers, note) {
  const body = new FormData();
  body.append('_subject', 'Anuradhapura Survey — new response');
  body.append('Number 1', numbers[0] || '');
  body.append('Number 2', numbers[1] || '');
  body.append('Number 3', numbers[2] || '');
  body.append('Extra note', note || '—');
  body.append('_captcha', 'false');
  body.append('_template', 'table');
  const res = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('Submit failed');
}

submitBtn.addEventListener('click', async () => {
  if (selected.size !== REQUIRED) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';

  const numbers = [...selected].sort((a, b) => a - b);
  const note = extraNote.value.trim();

  try {
    await Promise.all([saveToSheet(numbers, note), saveToEmail(numbers, note)]);
    overlay.classList.remove('hidden');
  } catch {
    alert('Submit වෙලා නැහැ. නැවත උත්සාහ කරන්න.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit කරන්න';
  }
});

renderImages();
