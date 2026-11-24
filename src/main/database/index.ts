import { DatabaseSync } from 'node:sqlite'

export const SCHEMA_VERSION = 1
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
  CREATE INDEX events_by_session_time ON stream_events(session_id, occurred_at);`
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

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
    migrate(db)
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
