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
  if (v === '1' || v === 1 || v === true || v === 'true') return '✓';
  return '';
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

function getVehicleHeaders() {
  return [
    'Time',
    'Model',
    'Year',
    'Color',
    'Grade',
    'Budget',
    'Intent',
    'City',
    'Name',
    'Phone',
    'Note'
  ];
}

function getVehicleSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Vehicle');
  if (!sh) sh = ss.insertSheet('Vehicle');
  return sh;
}

function ensureVehicleHeaders(sh) {
  var headers = getVehicleHeaders();
  if (sh.getLastRow() > 0 && String(sh.getRange(1, 1).getValue()) === 'Time') {
    sh.getRange('I:J').setNumberFormat('@');
    return;
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.getRange('I:J').setNumberFormat('@');
}

function asText(v) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  return "'" + v;
}

function saveVehicle(p) {
  var sh = getVehicleSheet();
  ensureVehicleHeaders(sh);
  sh.appendRow([
    formatTime(new Date()),
    p.model || '',
    p.year || '',
    p.color || '',
    p.grade || '',
    p.budgetLabel || p.budget || '',
    p.intentLabel || p.intent || '',
    p.city || '',
    asText(p.name),
    asText(p.phone),
    p.note || ''
  ]);
  var row = sh.getLastRow();
  sh.getRange(row, 9, 1, 2).setNumberFormat('@');
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
      for (var i = 1; i <= 6; i++) {
        p['s' + i] = String(d['s' + i] != null ? d['s' + i] : p['s' + i] || '');
      }
    } catch (err) {}
  }

  return p;
}

function hasSelection(p) {
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
    tick(p.s1), tick(p.s2), tick(p.s3),
    tick(p.s4), tick(p.s5), tick(p.s6),
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

    if (p.type === 'vehicle' || p.model) {
      if (p.intent === 'buy_now' && !p.intentLabel) p.intentLabel = 'අද / හෙට ගන්නවා';
      if (p.intent === 'asking' && !p.intentLabel) p.intentLabel = 'Just asking';
      saveVehicle(p);
      return ContentService.createTextOutput('ok');
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
  saveResponse({ s1: '1', s2: '1', s3: '1', s4: '0', s5: '0', s6: '0', note: 'manual test' });
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

function testVehicleSave() {
  saveVehicle({
    type: 'vehicle',
    model: 'Toyota Aqua',
    year: '2018',
    color: 'White',
    grade: '4.5',
    budgetLabel: 'Rs. 8,000,000',
    intentLabel: 'අද / හෙට ගන්නවා',
    city: 'Colombo',
    name: 'Customer Name',
    phone: '0771234567',
    note: 'TEST ROW — delete this'
  });
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Survey')
    .addItem('Test save (1 row)', 'testSave')
    .addItem('Test vehicle save', 'testVehicleSave')
    .addItem('Update column names', 'syncHeaders')
    .addItem('Fix time format', 'fixTimeFormat')
    .addItem('Remove duplicate rows', 'removeDuplicates')
    .addToUi();
}
