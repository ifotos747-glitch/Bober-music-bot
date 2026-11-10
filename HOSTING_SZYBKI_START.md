# BOBER MUSIC BOT 2.7 — SZYBKI START (Bot-Hosting.net)

1. W panelu **Bober-music bot** kliknij **Zatrzymaj**.
2. W zakładce **Pliki** prześlij `BOBER_MUSIC_BOT_2_7_SMART_SOURCES.zip` i użyj **Rozpakuj** w katalogu głównym (tam gdzie `index.js`, `package.json`, `src/`).
3. **Nadpisz stare pliki programu**, ale **nie usuwaj ani nie nadpisuj** swojego `.env`, folderu `data/` i własnych MP3 w `music/`.
4. Ustaw w **Uruchamianie / Plik startowy**: `index.js`.
5. Kliknij **Uruchom**. W konsoli oczekuj `START BOBER MUSIC BOT 2.7.0` i `Zarejestrowano 22 komend`.
6. Na Discordzie wpisz `/status` i `/zrodla szukaj query:wykonawca tytuł`.
7. Wybierz pozycję przez `/zrodla graj numer:1` (najpierw dołącz do kanału głosowego).
8. Dla Spotify: `/play source:https://open.spotify.com/track/...` — bot szuka własnego, bezpośredniego źródła, ale **nie udaje, że każdy utwór ma odpowiednik**.

## Konfiguracja źródeł

- Audius: włączony domyślnie, najpierw sprawdź `/zrodla szukaj`. Dostęp do katalogu zależy od API Audius; jeśli usługa wymaga autoryzacji, otrzymasz informację o niedostępności.
- Jamendo: opcjonalny, wymaga **własnego Client ID** z https://devportal.jamendo.com/ i dopisania do `.env`: `JAMENDO_CLIENT_ID=TWOJ_CLIENT_ID`.
- Aby wyłączyć Audius: `AUDIUS_ENABLED=0`.
- Aby opcjonalnie próbować YouTube, gdy nie ma dokładnego źródła dla Spotify: `BOBER_YOUTUBE_FALLBACK=1` (domyślnie WYŁĄCZONE z powodu blokady IP/403).

Pamiętaj: Discordowy bot **nie odtwarza oryginalnego strumienia Spotify**. Katalogi zawierają także inne wersje utworów i remiksy. Automatycznie wybrane może być tylko jedno jednoznaczne dopasowanie tytułu i wykonawcy; wybór przez `/zrodla` zawsze należy do Ciebie.

Ta paczka nie zawiera tokenu Discord ani prywatnych plików .env.
