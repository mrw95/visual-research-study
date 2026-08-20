function tick(v) {
  if (!v || v === '') return '';
  return '✓';
}

function doGet(e) {
  var p = e.parameter;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  var headers = [
    'Time',
    'Smart Study Area with AC / Free Wifi',
    'Mobile Accessories',
    'Branded Decants Perfumes',
    'Bookshop and Stationery',
    'Budget Pice Cafe',
    'Smart Cafe',
    'Extra note'
  ];
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.appendRow([
    p.t || new Date(),
    tick(p.s1),
    tick(p.s2),
    tick(p.s3),
    tick(p.s4),
    tick(p.s5),
    tick(p.s6),
    p.note || ''
  ]);
  return ContentService.createTextOutput('ok');
}
