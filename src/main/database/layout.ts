import type { DatabaseSync } from 'node:sqlite'
import { defaultLayout, parseLayout, type LayoutPreferences } from '../../shared/layout.ts'

export function getLayout(db: DatabaseSync): LayoutPreferences {
  const raw = db.prepare("SELECT value FROM settings WHERE key = 'layout.v1'").get()?.value
  if (typeof raw !== 'string') return { ...defaultLayout }
  try { return parseLayout(JSON.parse(raw)) } catch { return { ...defaultLayout } }
}
export function setLayout(db: DatabaseSync, value: unknown): LayoutPreferences {
  const safe = parseLayout(value)
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('layout.v1', JSON.stringify(safe))
  return safe
}
