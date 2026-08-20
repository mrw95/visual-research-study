function doGet(e) {
  var p = e.parameter;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  var headers = [
    'Time',
    'Smart Study Area / Free Wifi',
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
    p.s1 || '',
    p.s2 || '',
    p.s3 || '',
    p.s4 || '',
    p.s5 || '',
    p.s6 || '',
    p.note || ''
  ]);
  return ContentService.createTextOutput('ok');
}
