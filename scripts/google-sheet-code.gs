function tick(v) {
  if (!v || v === '') return '';
  return '✓';
}

function rowMatches(last, next) {
  for (var i = 1; i < next.length; i++) {
    if (String(last[i] || '') !== String(next[i] || '')) return false;
  }
  return true;
}

function doGet(e) {
  var p = e.parameter;
  var sid = p.sid || '';

  // Block duplicate within 60 seconds (same submit id)
  if (sid) {
    var cache = CacheService.getScriptCache();
    if (cache.get(sid)) {
      return ContentService.createTextOutput('ok');
    }
    cache.put(sid, '1', 60);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  var headers = [
    'Time',
    'Smart Study Area with AC / Free Wifi',
    'Mobile Accessories',
    'Branded Decants Perfumes',
    'Bookshop and Stationery',
    'Budget Price Cafe',
    'Smart Cafe',
    'Extra note'
  ];

  var newRow = [
    p.t || new Date(),
    tick(p.s1), tick(p.s2), tick(p.s3),
    tick(p.s4), tick(p.s5), tick(p.s6),
    p.note || ''
  ];

  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  // Block exact duplicate of last row (same ticks + note)
  if (sh.getLastRow() > 1) {
    var last = sh.getRange(sh.getLastRow(), 1, 1, newRow.length).getValues()[0];
    if (rowMatches(last, newRow)) {
      return ContentService.createTextOutput('ok');
    }
  }

  sh.appendRow(newRow);
  return ContentService.createTextOutput('ok');
}
