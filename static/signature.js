/* Turn a photo of a signature into ink on a transparent background.
   The pen colour stays as it was on the paper. */
function prepareSignatureFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const long = Math.max(img.width, img.height);
        const scale = Math.min(1, 1400 / long);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(knockOutSignatureBackground(canvas).toDataURL('image/png'));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Signature image read failed'));
    };
    img.src = url;
  });
}

function knockOutSignatureBackground(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  let samples = 0;
  let clear = 0;
  const probe = Math.max(1, Math.floor((w * h) / 6000));
  for (let y = 0; y < h; y += probe) {
    for (let x = 0; x < w; x += probe) {
      samples += 1;
      if (d[(y * w + x) * 4 + 3] < 16) clear += 1;
    }
  }
  if (samples && clear / samples > 0.08) return cropInk(canvas, d, w, h);

  const pts = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 50));
  const inset = 2;
  function push(x, y) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 200) pts.push([d[i], d[i + 1], d[i + 2]]);
  }
  for (let x = 0; x < w; x += step) {
    push(x, Math.min(h - 1, inset));
    push(x, Math.max(0, h - 1 - inset));
  }
  for (let y = 0; y < h; y += step) {
    push(Math.min(w - 1, inset), y);
    push(Math.max(0, w - 1 - inset), y);
  }
  if (pts.length < 8) return cropInk(canvas, d, w, h);

  function median(ch) {
    const vals = pts.map((p) => p[ch]).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }
  const paper = [median(0), median(1), median(2)];
  function dist(r, g, b) {
    return Math.hypot(r - paper[0], g - paper[1], b - paper[2]);
  }
  const dists = pts.map((p) => dist(p[0], p[1], p[2])).sort((a, b) => a - b);
  const noise = dists[Math.floor(dists.length * 0.9)] || 0;
  const paperCut = Math.max(16, noise * 2.4 + 8);
  const inkFull = paperCut + 42;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    if (a < 16) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    const delta = dist(r, g, b);
    if (delta <= paperCut) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    let t = (delta - paperCut) / (inkFull - paperCut);
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t);
    if (t < 0.04) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    d[i] = Math.max(0, Math.min(255, Math.round((r - paper[0] * (1 - t)) / t)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round((g - paper[1] * (1 - t)) / t)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round((b - paper[2] * (1 - t)) / t)));
    d[i + 3] = Math.round(t * (a / 255) * 255);
  }

  const alphaAt = (x, y) => d[(y * w + x) * 4 + 3];
  const kill = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alphaAt(x, y) < 20) continue;
      let friends = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx += 1) {
          if ((xx !== x || yy !== y) && alphaAt(xx, yy) > 40) friends += 1;
        }
      }
      if (friends < 1) kill.push(y * w + x);
    }
  }
  kill.forEach((p) => {
    const i = p * 4;
    d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
  });

  ctx.putImageData(image, 0, 0);
  return cropInk(canvas, d, w, h);
}

function cropInk(canvas, d, w, h) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let kept = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (d[(y * w + x) * 4 + 3] > 18) {
        kept += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!kept || maxX < minX || maxY < minY) return canvas;
  const pad = 10;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const cw = Math.min(w - x, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - y, maxY - minY + 1 + pad * 2);
  const cropped = document.createElement('canvas');
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext('2d').drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
  return cropped;
}
