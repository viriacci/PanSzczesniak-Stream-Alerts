import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, migrate, schemaVersion, getCompact, setCompact, SCHEMA_VERSION } from '../src/main/database/index.ts'

test('schema and settings persist across restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pssa-db-'))
  try {
    const path = join(directory, 'data.sqlite')
    let db = openDatabase(path)
    try {
      assert.equal(schemaVersion(db), SCHEMA_VERSION)
      assert.equal(getCompact(db), false)
      assert.equal(setCompact(db, true), true)
    } finally { db.close() }
    db = openDatabase(path)
    try { assert.equal(getCompact(db), true); migrate(db); assert.equal(schemaVersion(db), SCHEMA_VERSION) }
    finally { db.close() }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('foreign keys, sample validation and event deduplication', () => {
  const db = openDatabase(':memory:')
  try {
    assert.throws(() => db.exec('INSERT INTO viewer_samples(session_id,sampled_at,viewers) VALUES (999,1000,5)'))
    db.exec("INSERT INTO stream_sessions(channel_id,source,started_at) VALUES ('123','twitch',1000)")
    assert.throws(() => db.exec('INSERT INTO viewer_samples(session_id,sampled_at,viewers) VALUES (1,1000,-1)'))
    db.exec('INSERT INTO viewer_samples(session_id,sampled_at,viewers) VALUES (1,1000,0)')
    assert.throws(() => db.exec('INSERT INTO viewer_samples(session_id,sampled_at,viewers) VALUES (1,1000,5)'))
    const insert = db.prepare('INSERT INTO stream_events(source,external_id,kind,occurred_at,payload_json) VALUES (?,?,?,?,?)')
    insert.run('twitch','event1','follow',1000,'{}')
    assert.throws(() => insert.run('twitch','event1','follow',1000,'{}'))
    assert.throws(() => insert.run('twitch','event2','follow',1000,'invalid'))
    db.exec('DELETE FROM stream_sessions WHERE id=1')
    assert.equal(db.prepare('SELECT count(*) AS n FROM viewer_samples').get()?.n, 0)
  } finally { db.close() }
})

test('failed migration rolls back schema and version', () => {
  const db = openDatabase(':memory:')
  try {
    assert.throws(() => migrate(db, ['unused', 'unused', 'unused', 'CREATE TABLE temporary_test(x); INVALID SQL;']))
    assert.equal(schemaVersion(db), SCHEMA_VERSION)
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='temporary_test'").get(), undefined)
  } finally { db.close() }
})

test('newer database is rejected without downgrade', () => {
  const db = openDatabase(':memory:')
  try {
    db.exec('PRAGMA user_version=99')
    assert.throws(() => migrate(db), /Unsupported/)
    assert.equal(schemaVersion(db), 99)
  } finally { db.close() }
})


test('schema 1 upgrades to latest schema without losing settings',()=>{
 const db=openDatabase(':memory:')
 try{
  setCompact(db,true)
  db.exec('DROP TABLE obs_samples; DROP INDEX events_channel_time; ALTER TABLE stream_events DROP COLUMN chatter_key; ALTER TABLE stream_events DROP COLUMN channel_id; ALTER TABLE viewer_samples DROP COLUMN category; ALTER TABLE viewer_samples DROP COLUMN category_id; ALTER TABLE stream_sessions DROP COLUMN end_quality; ALTER TABLE stream_sessions DROP COLUMN last_seen_at; ALTER TABLE stream_sessions DROP COLUMN category; ALTER TABLE stream_sessions DROP COLUMN category_id; ALTER TABLE stream_sessions DROP COLUMN title; DROP TABLE alert_queue; PRAGMA user_version=1')
  migrate(db)
  assert.equal(schemaVersion(db),SCHEMA_VERSION)
  assert.equal(getCompact(db),true)
  assert.equal(db.prepare('SELECT count(*) AS n FROM alert_queue').get()?.n,0)
 }finally{db.close()}
})
