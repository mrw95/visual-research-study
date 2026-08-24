function sheetPhone_(raw) {
  var d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.indexOf('+') === 0) d = d.slice(1);
  if (d.indexOf('0094') === 0) d = d.slice(4);
  else if (d.indexOf('94') === 0 && d.length >= 11) d = d.slice(2);
  if (d && d.charAt(0) !== '0' && d.length === 9) d = '0' + d;
  return d;
}

function doGet(e) {
  return save_(e);
}

function doPost(e) {
  return save_(e);
}

function save_(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    if (e && e.postData && e.postData.contents) {
      try {
        var extra = JSON.parse(e.postData.contents);
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k) && extra[k] != null && extra[k] !== '') {
            p[k] = extra[k];
          }
        }
      } catch (ignore) {}
    }

    var name = String(p.name || p.customer || '').trim();
    var phone = sheetPhone_(p.phone);
    var model = String(p.model || '').trim();

    if (!model && !name && !phone) {
      return ContentService.createTextOutput('skip');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Vehicle');
    if (!sh) sh = ss.insertSheet('Vehicle');

    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue()) !== 'Time') {
      sh.clear();
      sh.appendRow(['Time', 'Model', 'Year', 'Color', 'Budget', 'Intent', 'City', 'Name', 'Phone', 'Note']);
      sh.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    if (String(sh.getRange(1, 5).getValue()) === 'Grade') {
      sh.deleteColumn(5);
      sh.getRange(1, 1, 1, 10).setValues([['Time', 'Model', 'Year', 'Color', 'Budget', 'Intent', 'City', 'Name', 'Phone', 'Note']]);
      sh.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    sh.getRange('H:I').setNumberFormat('@');

    var intent = String(p.intent || p.intentLabel || '');
    if (intent === 'yes') intent = 'Leasing ඔව්';
    if (intent === 'no') intent = 'Leasing නැහැ';
    if (intent === 'buy_now') intent = 'අද / හෙට ගන්නවා';
    if (intent === 'asking') intent = 'Just asking';

    sh.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Colombo', 'dd/MM/yyyy HH:mm:ss'),
      model,
      p.year || '',
      p.color || '',
      p.budgetLabel || p.budget || '',
      intent,
      p.city || '',
      "'" + name,
      "'" + phone,
      p.extranote || p.note || ''
    ]);

    var row = sh.getLastRow();
    sh.getRange(row, 8, 1, 2).setNumberFormat('@');
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}
