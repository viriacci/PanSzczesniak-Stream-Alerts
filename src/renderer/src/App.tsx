import { useEffect, useState } from 'react'
import type { SystemStatus } from '../../shared/contracts'

export function App() {
  const [status, setStatus] = useState<SystemStatus>()
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    window.pssa.getStatus().then(value => {
      if (active) setStatus(value)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])

  async function toggleCompact() {
    if (!status || saving) return
    setSaving(true)
    setError(false)
    try {
      const compact = await window.pssa.setCompact(!status.compact)
      setStatus(previous => previous ? { ...previous, compact } : previous)
    } catch { setError(true) }
    finally { setSaving(false) }
  }

  return (
    <main className={status?.compact ? 'shell compact' : 'shell'}>
      <header><span className="brand">PSSA</span><span className="tag">DEVELOPMENT</span></header>
      <section className="panel">
        <p className="eyebrow">ETAP 01 / FUNDAMENTY</p>
        <h1>PanSzczesniak Stream Alerts</h1>
        <p>Nowa aplikacja lokalna dla Twitcha i OBS.</p>
        <dl>
          <dt>Wersja</dt><dd>{status?.version ?? '—'}</dd>
          <dt>Baza danych</dt><dd>{status ? 'SQLite · gotowa' : 'Oczekiwanie'}</dd>
          <dt>Schemat</dt><dd>{status?.schemaVersion ?? '—'}</dd>
          <dt>Twitch / OBS</dt><dd>Zaplanowane</dd>
        </dl>
        <button type="button" disabled={!status || saving} aria-pressed={status?.compact ?? false} onClick={toggleCompact}>
          Tryb kompaktowy: {status?.compact ? 'włączony' : 'wyłączony'}
        </button>
        {error && <p role="alert">Nie udało się odczytać lub zapisać ustawień.</p>}
      </section>
      <footer>Interfejs diagnostyczny · Design System w etapie 2</footer>
    </main>
  )
}
