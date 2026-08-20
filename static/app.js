const REQUIRED = 3;
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
  if (selected.has(id)) {
    selected.delete(id);
  } else if (selected.size < REQUIRED) {
    selected.add(id);
  }
  updateUI();
}

async function loadImages() {
  const res = await fetch('/api/images');
  const data = await res.json();
  const images = data.images || [];
  if (images.length === 0) {
    grid.innerHTML = '<p>Images load වෙලා නැහැ.</p>';
    return;
  }
  grid.innerHTML = images.map(img => `
    <div class="image-item" data-id="${img.id}" tabindex="0" role="button" aria-pressed="false">
      <div class="image-wrap">
        <span class="check">✓</span>
        <img src="${img.url}" alt="${img.label || ''}">
      </div>
      <p class="caption">${img.label || 'Option ' + img.id}</p>
    </div>
  `).join('');

  grid.querySelectorAll('.image-item').forEach(el => {
    const id = Number(el.dataset.id);
    const activate = () => toggle(id);
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
  updateUI();
}

submitBtn.addEventListener('click', async () => {
  if (selected.size !== REQUIRED) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'යවමින්...';
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected: [...selected] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit failed');
    overlay.classList.remove('hidden');
  } catch (err) {
    alert(err.message || 'Submit වෙලා නැහැ. නැවත උත්සාහ කරන්න.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'ඉදිරියට යන්න';
  }
});

loadImages();
