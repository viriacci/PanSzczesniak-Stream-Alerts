import { appendFileSync, existsSync, renameSync, statSync, rmSync } from 'node:fs'
import { join } from 'node:path'

type EventCode = 'startup' | 'ready' | 'startup-failed' | 'renderer-gone' | 'shutdown'
export function createLogger(directory: string) {
  const file = join(directory, 'application.log')
  return (event: EventCode): void => {
    // No arbitrary payloads, URLs, credentials or user data in these logs.
    try {
      if (existsSync(file) && statSync(file).size > 1_000_000) {
        rmSync(file + '.previous', {force:true})
        renameSync(file, file + '.previous')
      }
      appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), event }) + '\n', { mode: 0o600 })
    } catch {
      console.warn('PSSA: unable to write diagnostic log')
    }
  }
}
