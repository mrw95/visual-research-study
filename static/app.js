const REQUIRED = 3;

const IMG_V = '15';

const IMAGES = [
  { id: 1, url: `images/1.png?v=${IMG_V}`, label: 'Smart Study Area with AC / Free Wifi' },
  { id: 2, url: `images/2.png?v=${IMG_V}`, label: 'Mobile Accessories' },
  { id: 3, url: `images/3.png?v=${IMG_V}`, label: 'Transport Bus Service' },
  { id: 4, url: `images/4.png?v=${IMG_V}`, label: 'Bookshop and Stationery' },
  { id: 5, url: `images/5.png?v=${IMG_V}`, label: 'Budget Price Cafe' },
  { id: 6, url: `images/6.png?v=${IMG_V}`, label: 'Water Park' },
];

const picks = [];
const grid = document.getElementById('grid');
const counter = document.getElementById('counter');
const submitBtn = document.getElementById('submit');
const overlay = document.getElementById('overlay');
const selectedPicks = document.getElementById('selected-picks');
const extraNote = document.getElementById('extra-note');
let submitting = false;

function labelFor(id) {
  return IMAGES.find(img => img.id === id)?.label || '';
}

function updateUI() {
  const count = picks.length;
  counter.textContent = `${count} / ${REQUIRED} තෝරා ඇත`;
  submitBtn.disabled = count !== REQUIRED;

  if (count > 0) {
    selectedPicks.innerHTML = `<strong>තෝරා ඇත:</strong><br>${picks.map((id, i) => `${i + 1}. ${labelFor(id)}`).join('<br>')}`;
    selectedPicks.classList.remove('hidden');
  } else {
    selectedPicks.textContent = '';
    selectedPicks.classList.add('hidden');
  }

  document.querySelectorAll('.image-item').forEach(el => {
    const id = Number(el.dataset.id);
    const rank = picks.indexOf(id) + 1;
    el.classList.toggle('selected', rank > 0);
    el.classList.toggle('disabled', count >= REQUIRED && rank === 0);
    const name = el.querySelector('.caption-name');
    if (name) name.dataset.rank = rank ? String(rank) : '';
  });
}

function toggle(id) {
  const index = picks.indexOf(id);
  if (index >= 0) picks.splice(index, 1);
  else if (picks.length < REQUIRED) picks.push(id);
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

function saveToSheet(order, note, sid) {
  const payload = {
    sid,
    note: note || '',
    r1: labelFor(order[0]) || '',
    r2: labelFor(order[1]) || '',
    r3: labelFor(order[2]) || ''
  };
  for (let i = 1; i <= 6; i++) {
    payload['s' + i] = order.includes(i) ? '1' : '0';
  }

  const api = 'https://visual-research-study.vercel.app/api/survey';
  const body = JSON.stringify(payload);
  const query = `${api}?${new URLSearchParams(payload)}`;

  try {
    navigator.sendBeacon(api, new Blob([body], { type: 'application/json' }));
  } catch {
    // fetch below
  }
  fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
    keepalive: true
  }).catch(() => {});
  const ping = new Image();
  ping.src = query;
}

function saveToEmail(order, note) {
  const body = new FormData();
  body.append('_subject', 'Anuradhapura Survey — new response');
  body.append('1st choice', labelFor(order[0]) || '—');
  body.append('2nd choice', labelFor(order[1]) || '—');
  body.append('3rd choice', labelFor(order[2]) || '—');
  IMAGES.forEach(img => {
    body.append(img.label, order.includes(img.id) ? '✓' : '—');
  });
  body.append('Extra note', note || '—');
  body.append('_captcha', 'false');
  body.append('_template', 'table');
  fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, { method: 'POST', body, keepalive: true }).catch(() => {});
}

submitBtn.addEventListener('click', () => {
  if (picks.length !== REQUIRED || submitting) return;
  submitting = true;
  submitBtn.disabled = true;

  const order = [...picks];
  const note = extraNote.value.trim();
  const sid = Date.now() + '-' + Math.random().toString(36).slice(2, 9);

  saveToSheet(order, note, sid);
  saveToEmail(order, note);
  overlay.classList.remove('hidden');
  document.getElementById('close-page')?.focus();
});

document.getElementById('close-page')?.addEventListener('click', () => {
  window.close();
  setTimeout(() => {
    if (!window.closed) {
      window.history.length > 1 ? window.history.back() : window.location.replace('about:blank');
    }
  }, 200);
});

renderImages();
