import type { DatabaseSync } from 'node:sqlite'
export interface Rect { x: number; y: number; width: number; height: number }
interface State { bounds: { width: number; height: number; x?: number; y?: number }; maximized: boolean }
export function sanitizeWindowState(value: unknown, displays: Rect[]): State {
  const fallback = { bounds: { width: 1180, height: 760 }, maximized: false }
  if (!value || typeof value !== 'object') return fallback
  const { bounds, maximized } = value as { bounds?: Rect; maximized?: unknown }
  if (!bounds || ![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isSafeInteger) ||
      bounds.width < 700 || bounds.height < 440 || bounds.width > 10000 || bounds.height > 10000) return fallback
  const visible = displays.some(d => Math.min(d.x+d.width,bounds.x+bounds.width)-Math.max(d.x,bounds.x)>=160 &&
    bounds.y >= d.y && bounds.y+36 <= d.y+d.height)
  return visible ? { bounds: {...bounds}, maximized: maximized === true } : fallback
}
export function readWindowState(db: DatabaseSync, displays: Rect[]): State {
  const raw = db.prepare("SELECT value FROM settings WHERE key = 'window.v1'").get()?.value
  try { return sanitizeWindowState(typeof raw === 'string' ? JSON.parse(raw) : null, displays) }
  catch { return sanitizeWindowState(null, displays) }
}
export function writeWindowState(db: DatabaseSync, state: {bounds: Rect; maximized: boolean}): void {
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('window.v1',JSON.stringify(state))
}
