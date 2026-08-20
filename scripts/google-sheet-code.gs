function getHeaders() {
  return [
    'Time',
    'Smart Study Area with AC / Free Wifi',
    'Mobile Accessories',
    'Branded Decants Perfumes',
    'Bookshop and Stationery',
    'Budget Price Cafe',
    'Smart Cafe',
    'Extra note'
  ];
}

function formatTime(date) {
  return Utilities.formatDate(date, 'Asia/Colombo', 'dd/MM/yyyy HH:mm:ss');
}

function tick(v) {
  if (!v || v === '') return '';
  return '✓';
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses');
  if (!sh) sh = ss.getSheets()[0];
  return sh;
}

function ensureHeaders(sh) {
  if (sh.getLastRow() > 0 && String(sh.getRange(1, 1).getValue()) === 'Time') return;
  var headers = getHeaders();
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function saveResponse(p) {
  var sh = getSheet();
  ensureHeaders(sh);
  sh.appendRow([
    formatTime(new Date()),
    tick(p.s1), tick(p.s2), tick(p.s3),
    tick(p.s4), tick(p.s5), tick(p.s6),
    p.note || ''
  ]);
}

function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var sid = p.sid || '';

    if (sid) {
      var cache = CacheService.getScriptCache();
      if (cache.get(sid)) {
        return ContentService.createTextOutput('ok');
      }
      cache.put(sid, '1', 120);
    }

    saveResponse(p);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doPost(e) {
  return doGet(e);
}

// --- Manual tools (Run from Apps Script editor) ---

function syncHeaders() {
  var sh = getSheet();
  var headers = getHeaders();
  ensureHeaders(sh);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function testSave() {
  saveResponse({ s1: '1', s2: '1', s3: '1', s4: '', s5: '', s6: '', note: 'manual test' });
}

function fixTimeFormat() {
  var sh = getSheet();
  if (sh.getLastRow() < 2) return;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    if (v instanceof Date || String(v).indexOf('T') >= 0 || String(v).indexOf('Z') >= 0) {
      sh.getRange(i + 2, 1).setValue(formatTime(new Date(v)));
    }
  }
}

function removeDuplicates() {
  var sh = getSheet();
  var lastRow = sh.getLastRow();
  if (lastRow < 3) return;
  var width = getHeaders().length;
  var data = sh.getRange(2, 1, lastRow - 1, width).getValues();
  var seen = {};
  var toDelete = [];
  for (var i = 0; i < data.length; i++) {
    var key = data[i].slice(1).join('|');
    if (seen[key]) toDelete.push(i + 2);
    else seen[key] = true;
  }
  toDelete.sort(function(a, b) { return b - a; }).forEach(function(r) { sh.deleteRow(r); });
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Survey')
    .addItem('Test save (1 row)', 'testSave')
    .addItem('Update column names', 'syncHeaders')
    .addItem('Fix time format', 'fixTimeFormat')
    .addItem('Remove duplicate rows', 'removeDuplicates')
    .addToUi();
}
