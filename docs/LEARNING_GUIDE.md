# Przewodnik do samodzielnej nauki
1. src/renderer/src/App.tsx — useState, useEffect, funkcje async i renderowanie warunkowe. Zobacz jak przełącznik jest sterowany stanem.
2. styles/base.scss — zmienne, grid, flex, clamp, focus-visible, modyfikator compact.
3. src/shared/contracts.ts — TypeScript, interfejsy, walidacja danych w runtime.
4. src/preload/index.ts — bezpieczny adapter między przeglądarką i Node.
5. src/main/ipc.ts — autoryzacja nadawcy, walidacja, wywołanie bazy.
6. src/main/database/index.ts — migracje, transakcje, klucze obce, prepared statements.
7. tests — testy zachowania zamiast testów szczegółów implementacji.
Prześledź kliknięcie przycisku compact od JSX przez preload i IPC do SQLite, a potem zamknij i uruchom aplikację. To działający pionowy przekrój architektury.

## Etap 2
- styles/base.scss: tokeny, responsywne media queries, flex/grid, stan focus, wariant compact.
- components/ui.tsx: reużywalne komponenty, props, children i natywny dialog.
- components/ResizeHandle.tsx: pointer events, useRef, klawiatura i dostępność.
- navigation.ts i features/pages.tsx: mapowanie danych na interfejs, rozdział modułów.
- App.tsx i shared/layout.ts: stan, serializacja zapisów oraz kontrakt walidowany przez main.
