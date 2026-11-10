# 🎵 BOBER MUSIC BOT 4.0 — Bot-Hosting.net

**Start:** Node.js 24+ · Startup File `index.js` · `npm install --no-audit --no-fund`.

## Aktualizacja z wersji 3.0.1

1. **Zrób kopię**: `.env`, `data/` i `music/`.
2. Otwórz Bot-Hosting.net → **Files / Pliki** → integracja **GitHub**.
3. Wybierz repo `ifotos747-glitch/Bober-music-bot`, gałąź `main` i opcję **Merge / Scal**.
4. **Nie wybieraj „Replace all files” / „Zastąp wszystkie pliki”**, bo może usunąć `.env`, ulubione, zapisane playlisty i własne pliki MP3.
5. Sprawdź Startup File: `index.js`. Zainstaluj zależności, jeśli panel nie zrobił tego sam, i **Restart**.
6. Konsola powinna pokazać `START BOBER MUSIC BOT 4.0.0` oraz udaną rejestrację komend Discord. Przetestuj `/status` i `/testaudio`.

## Nowe funkcje 4.0

- `/kolejka usun numer:1` — usuń oczekujący utwór.
- `/kolejka przenies z:2 na:1` — zmień kolejność.
- `/kolejka tasuj`, `/kolejka wyczysc` — tasuj lub wyczyść przyszłe utwory; bieżący odtwarza się nadal.
- `/powtorz tryb:one|all|off` — powtórz utwór, kolejkę albo wyłącz.
- `/ulubione dodaj` — zapisz bieżący utwór; `/ulubione lista`, `/ulubione graj numer:1`, `/ulubione usun numer:1`.
- `/panel` — dwa nowe przyciski (Tasuj, Powtarzanie).

Komendy zmiany kolejki i powtarzania wymagają przebywania z botem na kanale głosowym. Powtarzanie nie zapętla błędnego audio, pominiętych utworów, radia 24/7 ani plików diagnostycznych.

## Ustawienia, które muszą pozostać prywatne

Nie usuwaj dotychczasowego `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`. Jeżeli masz działające Google OAuth, zachowaj również:
```ini
YOUTUBE_OAUTH_CLIENT_ID=...
YOUTUBE_OAUTH_CLIENT_SECRET=...
YOUTUBE_OAUTH_REFRESH_TOKEN=...
```
**Nie wpisuj prawdziwych wartości w GitHub, zgłoszeniach ani na czacie.**

Dla Spotify i katalogów Audius/Jamendo zachowaj dotychczasowe zmienne środowiskowe. `data/` przechowuje dane per serwer, a `data/favorites-*.json` — nowe ulubione per użytkownik. Oba katalogi nie są synchronizowane na GitHub.

## Po aktualizacji

Uruchom kolejno: `/status`, `/help`, `/ulubione lista`, `/play source:demo.wav`, `/ulubione dodaj`, `/kolejka tasuj`, `/powtorz tryb:one` i `/panel`.

Pamiętaj: OAuth YouTube/Spotify umożliwia odczyt danych, **nie** bezpośrednie strumieniowanie muzyki ani obchodzenie HTTP 403. 24/7 wymaga stale działającego hostingu.
