function getHeaders() {
  return [
    'Time',
    '1st choice',
    '2nd choice',
    '3rd choice',
    'Extra note'
  ];
}

function formatTime(date) {
  return Utilities.formatDate(date, 'Asia/Colombo', 'dd/MM/yyyy HH:mm:ss');
}

function tick(v) {
  if (v === '1' || v === 1 || v === true || v === 'true') return '✓';
  return '';
}

function getSpreadsheet() {
  return SpreadsheetApp.openById('1cXOZjcfJ0AXQLaN4mH4wzso4NKd7yDXludJ5_jJByV4');
}

function getSheet() {
  var ss = getSpreadsheet();
  var named = ss.getSheetByName('Responses');
  if (named) return named;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getRange(1, 1).getValue()) === 'Time') return sheets[i];
  }
  return sheets[0];
}

function ensureHeaders(sh) {
  var headers = getHeaders();
  var lastCol = Math.max(sh.getLastColumn(), headers.length);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    if (String(sh.getRange(1, 1).getValue()) !== 'Time') {
      sh.insertRowBefore(1);
    }
    sh.getRange(1, 1, 1, lastCol).clearContent();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function parseParams(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  if (p.data) {
    try {
      var d = JSON.parse(p.data);
      for (var k in d) {
        if (Object.prototype.hasOwnProperty.call(d, k)) p[k] = d[k];
      }
      p.sid = d.sid || p.sid || '';
      p.note = d.note || p.note || '';
      p.r1 = d.r1 || p.r1 || '';
      p.r2 = d.r2 || p.r2 || '';
      p.r3 = d.r3 || p.r3 || '';
      for (var i = 1; i <= 6; i++) {
        p['s' + i] = String(d['s' + i] != null ? d['s' + i] : p['s' + i] || '');
      }
    } catch (err) {}
  }

  return p;
}

function hasSelection(p) {
  if (p.r1) return true;
  for (var i = 1; i <= 6; i++) {
    if (tick(p['s' + i])) return true;
  }
  return false;
}

function saveResponse(p) {
  var sh = getSheet();
  ensureHeaders(sh);
  sh.appendRow([
    formatTime(new Date()),
    p.r1 || '',
    p.r2 || '',
    p.r3 || '',
    p.note || ''
  ]);
}

function handleSubmit(e) {
  try {
    var p = parseParams(e);
    var sid = p.sid || '';

    if (sid) {
      var cache = CacheService.getScriptCache();
      if (cache.get(sid)) {
        return ContentService.createTextOutput('ok');
      }
      cache.put(sid, '1', 120);
    }

    if (!hasSelection(p)) {
      return ContentService.createTextOutput('skip-no-selection');
    }

    saveResponse(p);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doGet(e) {
  return handleSubmit(e);
}

function doPost(e) {
  return handleSubmit(e);
}

function syncHeaders() {
  var sh = getSheet();
  var headers = getHeaders();
  ensureHeaders(sh);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function testSave() {
  saveResponse({
    s1: '1', s2: '0', s3: '1', s4: '0', s5: '0', s6: '1',
    r1: 'Smart Study Area with AC / Free Wifi',
    r2: 'Transport Bus Service',
    r3: 'Water Park',
    note: 'manual test'
  });
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Survey')
    .addItem('Test save (1 row)', 'testSave')
    .addItem('Update column names', 'syncHeaders')
    .addToUi();
}
