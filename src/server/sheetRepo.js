/* =========================================================
 * MASTER TAB — read / write
 * =======================================================*/

function readMasterRows() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.MASTER);
  if (!sheet) throw new Error('Master tab not found. Run setup().');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, MASTER_HEADERS.length).getValues();
  return values.map(rowToMaster).filter(t => t.id);
}

function rowToMaster(row) {
  return {
    id:          row[0],
    name:        row[1],
    game:        row[2],
    state:       row[3],
    tabName:     row[4],
    inviteToken: row[5],
    ownerEmail:  row[6],
    created:     toIsoString(row[7]),
    closed:      toIsoString(row[8]),
    generated:   toIsoString(row[9]),
    completed:   toIsoString(row[10])
  };
}

function masterToRow(t) {
  return [
    t.id, t.name, t.game, t.state, t.tabName, t.inviteToken,
    t.ownerEmail, t.created, t.closed, t.generated, t.completed
  ];
}

function findMasterRowIndexById(id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.MASTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // +2 = skip header row
  }
  return -1;
}

function appendMasterRow(t) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.MASTER);
  sheet.appendRow(masterToRow(t));
  cacheRemoveMaster();
}

function updateMasterRow(id, updates) {
  const idx = findMasterRowIndexById(id);
  if (idx < 0) throw new Error('Tournament not found: ' + id);
  const sheet = getSpreadsheet().getSheetByName(SHEETS.MASTER);
  const current = rowToMaster(
    sheet.getRange(idx, 1, 1, MASTER_HEADERS.length).getValues()[0]
  );
  const merged = Object.assign({}, current, updates);
  sheet.getRange(idx, 1, 1, MASTER_HEADERS.length).setValues([masterToRow(merged)]);
  cacheRemoveMaster();
  cacheRemoveSnapshot(id);
}

function findTournamentById(id) {
  if (!id) return null;
  const rows = readMasterRows();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return rows[i];
  }
  return null;
}

function findTournamentByInviteToken(token) {
  if (!token) return null;
  const rows = readMasterRows();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].inviteToken === token) return rows[i];
  }
  return null;
}

/* =========================================================
 * TOURNAMENT TAB — create + read meta
 * =======================================================*/

function createTournamentTab(tabName) {
  const ss = getSpreadsheet();
  if (ss.getSheetByName(tabName)) {
    throw new Error('Tab already exists: ' + tabName);
  }
  const sheet = ss.insertSheet(tabName);

  // Metadata block
  sheet.getRange(LAYOUT.META_VALUES_ROW_1, 1, 1, 4)
       .setValues([['Name', 'Game', 'State', 'Invite Token']]);
  sheet.getRange(LAYOUT.META_VALUES_ROW_2, 1, 1, 4)
       .setValues([['Created', 'Closed', 'Generated', 'Completed']]);

  // Participant headers
  sheet.getRange(LAYOUT.PARTICIPANTS_HEADER, 1, 1, PARTICIPANT_HEADERS.length)
       .setValues([PARTICIPANT_HEADERS]);

  // Match headers
  sheet.getRange(LAYOUT.MATCHES_HEADER, 1, 1, MATCH_HEADERS.length)
       .setValues([MATCH_HEADERS]);

  sheet.setFrozenRows(LAYOUT.PARTICIPANTS_HEADER);
  return sheet;
}

function getTournamentSheet(tabName) {
  const sheet = getSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('Tournament tab not found: ' + tabName);
  return sheet;
}

function writeTournamentMeta(t) {
  const sheet = getTournamentSheet(t.tabName);
  sheet.getRange(LAYOUT.META_VALUES_ROW_1, 1, 1, 4)
       .setValues([[t.name, t.game, t.state, t.inviteToken]]);
  sheet.getRange(LAYOUT.META_VALUES_ROW_2, 1, 1, 4)
       .setValues([[t.created, t.closed, t.generated, t.completed]]);
}

/* =========================================================
 * PARTICIPANTS — read
 * =======================================================*/

function readParticipants(tabName) {
  const sheet = getTournamentSheet(tabName);
  const values = sheet
    .getRange(LAYOUT.PARTICIPANTS_START, 1, LAYOUT.PARTICIPANTS_MAX, PARTICIPANT_HEADERS.length)
    .getValues();

  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue; // empty row → skip
    out.push({
      email:       String(row[0]).toLowerCase(),
      googleName:  row[1],
      displayName: row[2],
      role:        row[3],
      joinedAt:    toIsoString(row[4])
    });
  }
  return out;
}

function readParticipantByEmail(tabName, email) {
  const target = String(email || '').toLowerCase();
  if (!target) return null;
  const list = readParticipants(tabName);
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === target) return list[i];
  }
  return null;
}