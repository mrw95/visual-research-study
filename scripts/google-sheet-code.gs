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

function syncHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers = getHeaders();
  var sheets = ss.getSheets();
  var updated = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (sh.getLastRow() === 0 && sh.getName() !== 'Responses') continue;
    var a1 = String(sh.getRange(1, 1).getValue() || '');
    if (a1 === 'Time' || sh.getName() === 'Responses' || sh.getLastRow() <= 1) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      updated++;
    }
  }

  if (updated === 0) {
    var sh = ss.getSheets()[0];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

// Easy one-click fix — only changes "Budget Pice Cafe" -> "Budget Price Cafe"
function fixBudgetColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var fixed = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var lastCol = Math.max(sh.getLastColumn(), 6);
    var row = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < row.length; c++) {
      if (String(row[c]).trim() === 'Budget Pice Cafe') {
        sh.getRange(1, c + 1).setValue('Budget Price Cafe');
        fixed++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(
    fixed > 0
      ? 'Done! ' + fixed + ' column(s) updated to Budget Price Cafe.'
      : 'No "Budget Pice Cafe" found. Check row 1 on your data tab, or run syncHeaders.'
  );
}

function onOpen() {
  syncHeaders();
  SpreadsheetApp.getUi()
    .createMenu('Survey')
    .addItem('Fix Budget Price Cafe column', 'fixBudgetColumn')
    .addItem('Update all column names', 'syncHeaders')
    .addToUi();
}

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

  if (sid) {
    var cache = CacheService.getScriptCache();
    if (cache.get(sid)) {
      return ContentService.createTextOutput('ok');
    }
    cache.put(sid, '1', 60);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses') || ss.getSheets()[0];
  var headers = getHeaders();

  var newRow = [
    p.t || new Date(),
    tick(p.s1), tick(p.s2), tick(p.s3),
    tick(p.s4), tick(p.s5), tick(p.s6),
    p.note || ''
  ];

  syncHeaders();

  if (sh.getLastRow() > 1) {
    var last = sh.getRange(sh.getLastRow(), 1, 1, newRow.length).getValues()[0];
    if (rowMatches(last, newRow)) {
      return ContentService.createTextOutput('ok');
    }
  }

  sh.appendRow(newRow);
  return ContentService.createTextOutput('ok');
}
