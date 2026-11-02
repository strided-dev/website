/**
 * @OnlyCurrentDoc  Limits the script's Google permission to this one spreadsheet.
 */

/* vivace beta list → Google Sheet. /api/beta posts each signup here.

   Setup (once):
   1. Create a Google Sheet with the account that should own the list.
   2. Extensions → Apps Script. Replace the editor's contents with this file and save.
   3. Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone.
      Authorize when asked.
   4. Copy the web app URL (ends in /exec) into the BETA_SHEET_URL environment
      variable on Vercel, then redeploy. Treat the URL as a secret.

   Signups land in the first tab. The header row is added on the first signup.
   After editing this script, use Deploy → Manage deployments → Edit → New version
   so the same URL keeps working.

   "Anyone" lets the website's server call the script without signing in. It does
   not let anyone open the sheet: keep the sheet itself shared only with the team.
   The script can only add rows and never sends sheet data back. */

var HEADERS = ['Signed up', 'Email', 'Name', 'GPU', 'OS', 'What they would run'];
// The same limits /api/beta applies, enforced again because the URL accepts any request.
var LIMITS = { email: 320, name: 200, gpu: 100, os: 100, use: 2000 };

function doPost(e) {
  var signup = JSON.parse(e.postData.contents);
  var values = Object.keys(LIMITS).map(function (key) {
    return asText(signup[key], LIMITS[key]);
  });
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date()].concat(values));
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Keep submitted values as short plain text, so an entry like "=IMPORTXML(...)" never runs as a formula.
function asText(value, limit) {
  var text = typeof value === 'string' ? value.slice(0, limit) : '';
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
