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

function parseToDate(value) {
  if (value instanceof Date) return value;
  var s = String(value || '').trim();
  if (!s) return new Date();

  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
  }

  var d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function rowFingerprint(row) {
  var out = [];
  for (var i = 1; i < row.length; i++) {
    out.push(String(row[i] || '').trim());
  }
  return out.join('|');
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

function fixTimeFormat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixed = 0;

  ss.getSheets().forEach(function(sh) {
    if (String(sh.getRange(1, 1).getValue()) !== 'Time') return;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    var values = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var formatted = formatTime(parseToDate(values[i][0]));
      if (String(values[i][0]) !== formatted) {
        sh.getRange(i + 2, 1).setValue(formatted);
        fixed++;
      }
    }
  });

  SpreadsheetApp.getUi().alert('Done! ' + fixed + ' time cell(s) updated.');
}

function removeDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var removed = 0;

  ss.getSheets().forEach(function(sh) {
    if (String(sh.getRange(1, 1).getValue()) !== 'Time') return;
    var lastRow = sh.getLastRow();
    if (lastRow < 3) return;

    var width = getHeaders().length;
    var data = sh.getRange(2, 1, lastRow - 1, width).getValues();
    var seen = {};
    var rowsToDelete = [];

    for (var i = 0; i < data.length; i++) {
      var fp = rowFingerprint(data[i]);
      if (seen[fp]) {
        rowsToDelete.push(i + 2);
      } else {
        seen[fp] = true;
      }
    }

    rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNum) {
      sh.deleteRow(rowNum);
      removed++;
    });
  });

  SpreadsheetApp.getUi().alert('Done! ' + removed + ' duplicate row(s) removed.');
}

function onOpen() {
  syncHeaders();
  SpreadsheetApp.getUi()
    .createMenu('Survey')
    .addItem('Fix time format (20/08/2026 16:52:32)', 'fixTimeFormat')
    .addItem('Remove duplicate rows', 'removeDuplicates')
    .addItem('Fix Budget Price Cafe column', 'fixBudgetColumn')
    .addItem('Update all column names', 'syncHeaders')
    .addToUi();
}

function tick(v) {
  if (!v || v === '') return '';
  return '✓';
}

function isDuplicateRow(sh, newRow) {
  var fp = rowFingerprint(newRow);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  var width = newRow.length;
  var start = Math.max(2, lastRow - 49);
  var data = sh.getRange(start, 1, lastRow - 1, width).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    if (rowFingerprint(data[i]) === fp) return true;
  }
  return false;
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var p = e.parameter;
    var sid = p.sid || '';

    if (sid) {
      var cache = CacheService.getScriptCache();
      if (cache.get(sid)) {
        return ContentService.createTextOutput('ok');
      }
      cache.put(sid, '1', 120);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Responses') || ss.getSheets()[0];

    var newRow = [
      formatTime(new Date()),
      tick(p.s1), tick(p.s2), tick(p.s3),
      tick(p.s4), tick(p.s5), tick(p.s6),
      p.note || ''
    ];

    syncHeaders();

    if (isDuplicateRow(sh, newRow)) {
      return ContentService.createTextOutput('ok');
    }

    sh.appendRow(newRow);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}
