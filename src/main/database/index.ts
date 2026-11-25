import { DatabaseSync } from 'node:sqlite'

export const SCHEMA_VERSION = 6
const migrations: readonly string[] = [
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE stream_sessions (
    id INTEGER PRIMARY KEY,
    channel_id TEXT NOT NULL,
    external_id TEXT,
    source TEXT NOT NULL CHECK(source IN ('twitch','import_csv','import_json','sullygnome')),
    started_at INTEGER NOT NULL,
    ended_at INTEGER CHECK(ended_at IS NULL OR ended_at >= started_at),
    UNIQUE(channel_id, source, external_id)
  ) STRICT;
  CREATE INDEX sessions_by_channel_time ON stream_sessions(channel_id, started_at);
  CREATE TABLE viewer_samples (
    session_id INTEGER NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
    sampled_at INTEGER NOT NULL,
    viewers INTEGER NOT NULL CHECK(viewers >= 0),
    PRIMARY KEY(session_id, sampled_at)
  ) STRICT;
  CREATE TABLE stream_events (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES stream_sessions(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    UNIQUE(source, external_id)
  ) STRICT;
  CREATE INDEX events_by_session_time ON stream_events(session_id, occurred_at);`,
  `CREATE TABLE alert_queue (
    id INTEGER PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK(source IN ('twitch','test','replay')),
    rule_key TEXT NOT NULL,
    rule_json TEXT NOT NULL CHECK(json_valid(rule_json)),
    text TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','playing','done','skipped','failed','suppressed')),
    priority INTEGER NOT NULL CHECK(priority BETWEEN 0 AND 10),
    position INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    finished_at INTEGER,
    reason TEXT NOT NULL DEFAULT ''
  ) STRICT;
  CREATE INDEX alert_queue_pending ON alert_queue(status,priority DESC,position,id);
  CREATE INDEX alert_queue_cooldown ON alert_queue(rule_key,source,created_at DESC);
  CREATE UNIQUE INDEX alert_queue_one_playing ON alert_queue(status) WHERE status='playing';`,
  `ALTER TABLE stream_sessions ADD COLUMN title TEXT NOT NULL DEFAULT '';
  ALTER TABLE stream_sessions ADD COLUMN category_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE stream_sessions ADD COLUMN category TEXT NOT NULL DEFAULT '';
  ALTER TABLE stream_sessions ADD COLUMN last_seen_at INTEGER;
  ALTER TABLE stream_sessions ADD COLUMN end_quality TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE viewer_samples ADD COLUMN category_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE viewer_samples ADD COLUMN category TEXT NOT NULL DEFAULT '';
  ALTER TABLE stream_events ADD COLUMN channel_id TEXT;
  ALTER TABLE stream_events ADD COLUMN chatter_key TEXT;
  CREATE INDEX events_channel_time ON stream_events(channel_id,occurred_at);
  CREATE TABLE obs_samples (
    session_id INTEGER NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
    sampled_at INTEGER NOT NULL,
    metrics_json TEXT NOT NULL CHECK(json_valid(metrics_json)),
    bitrate_kbps REAL CHECK(bitrate_kbps IS NULL OR bitrate_kbps>=0),
    PRIMARY KEY(session_id,sampled_at)
  ) STRICT;`,
  `CREATE TABLE imported_summaries (
    session_id INTEGER PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
    average REAL CHECK(average IS NULL OR average>=0),
    peak INTEGER CHECK(peak IS NULL OR peak>=0),
    provenance TEXT NOT NULL
  ) STRICT;`,
  `CREATE INDEX alert_queue_history ON alert_queue(finished_at DESC,id DESC) WHERE status IN ('done','skipped','failed','suppressed');
  CREATE INDEX events_chat_by_session ON stream_events(session_id,chatter_key) WHERE kind='chat';
  CREATE INDEX events_nonchat_by_session ON stream_events(session_id,kind) WHERE kind<>'chat';`,
  `CREATE TABLE alert_history_hidden(id INTEGER PRIMARY KEY REFERENCES alert_queue(id) ON DELETE CASCADE) STRICT;`
]

export function schemaVersion(db: DatabaseSync): number {
  return Number(db.prepare('PRAGMA user_version').get()?.user_version)
}

export function migrate(db: DatabaseSync, steps: readonly string[] = migrations): void {
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = schemaVersion(db)
    if (!Number.isInteger(current) || current < 0 || current > steps.length) {
      throw new Error('Unsupported database schema')
    }
    for (let i = current; i < steps.length; i++) {
      const step = steps[i]
      if (!step) throw new Error('Missing migration')
      db.exec(step)
      db.exec(`PRAGMA user_version = ${i + 1}`)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function openDatabase(path: string, version=SCHEMA_VERSION): DatabaseSync {
  const db = new DatabaseSync(path)
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
    if(!Number.isInteger(version)||version<1||version>SCHEMA_VERSION)throw Error('Unsupported schema target')
    migrate(db,migrations.slice(0,version))
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function getCompact(db: DatabaseSync): boolean {
  return db.prepare("SELECT value FROM settings WHERE key = 'compact'").get()?.value === 'true'
}

export function setCompact(db: DatabaseSync, value: boolean): boolean {
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('compact', String(value))
  return value
}
