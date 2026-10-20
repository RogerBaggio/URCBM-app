/* =========================================================
 * MASTER TAB — read / write
 * =======================================================*/

function readMasterRows_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.MASTER);
  if (!sheet) throw new Error('Master tab not found. Run setup().');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, MASTER_HEADERS.length).getValues();
  return values.map(rowToMaster_).filter(t => t.id);
}

function rowToMaster_(row) {
  return {
    id:          row[0],
    name:        row[1],
    game:        row[2],
    date:        toIsoString_(row[3]),
    state:       row[4],
    tabName:     row[5],
    inviteToken: row[6],
    ownerEmail:  row[7],
    created:     toIsoString_(row[8]),
    generated:   toIsoString_(row[9]),
    completed:   toIsoString_(row[10])
  };
}

function masterToRow_(t) {
  return [
    t.id, t.name, t.game, t.date, t.state, t.tabName, t.inviteToken,
    t.ownerEmail, t.created, t.generated, t.completed
  ];
}

function findMasterRowIndexById_(id) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.MASTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // +2 = skip header row
  }
  return -1;
}

function appendMasterRow_(t) {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.MASTER);
  sheet.appendRow(masterToRow_(t));
  cacheRemoveMaster_();
}

function updateMasterRow_(id, updates) {
  const idx = findMasterRowIndexById_(id);
  if (idx < 0) throw new Error('Tournament not found: ' + id);
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.MASTER);
  const current = rowToMaster_(
    sheet.getRange(idx, 1, 1, MASTER_HEADERS.length).getValues()[0]
  );
  const merged = Object.assign({}, current, updates);
  sheet.getRange(idx, 1, 1, MASTER_HEADERS.length).setValues([masterToRow_(merged)]);
  cacheRemoveMaster_();
  cacheRemoveSnapshot_(id);
}

function findTournamentById_(id) {
  if (!id) return null;
  const rows = readMasterRows_();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return rows[i];
  }
  return null;
}

function findTournamentByInviteToken_(token) {
  if (!token) return null;
  const rows = readMasterRows_();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].inviteToken === token) return rows[i];
  }
  return null;
}

/* =========================================================
 * TOURNAMENT TAB — create + read meta
 * =======================================================*/

function createTournamentTab_(tabName) {
  const ss = getSpreadsheet_();
  if (ss.getSheetByName(tabName)) {
    throw new Error('Tab already exists: ' + tabName);
  }
  const sheet = ss.insertSheet(tabName);

  // Metadata block
  sheet.getRange(LAYOUT.META_VALUES_ROW_1, 1, 1, 5)
       .setValues([['Name', 'Game', 'Date', 'State', 'Invite Token']]);
  sheet.getRange(LAYOUT.META_VALUES_ROW_2, 1, 1, 3)
       .setValues([['Created', 'Generated', 'Completed']]);

  // Participant headers
  sheet.getRange(LAYOUT.PARTICIPANTS_HEADER, 1, 1, PARTICIPANT_HEADERS.length)
       .setValues([PARTICIPANT_HEADERS]);

  // Match headers
  sheet.getRange(LAYOUT.MATCHES_HEADER, 1, 1, MATCH_HEADERS.length)
       .setValues([MATCH_HEADERS]);

  sheet.setFrozenRows(LAYOUT.PARTICIPANTS_HEADER);
  return sheet;
}

function getTournamentSheet_(tabName) {
  const sheet = getSpreadsheet_().getSheetByName(tabName);
  if (!sheet) throw new Error('Tournament tab not found: ' + tabName);
  return sheet;
}

function writeTournamentMeta_(t) {
  const sheet = getTournamentSheet_(t.tabName);
  sheet.getRange(LAYOUT.META_VALUES_ROW_1, 1, 1, 5)
       .setValues([[t.name, t.game, t.date, t.state, t.inviteToken]]);
  sheet.getRange(LAYOUT.META_VALUES_ROW_2, 1, 1, 3)
       .setValues([[t.created, t.generated, t.completed]]);
}

/* =========================================================
 * PARTICIPANTS — read
 * =======================================================*/

function readParticipants_(tabName) {
  const sheet = getTournamentSheet_(tabName);

  // Detect pre-V1 schema and fail loudly rather than silently misread.
  const firstHeader = sheet.getRange(LAYOUT.PARTICIPANTS_HEADER, 1).getValue();
  if (firstHeader !== 'User ID') {
    throw new Error(
      'PARTICIPANT_SCHEMA_OUTDATED: tab "' + tabName +
      '" uses the pre-V1 participant schema and must be recreated.'
    );
  }

  const values = sheet
    .getRange(LAYOUT.PARTICIPANTS_START, 1, LAYOUT.PARTICIPANTS_MAX, PARTICIPANT_HEADERS.length)
    .getValues();

  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue; // empty row → skip
    out.push({
      userId:      String(row[0]).trim(),
      email:       String(row[1]).toLowerCase(),
      googleName:  row[2] || '',
      displayName: row[3] || '',
      role:        row[4] || '',
      joinedAt:    toIsoString_(row[5])
    });
  }
  return out;
}

function readParticipantByUserId_(tabName, userId) {
  const target = String(userId || '').trim();
  if (!target) return null;
  const list = readParticipants_(tabName);
  for (let i = 0; i < list.length; i++) {
    if (list[i].userId === target) return list[i];
  }
  return null;
}

function readParticipantByEmail_(tabName, email) {
  const target = String(email || '').toLowerCase();
  if (!target) return null;
  const list = readParticipants_(tabName);
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === target) return list[i];
  }
  return null;
}

/* =========================================================
 * PARTICIPANTS — write
 * =======================================================*/

function writeParticipants_(tournament, list) {
  const sheet = getTournamentSheet_(tournament.tabName);

  // Wipe the block first
  const blank = [];
  for (let i = 0; i < LAYOUT.PARTICIPANTS_MAX; i++) {
    blank.push(['', '', '', '', '', '']);
  }
  sheet.getRange(
    LAYOUT.PARTICIPANTS_START, 1,
    LAYOUT.PARTICIPANTS_MAX, PARTICIPANT_HEADERS.length
  ).setValues(blank);

  if (list.length) {
    const rows = list.map(p => [
      p.userId,
      p.email,
      p.googleName || '',
      p.displayName,
      p.role,
      p.joinedAt
    ]);
    sheet.getRange(
      LAYOUT.PARTICIPANTS_START, 1,
      rows.length, PARTICIPANT_HEADERS.length
    ).setValues(rows);
  }

  cacheRemoveSnapshot_(tournament.id);
}