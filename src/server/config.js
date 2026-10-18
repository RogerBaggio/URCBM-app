function getSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SPREADSHEET_ID);
}

function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.SPREADSHEET_ID, id);
}

function getSpreadsheet() {
  const id = getSpreadsheetId();
  if (!id) throw new Error('Spreadsheet not configured. Run setup() once from the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}

/* =========================================================
 * Run this ONCE from the Apps Script editor.
 * Creates the spreadsheet, creates the master tab, and stores its ID.
 * =======================================================*/
function setup() {
  const existing = getSpreadsheetId();
  if (existing) {
    Logger.log('Already configured. Spreadsheet ID: ' + existing);
    return existing;
  }

  const ss = SpreadsheetApp.create('URCBM-app Data');
  const id = ss.getId();
  setSpreadsheetId(id);

  const master = ss.getSheets()[0];
  master.setName(SHEETS.MASTER);
  master.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  master.setFrozenRows(1);

  Logger.log('Spreadsheet created: ' + id);
  Logger.log('URL: ' + ss.getUrl());
  return id;
}

/* =========================================================
 * Web app URL registration
 * Captures the real /exec URL during the first live doGet
 * and persists it. Subsequent reads are instant.
 * =======================================================*/

function registerAndGetAppUrl() {
  const props = PropertiesService.getScriptProperties();
  let registered = props.getProperty('WEBAPP_URL');

  let current = '';
  try {
    current = ScriptApp.getService().getUrl() || '';
  } catch (e) {
    current = '';
  }

  const isProd = current.indexOf('/exec') !== -1;
  if (isProd && current !== registered) {
    props.setProperty('WEBAPP_URL', current);
    registered = current;
  }

  return registered || current;
}

function getAppUrl() {
  return PropertiesService.getScriptProperties().getProperty('WEBAPP_URL') || '';
}