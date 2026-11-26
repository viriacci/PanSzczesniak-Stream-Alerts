<p align="center">
  <img src="src/renderer/src/assets/pssa-card.png" width="112" alt="PSSA">
</p>

# Pan Szczesniak Stream Alerts

PSSA to aplikacja dla streamerów korzystających z Twitcha i OBS Studio. Łączy alerty, nagrody za punkty kanału, edycję scen i statystyki transmisji w jednym programie na Windows. Dane są przechowywane lokalnie.

**PSSA 2.0.1** · [Pobierz instalator](https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases/tag/v2.0.1) · [Zgłoś błąd](https://github.com/viriacci/PanSzczesniak-Stream-Alerts/issues)

## Możliwości

- Alerty Twitch: obserwacje, subskrypcje, Prime, prezenty, raidy, Bits i nagrody kanału.
- Kreator Alertów z warstwami tekstu, obrazów, GIF-ów, wideo, audio, animacjami i klatkami kluczowymi.
- Kolejka z priorytetami, pauzą, ponownym odtwarzaniem, wyciszeniem i historią.
- Biblioteka multimediów, profile, szablony i warianty alertów.
- Dashboard transmisji, historia oglądalności oraz import i eksport statystyk.
- Integracja OBS WebSocket, opcjonalny Agent i natywny PSSA Control Dock.
- Trzy tryby pracy, personalizowany układ, skórki i kopie zapasowe.

## Instalacja

1. Pobierz plik `PSSA-Setup-2.0.1-x64.exe` z [wydania 2.0.1](https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases/tag/v2.0.1).
2. Sprawdź SHA-256 z plikiem `SHA256SUMS.txt`. Instalator nie ma podpisu cyfrowego. Pobierz go z oficjalnego wydania GitHub i uruchom ręcznie.
3. Uruchom instalator, a następnie zaloguj się do Twitcha w PSSA.
4. Skopiuj adres nakładki z Konfiguracji i dodaj go w OBS jako źródło przeglądarkowe (1920 × 1080). Opcjonalnie zainstaluj PSSA Control Dock w ustawieniach.
5. Uruchom alert testowy i sprawdź obraz oraz dźwięk w OBS.

Wymagany jest Windows x64. Wtyczka natywna jest przeznaczona dla standardowych instalacji OBS 31–33; tryb portable nie jest obsługiwany. Do zwykłych alertów wystarczy źródło przeglądarkowe.

Każdy profil Windows ma własną instalację, dane i port nakładki. Przy aktualizacji zamknij PSSA, Agenta i OBS w swoim profilu. Instalator zachowuje konfigurację i historię w `%APPDATA%\PSSA 2 Dev`. Przed aktualizacją warto wykonać kopię w ustawieniach programu. Nie udostępniaj adresów prywatnych nakładek ani kopii danych.

## Uruchomienie ze źródeł

Node.js 24, npm oraz Windows x64. Budowanie instalatora wymaga również .NET 8 SDK i środowiska CMake/Visual Studio dla wtyczki OBS.

```powershell
npm ci
npm run dev
```

Testy i kompilacja:

```powershell
npm run typecheck
npm test
npm run build
npm run smoke
npm run dist:win
```

## Dokumentacja

| Temat | Materiały |
| --- | --- |
| Konfiguracja | [Twitch](docs/TWITCH.md), [OBS](docs/OBS.md), [Control Dock](docs/OBS_CONTROL_DOCK.md) |
| Alerty | [Kolejka](docs/ALERT_ENGINE.md), [Kreator](docs/VISUAL_STUDIO.md), [Biblioteka i profile](docs/LIBRARY_PROFILES.md) |
| Statystyki | [Dashboard](docs/LIVE_CENTER.md), [Analityka](docs/ANALYTICS.md) |
| Rozwój | [Architektura](docs/ARCHITECTURE.md), [Instalator](docs/INSTALLER.md), [Testy wydania](docs/RELEASE_ACCEPTANCE.md) |

[Historia zmian](CHANGELOG.md) · [Plan rozwoju](ROADMAP.md) · [Wydania](https://github.com/viriacci/PanSzczesniak-Stream-Alerts/releases)

Wydania stabilne trafiają na `main`, a prace nad v2 na `develop/v2`. Starsza aplikacja Python jest zachowana na [`legacy/python`](https://github.com/viriacci/PanSzczesniak-Stream-Alerts/tree/legacy/python). Kod natywnej wtyczki OBS ma oznaczenie GPL-2.0-or-later. Nie zakłada to automatycznie tej samej licencji dla pozostałej aplikacji.
