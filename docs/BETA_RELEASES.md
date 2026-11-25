# Dystrybucja

Wydania Beta/RC z develop/v2 trafiają do GitHub Releases jako pre-release po przejściu pełnego CI Windows. Wydanie Stable jest osobnym procesem, uruchamianym wyłącznie dla zatwierdzonego commita wydawniczego. Instalator i SHA256SUMS.txt pochodzą z tego samego zweryfikowanego buildu.

Publikacja sprawdza sumy SHA-256 i metadane aktywów przed udostępnieniem szkicu. Opublikowanych wydań nie nadpisujemy. Stable 2.0.0 jest niepodpisane; automatyczne uruchomienie instalatora Stable wymaga zaufanego podpisu.
