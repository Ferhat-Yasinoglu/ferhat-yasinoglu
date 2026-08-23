/**
 * The database schema, applied on open.
 *
 * Cascades are load-bearing: `disconnect_bot` is a single DELETE on `bots`, and
 * everything downstream of it has to go with it. Foreign keys are enabled per
 * connection in `db.ts` — SQLite ignores them otherwise.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS bots (
  id          TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  username    TEXT NOT NULL,
  label       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id          TEXT PRIMARY KEY,
  bot_id      TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  chat_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  username    TEXT,
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (bot_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_subscribers_bot ON subscribers(bot_id);

CREATE TABLE IF NOT EXISTS subscriber_tags (
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  PRIMARY KEY (subscriber_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON subscriber_tags(tag);

CREATE TABLE IF NOT EXISTS flows (
  id            TEXT PRIMARY KEY,
  bot_id        TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  steps         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TEXT NOT NULL,
  published_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_flows_bot ON flows(bot_id);

CREATE TABLE IF NOT EXISTS triggers (
  id          TEXT PRIMARY KEY,
  bot_id      TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  flow_id     TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  keywords    TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_triggers_bot ON triggers(bot_id);

-- A run snapshots the flow's steps at start, so editing a flow never corrupts
-- a conversation already in progress.
CREATE TABLE IF NOT EXISTS runs (
  id             TEXT PRIMARY KEY,
  flow_id        TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  subscriber_id  TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  steps          TEXT NOT NULL,
  step_index     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'waiting',
  waiting_for    TEXT,
  save_as        TEXT,
  vars           TEXT NOT NULL DEFAULT '{}',
  resume_at      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_subscriber ON runs(subscriber_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_resume ON runs(status, resume_at);

CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  bot_id         TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  subscriber_id  TEXT REFERENCES subscribers(id) ON DELETE CASCADE,
  direction      TEXT NOT NULL,
  text           TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_bot_time ON messages(bot_id, created_at);

CREATE TABLE IF NOT EXISTS broadcasts (
  id          TEXT PRIMARY KEY,
  bot_id      TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  recipients  INTEGER NOT NULL DEFAULT 0,
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- Telegram's getUpdates cursor, so a restart does not replay old updates.
CREATE TABLE IF NOT EXISTS update_offsets (
  bot_id     TEXT PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  update_id  INTEGER NOT NULL
);
`;
