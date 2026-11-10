# BOBER MUSIC BOT 3.0.1 — YouTube OAuth + Spotify Web API

## Google YouTube (dane konta i prywatne playlisty, NIE audio)
1. W Google Cloud włącz **YouTube Data API v3** i skonfiguruj ekran zgody OAuth. Przy trybie testowym dodaj swój adres jako test user.
2. W Google Cloud utwórz OAuth **Desktop app** (jeśli istniejący jest typu Web, dodaj drugi Desktop), pobierz plik JSON wyłącznie na komputer Windows.
3. Pobierz repozytorium GitHub jako ZIP, rozpakuj, otwórz PowerShell w katalogu z `index.js`.
4. Wpisz `node tools/youtube-oauth-desktop.js`, podaj lokalną ścieżkę do pobranego JSON, otwórz podany URL Google na TYM SAMYM komputerze i zaakceptuj zakres youtube.readonly.
5. Z pliku `.env.youtube-oauth.local` skopiuj trzy linie YOUTUBE_OAUTH_* wyłącznie do prywatnego pliku `.env` na Bot-Hosting.net.
6. Zrestartuj bota i użyj `/youtube status`, `/youtube konto`, `/youtube playlisty`.

## Spotify (metadane utworów, NIE audio)
1. Otwórz https://developer.spotify.com/dashboard i wybierz swoją aplikację (Development Mode może wymagać aktywnego Premium).
2. Odczytaj **Client ID** oraz **Client Secret** z jej ustawień.
3. Na Bot-Hosting.net → Pliki → prywatny `.env` dodaj:
   `SPOTIFY_CLIENT_ID=... `
   `SPOTIFY_CLIENT_SECRET=... `
4. Zrestartuj bota. Na Discordzie uruchom `/spotify status` i `/spotify utwor` z linkiem `https://open.spotify.com/track/...`.
5. Przy `/play` bot może skorzystać z oficjalnych metadanych i znaleźć legalnie dostępne audio w Audius/Jamendo lub `music/`. Nie pobiera audio ze Spotify.

## Bezpieczeństwo
- Nigdy nie publikuj `.env`, plików JSON Google, Client Secret, refresh tokenów ani tokenów Discorda na GitHubie/Discordzie.
- `CLIENT_ID` Discorda to **osobna** zmienna — nie zastępuj jej Google/Spotify Client ID.
- OAuth Google w statusie Testing może wygasnąć po 7 dniach dla youtube.readonly. Wtedy wygeneruj token ponownie.
- API Spotify w Development Mode podlega ograniczeniom (Premium, limity i dostępne endpointy).
- YouTube OAuth i Spotify API nie usuwają blokady `yt-dlp HTTP 403` i nie służą do nadawania oryginalnego audio tych platform przez Discorda.
