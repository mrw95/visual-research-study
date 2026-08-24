module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};
  if (req.method === 'GET') body = Object.assign({}, body, req.query || {});

  const sheets = [
    'https://script.google.com/macros/s/AKfycbw2VCI5IKVRVX2bUVGOr9d_EAb3HqY7jkelHTrGwJuQbGGd9KD4G5D3hFMH4rRDAysb/exec',
    'https://script.google.com/macros/s/AKfycby4hFm7G6BUQPom7r9nbpFNtNMJpNhVRc4v8Np94CwugW6dak45StG3YYw8DzDlLuGs/exec'
  ];

  const packed = [
    'VEHICLE',
    body.name,
    body.phone,
    body.model,
    body.year,
    body.color,
    body.grade,
    body.budgetLabel,
    body.intent,
    body.city,
    body.note
  ].filter(Boolean).join(' | ');

  const params = new URLSearchParams({
    type: 'vehicle',
    model: body.model || '',
    year: body.year || '',
    color: body.color || '',
    grade: body.grade || '',
    budget: body.budget || '',
    budgetLabel: body.budgetLabel || '',
    intent: body.intent || '',
    city: body.city || '',
    name: body.name || '',
    phone: body.phone || '',
    extranote: body.note || '',
    note: packed,
    sid: body.sid || String(Date.now()),
    s1: '1',
    s2: '1',
    s3: '1',
    s4: '0',
    s5: '0',
    s6: '0'
  });

  const results = [];
  for (const base of sheets) {
    try {
      const response = await fetch(base + '?' + params.toString(), { redirect: 'follow' });
      const text = await response.text();
      results.push({ status: response.status, text: String(text).slice(0, 200) });
    } catch (err) {
      results.push({ error: String(err && err.message ? err.message : err) });
    }
  }

  const ok = results.some(function (item) {
    return String(item.text || '').toLowerCase().indexOf('ok') !== -1;
  });

  return res.status(200).json({ ok: ok, results: results });
};
