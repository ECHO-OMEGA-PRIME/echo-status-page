-- echo-status-page schema

CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'core',
  url         TEXT NOT NULL,
  health_path TEXT NOT NULL DEFAULT '/health',
  critical    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'up',
  latency_ms  INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_checks_service ON checks(service_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_checks_time ON checks(checked_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'investigating',
  severity    TEXT NOT NULL DEFAULT 'minor',
  services    TEXT NOT NULL DEFAULT '[]',
  message     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

CREATE TABLE IF NOT EXISTS uptime_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id  TEXT NOT NULL,
  date        TEXT NOT NULL,
  total_checks INTEGER NOT NULL DEFAULT 0,
  up_checks   INTEGER NOT NULL DEFAULT 0,
  avg_latency REAL NOT NULL DEFAULT 0,
  uptime_pct  REAL NOT NULL DEFAULT 100,
  UNIQUE(service_id, date)
);

CREATE INDEX IF NOT EXISTS idx_uptime_service ON uptime_daily(service_id, date DESC);
