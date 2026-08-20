function doGet(e) {
  var p = e.parameter;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Time', 'Number 1', 'Number 2', 'Number 3', 'Extra note']);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  sh.appendRow([
    p.t || new Date(),
    p.c1 || '',
    p.c2 || '',
    p.c3 || '',
    p.note || ''
  ]);
  return ContentService.createTextOutput('ok');
}
