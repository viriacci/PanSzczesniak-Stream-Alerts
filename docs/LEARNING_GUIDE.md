# Orientacja w kodzie

| Obszar | Pliki |
| --- | --- |
| Interfejs i stan | `src/renderer/src/App.tsx`, `features/`, `navigation.ts` |
| Style | `src/renderer/src/styles/base.scss` |
| IPC | `src/shared/contracts.ts`, `src/preload/index.ts`, `src/main/ipc.ts` |
| Dane | `src/main/database/`, `src/main/alerts/store.ts` |
| Sceny | `features/studio.tsx`, `src/shared/scene.ts`, `src/shared/scene-player.ts` |
| Nakładka | `src/main/overlay/server.ts` |
| Testy | `tests/`, workflow Windows |

Zmiany modelu należy walidować po stronie main. Nowe komponenty modułów umieszczać w `features/`; wspólny kod renderowania scen musi działać również w przeglądarce OBS.
