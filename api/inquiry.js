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
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  if (!Object.keys(body).length && req.method !== 'GET') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }
  if (req.method === 'GET') body = Object.assign({}, body, req.query || {});

  function sheetPhone(raw) {
    var d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.indexOf('+') === 0) d = d.slice(1);
    if (d.indexOf('0094') === 0) d = d.slice(4);
    else if (d.indexOf('94') === 0 && d.length >= 11) d = d.slice(2);
    if (d && d.charAt(0) !== '0' && d.length === 9) d = '0' + d;
    return d;
  }

  var budget = String(body.budget || '').replace(/[^\d]/g, '');
  if (!budget) budget = String(body.budgetLabel || '').replace(/[^\d]/g, '');

  var params = new URLSearchParams();
  var fields = {
    name: String(body.name || body.customer || '').trim(),
    phone: sheetPhone(body.phone),
    model: body.model,
    year: body.year,
    color: body.color,
    grade: body.grade,
    budget: budget,
    intent: body.intent || body.intentLabel,
    city: body.city,
    extranote: body.extranote || body.note
  };
  Object.keys(fields).forEach(function (key) {
    var max = key === 'name' || key === 'extranote' || key === 'city' ? 60 : 40;
    if (fields[key]) params.set(key, String(fields[key]).slice(0, max));
  });

  var sheet = 'https://script.google.com/macros/s/AKfycby4hFm7G6BUQPom7r9nbpFNtNMJpNhVRc4v8Np94CwugW6dak45StG3YYw8DzDlLuGs/exec';

  var result = { status: 0, text: '' };
  try {
    var response = await fetch(sheet + '?' + params.toString(), { redirect: 'follow' });
    result = { status: response.status, text: String(await response.text()).slice(0, 200) };
  } catch (err) {
    result = { error: String(err && err.message ? err.message : err) };
  }

  var t = String(result.text || '').toLowerCase().trim();
  var ok = t === 'ok' || t.indexOf('ok') === 0;

  return res.status(200).json({ ok: ok, results: [result] });
};
