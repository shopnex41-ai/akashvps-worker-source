-- AkashVPS self-service foundation migration
-- Apply once to the existing akashvps-control-db D1 database.

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE sandboxes ADD COLUMN auth_token_ciphertext TEXT;

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_active_sandboxes INTEGER NOT NULL DEFAULT 1,
  max_runtime_minutes INTEGER NOT NULL DEFAULT 120,
  max_daily_runtime_minutes INTEGER NOT NULL DEFAULT 120,
  max_commands_per_day INTEGER NOT NULL DEFAULT 100,
  max_upload_bytes INTEGER NOT NULL DEFAULT 26214400,
  max_deployments_per_day INTEGER NOT NULL DEFAULT 1,
  max_terminal_minutes_per_session INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_packages (
  user_id TEXT PRIMARY KEY,
  package_id INTEGER NOT NULL,
  assigned_by TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY(package_id) REFERENCES packages(id)
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'hopx',
  key_version INTEGER NOT NULL DEFAULT 1,
  key_ciphertext TEXT NOT NULL,
  key_fingerprint TEXT NOT NULL,
  organization_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_validated_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_credentials_user ON provider_credentials(user_id, status);

CREATE TABLE IF NOT EXISTS package_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  package_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_activation',
  payment_reference TEXT,
  amount TEXT,
  currency TEXT,
  requested_at TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  credential_id INTEGER,
  sandbox_id TEXT,
  action TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT
);

INSERT OR IGNORE INTO packages(name, description, max_active_sandboxes, max_runtime_minutes, max_daily_runtime_minutes, max_commands_per_day, max_upload_bytes, max_deployments_per_day, max_terminal_minutes_per_session, created_at, updated_at)
VALUES
('Basic', 'Starter self-service workspace', 1, 120, 120, 100, 26214400, 1, 30, datetime('now'), datetime('now')),
('Developer', 'Developer deployment workspace', 2, 360, 360, 500, 104857600, 5, 60, datetime('now'), datetime('now')),
('Premium', 'Expanded self-service workspace', 3, 720, 720, 1000, 262144000, 10, 120, datetime('now'), datetime('now'));

UPDATE users SET status='active' WHERE role='owner';
