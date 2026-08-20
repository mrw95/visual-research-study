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

function updateUI() {
  const count = selected.size;
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
  document.querySelectorAll('.image-item').forEach(el => {
    const id = Number(el.dataset.id);
    el.classList.toggle('selected', selected.has(id));
    el.classList.toggle('disabled', count >= REQUIRED && !selected.has(id));
  });
}

function toggle(id) {
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < REQUIRED) selected.add(id);
  updateUI();
}

function renderImages() {
  grid.innerHTML = IMAGES.map(img => `
    <div class="image-item" data-id="${img.id}" tabindex="0" role="button">
      <div class="image-wrap">
        <span class="check">✓</span>
        <img src="${img.url}" alt="${img.label}">
      </div>
      <p class="caption">${img.label}</p>
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

submitBtn.addEventListener('click', async () => {
  if (selected.size !== REQUIRED) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';

  const labels = [...selected].sort((a, b) => a - b).map(id =>
    IMAGES.find(img => img.id === id)?.label || `Option ${id}`
  );

  try {
    const body = new FormData();
    body.append('_subject', 'Anuradhapura Survey — new response');
    body.append('Selected', labels.join(' | '));
    body.append('_captcha', 'false');
    body.append('_template', 'table');

    const res = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
      method: 'POST',
      body,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error('Submit failed');
    overlay.classList.remove('hidden');
  } catch {
    alert('Submit වෙලා නැහැ. නැවත උත්සාහ කරන්න.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit කරන්න';
  }
});

renderImages();
