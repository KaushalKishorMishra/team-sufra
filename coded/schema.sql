-- Team Sufra's quote agent. One database per stage, all with this schema.
-- Every row belongs to one caterer. Until stage 4 there is only Huda.
-- From stage 3, each enquiry is deleted 30 days after its last message (see cleanUp() in src/worker.js).

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  caterer TEXT NOT NULL DEFAULT 'huda',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL,          -- reading | open | asked | awaiting_approval | handed_over | failed | sent | rejected
  asked INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  flags TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  reading TEXT,                  -- JSON: what the model read, kept so a waiting quote can be re-priced
  quote TEXT,                    -- JSON from priceQuote(), with the prices it was drafted at
  drafted_at TEXT,
  draft TEXT,                    -- the message awaiting approval
  reason TEXT,                   -- why it was handed over or failed
  cost_usd REAL NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id TEXT NOT NULL,
  at TEXT NOT NULL,
  sender TEXT NOT NULL,          -- client | agent | caterer
  text TEXT NOT NULL
);
-- The log: one line per step
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id TEXT NOT NULL,
  caterer TEXT NOT NULL DEFAULT 'huda',
  at TEXT NOT NULL,
  step TEXT NOT NULL,            -- receive | read | ask | handover | draft | approve | edit | reject | reply | fail
  detail TEXT NOT NULL           -- JSON
);
-- The price list, from stage 2. Before that, prices come from data/business.json, built into the program.
CREATE TABLE IF NOT EXISTS price_list (
  caterer TEXT NOT NULL,
  service_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  price INTEGER NOT NULL,
  unit TEXT NOT NULL,
  includes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (caterer, service_id)
);
-- Settings the caterer changes from stage 3: the model switch and the daily limit
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,
  caterer TEXT NOT NULL DEFAULT 'huda',
  enquiries INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, caterer)
);
CREATE INDEX IF NOT EXISTS messages_enquiry ON messages (enquiry_id);
CREATE INDEX IF NOT EXISTS events_enquiry ON events (enquiry_id);
CREATE INDEX IF NOT EXISTS enquiries_caterer ON enquiries (caterer, updated_at);
