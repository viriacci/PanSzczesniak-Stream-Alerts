# Performance
Baseline Windows CI run 45360806153: test zapisania 1000 oczekujących i odfiltrowania nadmiaru 108.3551 ms (środowisko testowe, SQLite in-memory, nie benchmark PC użytkownika).
Nowy test: pełne przejście 1000 alertów ze sztucznym zegarem i mockiem transportu, kontrola unikalności prób i liczby done. Wynik oczekuje CI.
Do pomiaru na Windows z OBS i grą: CPU/GPU/RAM, dropped frames, opóźnienie ACK, wycieki przez wielogodzinne działanie. Nie szacować wyników bez pomiaru.

## Baseline etapu 7
Run 45370241006: kolejka 1000 zdarzeń 119.3399 ms; pełne przejście 1000 zdarzeń w teście 1041.863 ms (SQLite in-memory, fake clock/transport; nie czas faktycznego playback). B10 ogranicza rekonstrukcje mediów przy drag, B12 ogranicza serializację pełnych scen w snapshotach kolejki. Nowy wynik CI oczekuje. CPU/GPU/RAM i stabilność wielogodzinna wymagają rzeczywistego Windows+OBS+gra.

## Beta.2
Walidacja archiwum przechodzi na tymczasową bazę dyskową z ograniczeniem cache, aby nie duplikować całej historii w pamięci. Nie jest to pomiar. Raport diagnostyczny pozwoli zmierzyć Studio/Streaming/Background na realnym Windows. Pomiary podczas OBS+gra i długiej sesji nie zostały jeszcze wykonane.
