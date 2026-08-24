function doGet(e) {
  return save_(e);
}

function doPost(e) {
  return save_(e);
}

function save_(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var name = String(p.name || '').trim();
    var phone = String(p.phone || '').trim();
    var model = String(p.model || '').trim();

    if (!model && !name && !phone) {
      return ContentService.createTextOutput('skip');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Vehicle');
    if (!sh) sh = ss.insertSheet('Vehicle');

    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue()) !== 'Time') {
      sh.clear();
      sh.appendRow(['Time', 'Model', 'Year', 'Color', 'Grade', 'Budget', 'Intent', 'City', 'Name', 'Phone', 'Note']);
      sh.getRange(1, 1, 1, 11).setFontWeight('bold');
    }

    sh.getRange('I:J').setNumberFormat('@');

    var intent = String(p.intent || '');
    var intentLabel = String(p.intentLabel || '');
    if (!intentLabel && intent === 'buy_now') intentLabel = 'අද / හෙට ගන්නවා';
    if (!intentLabel && intent === 'asking') intentLabel = 'Just asking';

    sh.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Colombo', 'dd/MM/yyyy HH:mm:ss'),
      model,
      p.year || '',
      p.color || '',
      p.grade || '',
      p.budgetLabel || p.budget || '',
      intentLabel || intent,
      p.city || '',
      "'" + name,
      "'" + phone,
      p.extranote || ''
    ]);

    var row = sh.getLastRow();
    sh.getRange(row, 9, 1, 2).setNumberFormat('@');
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}
