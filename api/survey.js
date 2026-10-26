const https = require('https');

const APPS_SCRIPT =
  'https://script.google.com/macros/s/AKfycbw2VCI5IKVRVX2bUVGOr9d_EAb3HqY7jkelHTrGwJuQbGGd9KD4G5D3hFMH4rRDAysb/exec';

function pingAppsScript(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'visual-research-study/1.0' }
    }, (res) => {
      resolve({
        status: res.statusCode || 0,
        location: String(res.headers.location || '')
      });
      res.resume();
    });
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

function parseBody(req, body) {
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  if (req.method === 'GET') body = Object.assign({}, body, req.query || {});
  return body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if ((!body || !Object.keys(body).length) && req.method !== 'GET') {
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
  body = parseBody(req, body);

  const payload = {
    sid: String(body.sid || ''),
    note: String(body.note || body.extranote || '').slice(0, 500),
    r1: String(body.r1 || '').slice(0, 80),
    r2: String(body.r2 || '').slice(0, 80),
    r3: String(body.r3 || '').slice(0, 80)
  };
  for (let i = 1; i <= 6; i++) {
    const key = 's' + i;
    payload[key] = String(body[key] != null ? body[key] : '') === '1' ? '1' : '0';
  }

  let selected = 0;
  for (let n = 1; n <= 6; n++) {
    if (payload['s' + n] === '1') selected += 1;
  }
  if (selected < 1) {
    return res.status(200).json({ ok: false, error: 'no-selection' });
  }

  const url = APPS_SCRIPT + '?data=' + encodeURIComponent(JSON.stringify(payload));
  let result = { status: 0, location: '' };
  try {
    result = await pingAppsScript(url);
  } catch (err) {
    result = { error: String(err && err.message ? err.message : err) };
  }

  const loc = String(result.location || '').toLowerCase();
  const ok = result.status === 302 && loc.indexOf('script.googleusercontent.com') !== -1;

  return res.status(200).json({ ok, results: [result] });
};
