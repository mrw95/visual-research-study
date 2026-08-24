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

  var params = new URLSearchParams();
  var name = String(body.name || body.customer || '').trim();
  if (name) params.set('name', name.slice(0, 120));
  var fields = {
    model: body.model,
    year: body.year,
    color: body.color,
    grade: body.grade,
    budget: body.budgetLabel || body.budget,
    intent: body.intent,
    city: body.city,
    phone: sheetPhone(body.phone),
    extranote: body.extranote || body.note,
    sid: body.sid || String(Date.now())
  };
  Object.keys(fields).forEach(function (key) {
    var max = key === 'extranote' ? 120 : 80;
    if (fields[key]) params.set(key, String(fields[key]).slice(0, max));
  });

  var sheets = [
    'https://script.google.com/macros/s/AKfycby4hFm7G6BUQPom7r9nbpFNtNMJpNhVRc4v8Np94CwugW6dak45StG3YYw8DzDlLuGs/exec'
  ];

  async function hit(query) {
    try {
      var response = await fetch(sheets[0] + '?' + query.toString(), { redirect: 'follow' });
      var text = await response.text();
      return { status: response.status, text: String(text).slice(0, 200) };
    } catch (err) {
      return { error: String(err && err.message ? err.message : err) };
    }
  }

  function isOk(item) {
    var t = String(item && item.text ? item.text : '').toLowerCase().trim();
    return t === 'ok' || t.indexOf('ok') === 0;
  }

  var results = [];
  var first = await hit(params);
  results.push(first);
  if (!isOk(first)) {
    var shortParams = new URLSearchParams();
    if (name) shortParams.set('name', name.slice(0, 120));
    if (fields.phone) shortParams.set('phone', fields.phone);
    if (fields.model) shortParams.set('model', String(fields.model).slice(0, 80));
    results.push(await hit(shortParams));
  }

  var ok = results.some(isOk);

  return res.status(200).json({ ok: ok, results: results });
};
