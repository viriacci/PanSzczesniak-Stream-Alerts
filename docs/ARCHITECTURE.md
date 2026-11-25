# Architektura

PSSA jest aplikacją Electron z interfejsem React/TypeScript i lokalną bazą SQLite.

## Procesy i granice

```text
React renderer -> PssaApi -> preload -> IPC -> main
                                           |-- SQLite
                                           |-- Twitch OAuth / EventSub
                                           |-- OBS WebSocket
                                           |-- HTTP/SSE overlay
                                           |-- read workers
                                           |-- runtime / updates

OBS Control Dock -> authenticated local named pipe -> main
Optional Agent   -> authenticated loopback HTTP   -> main
```

- `src/renderer`: interfejs, nawigacja, kreator i ustawienia.
- `src/preload`: jawny kontrakt IPC przez contextBridge.
- `src/main`: serwisy, pliki, baza danych, autoryzacja i cykl życia aplikacji.
- `src/shared`: typy, walidacja, modele i wspólny renderer scen.
- `obs-dock`: natywna wtyczka C++/Qt.
- `setup`: instalator WPF z osadzonym pakietem NSIS.
- `tests`: testy Node i regresje; smoke Electron w `src/main/index.ts`.

## Dane

SQLite (node:sqlite), migracje transakcyjne przez user_version, FK i WAL. Baza o nowszym nieobsługiwanym schemacie jest odrzucana. Czas zdarzeń: Unix epoch w milisekundach, UTC. Brak próbki widzów nie oznacza zera. Media identyfikowane są przez SHA-256 zawartości.

## Bezpieczeństwo

Renderer nie ma dostępu do Node ani surowego ipcRenderer. IPC sprawdza nadawcę, główną ramkę, adres dokumentu i argumenty. Poświadczenia Twitch i OBS korzystają z safeStorage. Nakładka, Agent i dock komunikują się lokalnie. Logi diagnostyczne nie powinny zawierać poświadczeń.

## Wydajność

Kolejka budzi się na zdarzenia i terminy odtwarzania. Raporty i indeks biblioteki korzystają z krótkotrwałego workera odczytu. Tryb Background odmontowuje interfejs, pozostawiając działające usługi.
