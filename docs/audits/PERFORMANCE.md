# Performance
Baseline Windows CI run 45360806153: test zapisania 1000 oczekujących i odfiltrowania nadmiaru 108.3551 ms (środowisko testowe, SQLite in-memory, nie benchmark PC użytkownika).
Nowy test: pełne przejście 1000 alertów ze sztucznym zegarem i mockiem transportu, kontrola unikalności prób i liczby done. Wynik oczekuje CI.
Do pomiaru na Windows z OBS i grą: CPU/GPU/RAM, dropped frames, opóźnienie ACK, wycieki przez wielogodzinne działanie. Nie szacować wyników bez pomiaru.
