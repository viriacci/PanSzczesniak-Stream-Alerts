# Design System — etap 2
Czarno-złoty interfejs PSSA: #101012 tło, #141417 nawigacja, #1b1b1e karty, #e3c048 akcent, #f2f2f2 tekst. Typografia: preferowane Inter/Cinzel/JetBrains Mono z systemowymi fallbackami (fonty jeszcze nie są dystrybuowane). Własne ikony SVG. Brak Tailwind, MUI i dodatkowych zależności UI.
- Tokeny CSS w styles/base.scss, wariant kompaktowy przez zmienną --space, focus-visible, reduced-motion, responsywny układ.
- Button, Panel, Status, Empty i ConfirmDialog w components/ui.tsx. Dialog korzysta z natywnego showModal, Escape i przywracania fokusu.
- ResizeHandle: pointer capture, strzałki/Home/End, role separator, zapis na końcu przeciągania.
- App: lewa nawigacja z wyszukiwaniem, panel kontekstu, shell, status bar, lokalne powiadomienia, skróty. Inspektor automatycznie ukryty przy szerokości <1080px, bez nadpisania preferencji.
- Pasek tytułowy Electron z systemowymi kontrolkami Windows, bez nowych IPC sterowania oknem.
- Layout v1 i window v1 zapisują się w istniejącej tabeli settings. Brak zmiany schematu SQL. Walidacja po stronie main, domyślne wartości przy uszkodzonym wpisie, odrzucanie okien poza ekranem.
- Dashboard i ekrany modułów nie generują sztucznych danych; Twitch, OBS i alerty nieaktywne do właściwych etapów.
- Ctrl+B menu; Ctrl+I inspektor; Ctrl+, ustawienia.
