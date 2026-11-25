# Handoff — 2.0.0-rc.3
RC.2 afe100b3, run 45380348076 success, 83/83, audit 0, pełne Windows CI. Dwie odłożone funkcje wdrażane teraz zgodnie z użytkownikiem: skórki PSSA/ViviOnyx/Shiroe (koncepcje kolorystyczne, nie oficjalne brandbooki), świadomy pomiar rzeczywistej pracy w Diagnostyce i lokalne crash logi. Szczegóły docs/MEASUREMENT_AND_THEMES.md. 4 nowe testy Node, smoke IPC motywu i diagnostyki; CI oczekuje. Żadnych nowych npm dependencies, schema DB 5 bez zmian. Aktualizacja z RC.2. Nie publikować main/stable. Rzeczywiste pomiary Windows/OBS/Twitch i akceptacja skórki wymagane.

RC.3 commit 603d713, run 45382575827 pełny PASS. RC.4: paleta ViviOnyx zgodna z podanymi przez użytkownika HEX #141414, #843935, #ae9278; dostosowanie wykresów do motywu, test palety. CI RC.4 oczekuje.

RC.5: stylizowany NSIS MUI2, PSSA jako nazwa, generowane zasoby, niezależne checkboxy skrótów, dezinstalacja wykrytej instalacji, kompatybilność wewnętrznego exe i danych. docs/INSTALLER.md. CI oczekuje; nie publikować main/stable.

RC.5 run 45517037799 PASS; użytkownik odrzucił wygląd stockowego NSIS. RC.6 WPF bootstrapper (setup/), silnik NSIS wyłącznie po cichu, custom UI i spark ring, osobny artefakt PSSA-Setup-Windows. CI oczekuje. main bez zmian.

RC.6 first run 45518972169: WPF build succeeded, NSIS full tests succeeded, wrapper test exited 1; cause not yet proven. Added stage diagnostics, separate actual UI render gate, fallback registered location and explicit data-preserving uninstall. Do not release until wrapper succeeds.

RC.6 run 45519937580: WPF compile PASS, actual preview FAIL with WIC 0x88982F60 decoding ICO in XAML. Separate PNG window resource; PE icon remains ICO. Render Content visual and verify preview file. Full wrapper tests still required.
