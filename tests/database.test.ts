import {historyQueryTail} from '../src/main/alerts/queue.ts'
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
    assert.throws(() => migrate(db, [...Array<string>(SCHEMA_VERSION).fill('unused'), 'CREATE TABLE temporary_test(x); INVALID SQL;']))
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
 const db=openDatabase(':memory:',1)
 try{
  setCompact(db,true)
  migrate(db)
  assert.equal(schemaVersion(db),SCHEMA_VERSION)
  assert.equal(getCompact(db),true)
  assert.equal(db.prepare('SELECT count(*) AS n FROM alert_queue').get()?.n,0)
 }finally{db.close()}
})

test('v4 database gains covering history and chat indexes without losing rows',()=>{
 const db=openDatabase(':memory:',4)
 try{
  db.exec("INSERT INTO stream_sessions(channel_id,source,started_at) VALUES ('42','twitch',1000); INSERT INTO stream_events(session_id,source,external_id,kind,occurred_at,payload_json,chatter_key) VALUES (1,'twitch','chat1','chat',1000,'{}','a')")
  migrate(db);assert.equal(schemaVersion(db),SCHEMA_VERSION)
  assert.equal(db.prepare('SELECT count(*) n FROM stream_events').get()?.n,1)
  const plan=db.prepare("EXPLAIN QUERY PLAN SELECT count(*),count(DISTINCT chatter_key) FROM stream_events WHERE session_id=? AND kind='chat'").all(1)
  assert.match(JSON.stringify(plan),/events_chat_by_session/)
  const history=db.prepare('EXPLAIN QUERY PLAN SELECT id'+historyQueryTail).all()
  assert.match(JSON.stringify(history),/alert_queue_history/);assert.doesNotMatch(JSON.stringify(history),/TEMP B-TREE/)
 }finally{db.close()}
})
