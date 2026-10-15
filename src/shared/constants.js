// Tournament lifecycle states
const TOURNAMENT_STATES = {
  REGISTRATION_OPEN:   'RegistrationOpen',
  BRACKET_GENERATED:   'BracketGenerated',
  COMPLETED:           'Completed',
  CANCELLED:           'Cancelled'
};

// Roles (resolved per request, never stored globally)
const ROLES = {
  OWNER:   'owner',
  MANAGER: 'manager',
  PLAYER:  'player',
  GUEST:   'guest'
};

// Roles stored on a participant row
const PARTICIPANT_ROLES = {
  PLAYER:  'player',
  MANAGER: 'manager'
};

// Business rules
const MIN_PLAYERS = 3;

// Sheet names
const SHEETS = {
  MASTER:             '_Tournaments',
  TOURNAMENT_PREFIX:  'T_',
  ARCHIVE_PREFIX:     'ARCHIVED_'
};

// Master tab headers (order matters — index +1 = column number)
const MASTER_HEADERS = [
  'ID', 'Tournament Name', 'Game', 'Date', 'State', 'Tab Name',
  'Invite Token', 'Owner Email', 'Created', 'Closed', 'Generated', 'Completed'
];

// Tournament tab headers
const PARTICIPANT_HEADERS = ['Email', 'Google Name', 'Display Name', 'Role', 'Joined At'];
const MATCH_HEADERS = [
  'Match Index', 'Player A', 'Player A Score', 'Player B',
  'Player B Score', 'Winner', 'Updated At', 'Updated By'
];

// Fixed-row layout inside each tournament tab
const LAYOUT = {
  META_VALUES_ROW_1:     2,   // Name | Game | State | Invite Token
  META_VALUES_ROW_2:     4,   // Created | Closed | Generated | Completed
  PARTICIPANTS_HEADER:   6,
  PARTICIPANTS_START:    7,
  PARTICIPANTS_MAX:      32,
  MATCHES_HEADER:        40,
  MATCHES_START:         41,
  MATCHES_MAX:           63  // 32-player single elim = 31 matches; rounded up
};

// Cache
const CACHE_TTL_SECONDS = 15;
const CACHE_KEYS = {
  SNAPSHOT:    (id) => 'snap_' + id,
  MASTER_LIST: 'master_list'
};

// Script Properties keys
const PROP_KEYS = {
  SPREADSHEET_ID: 'URCBM_SPREADSHEET_ID'
};

// Invite decisions statuses
const INVITE_DECISIONS = {
  REGISTER:            'register',
  ALREADY_REGISTERED:  'already-registered',
  WATCH:               'watch',
  CANCELLED:           'cancelled',
  INVALID:             'invalid'
};