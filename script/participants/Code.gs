/** @OnlyCurrentDoc */
const HEADER = ["address", "name", "joined_at"];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const sheet = () => SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
const json = (data) => ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
const nameOf = (value) => String(value || "").trim().slice(0, 20).replace(/^[=+\-@]/, "'$&");
const participants = () => sheet().getDataRange().getValues().filter((row) => ADDRESS.test(String(row[0]))).map((row) => ({ address: String(row[0]), name: String(row[1]) }));

function doGet() {
  return json(participants());
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const address = String(body.address || "");
  const name = nameOf(body.name);
  if (!ADDRESS.test(address) || !name) return json({ ok: false });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const joined = participants();
    if (joined.some((p) => p.address.toLowerCase() === address.toLowerCase())) return json({ ok: true });
    if (joined.length >= 100) return json({ ok: false, full: true });
    if (sheet().getLastRow() === 0) sheet().appendRow(HEADER);
    sheet().appendRow([address, name, new Date()]);
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
