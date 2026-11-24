# Handoff — 2.0-dev.4
Pracować tylko na develop/v2 od aktualnego HEAD; main/legacy/python bez zmian.
Etap 3 run 45357845578: typecheck PASS, test overlay FAIL (parameter property w strip-only Node). Poprawiono konstruktor Overlay w etapie 4. Wymagany zielony pełny pipeline.
Etap 4: trwała kolejka (schema 2), priority, FIFO, move, pause-after-current, skip, replay, dedup, cooldown, minCount, volume/mute, gap, history, ACK i requeue z limitem 3. UI kolejki/aktywności, testy. Brak gwarancji dokładnie jednego wyświetlenia przy awarii. Nie twierdzić że test realnego Twitch/OBS wykonany.
Następny: AUDYT A, nie etap 5. Sprawdzić CI i poprawić błędy. Przejrzeć wszystkie moduły etapu 1–4, OAuth/EventSub, IPC, migrację, kolejkę, OBS, media, UX, bezpieczeństwo, obciążenie. Dokumentować P0/P1 i blokować dalsze prace do naprawy; wyniki ręczne osobno. Dopiero po audycie etap 5 Agent i OBS WebSocket. Audyty B po 7 i C po 10.
