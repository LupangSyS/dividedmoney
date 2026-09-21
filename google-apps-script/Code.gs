/**
 * AURA SPLIT ledger backend.
 * Deploy this as a Web App (Deploy > New deployment > Web app,
 * execute as "Me", access "Anyone"), then put the deployment URL
 * in NEXT_PUBLIC_GAS_URL. See google-apps-script/README.md.
 */

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessions = ss.getSheetByName('Sessions') || createSessionsSheet(ss);
  var ledger = ss.getSheetByName('Ledger') || createLedgerSheet(ss);
  var action = e.parameter.action;

  try {
    if (action === 'save_history') return saveHistory(e, sessions, ledger);
    if (action === 'load_history') return loadHistory(sessions);
    if (action === 'clear_history') return clearHistory(sessions, ledger);
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function createSessionsSheet(ss) {
  var sh = ss.insertSheet('Sessions');
  sh.appendRow(['Timestamp', 'SessionId', 'MembersText', 'ChatText', 'ItemsJson', 'BreakdownJson']);
  return sh;
}

function createLedgerSheet(ss) {
  var sh = ss.insertSheet('Ledger');
  sh.appendRow(['Timestamp', 'SessionId', 'Person', 'Items', 'Price']);
  return sh;
}

// One row per import in Sessions (full state, for reloading into the app),
// plus one row per person in Ledger: Name, items, summed price.
function saveHistory(e, sessions, ledger) {
  var now = new Date();
  var sessionId = Utilities.getUuid();
  var membersText = e.parameter.members || '';
  var chatText = e.parameter.chatText || '';
  var itemsJson = e.parameter.itemsJson || '[]';
  var breakdownJson = e.parameter.breakdownJson || '[]';

  sessions.appendRow([now, sessionId, membersText, chatText, itemsJson, breakdownJson]);

  var breakdown = safeParse(breakdownJson, []);
  breakdown.forEach(function (person) {
    ledger.appendRow([now, sessionId, person.name, (person.items || []).join(', '), person.total]);
  });

  return jsonResponse({ success: true });
}

function loadHistory(sessions) {
  var data = sessions.getDataRange().getValues();
  var rows = data.slice(1);
  var recent = rows.slice(-20).reverse();

  var history = recent.map(function (row) {
    return {
      id: row[1],
      date: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      membersText: row[2],
      chatText: row[3],
      items: safeParse(row[4], []),
      breakdown: safeParse(row[5], []),
    };
  });

  return jsonResponse({ success: true, history: history });
}

function clearHistory(sessions, ledger) {
  clearSheetKeepHeader(sessions);
  clearSheetKeepHeader(ledger);
  return jsonResponse({ success: true });
}

function clearSheetKeepHeader(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (err) {
    return fallback;
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
