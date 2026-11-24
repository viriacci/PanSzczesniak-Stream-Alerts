import type {DatabaseSync} from 'node:sqlite'
import {defaults,parseRuntime} from '../../shared/runtime.ts'
export function preferences(db:DatabaseSync){try{const raw=db.prepare("SELECT value FROM settings WHERE key='runtime.v1'").get()?.value;return typeof raw==='string'?parseRuntime(JSON.parse(raw)):{...defaults}}catch{return {...defaults}}}
export function savePreferences(db:DatabaseSync,value:unknown){const v=parseRuntime(value);db.prepare("INSERT INTO settings(key,value) VALUES ('runtime.v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(v));return v}
