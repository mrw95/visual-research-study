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
    var p = String(raw || '').replace(/\s+/g, '');
    if (p.indexOf('+94') === 0) return '0' + p.slice(3);
    if (p.indexOf('94') === 0 && p.length >= 11) return '0' + p.slice(2);
    return p.replace(/^\+/, '');
  }

  var params = new URLSearchParams();
  var fields = {
    model: body.model,
    year: body.year,
    color: body.color,
    grade: body.grade,
    budget: body.budgetLabel || body.budget,
    intent: body.intent,
    city: body.city,
    name: body.name,
    phone: sheetPhone(body.phone),
    extranote: body.extranote || body.note,
    sid: body.sid || String(Date.now())
  };
  Object.keys(fields).forEach(function (key) {
    if (fields[key]) params.set(key, String(fields[key]).slice(0, 80));
  });

  var sheets = [
    'https://script.google.com/macros/s/AKfycby4hFm7G6BUQPom7r9nbpFNtNMJpNhVRc4v8Np94CwugW6dak45StG3YYw8DzDlLuGs/exec'
  ];

  var results = [];
  for (var i = 0; i < sheets.length; i++) {
    try {
      var response = await fetch(sheets[i] + '?' + params.toString(), { redirect: 'follow' });
      var text = await response.text();
      results.push({ status: response.status, text: String(text).slice(0, 200) });
    } catch (err) {
      results.push({ error: String(err && err.message ? err.message : err) });
    }
  }

  var ok = results.some(function (item) {
    var t = String(item.text || '').toLowerCase().trim();
    return t === 'ok' || t.indexOf('ok') === 0;
  });

  return res.status(200).json({ ok: ok, results: results });
};
