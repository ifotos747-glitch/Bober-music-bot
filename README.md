# 🎵 BOBER MUSIC BOT 4.0 — MEGA MUSIC UPDATE

Bot muzyczny Discord dla **Bot-Hosting.net** (Node.js 24+, `index.js`). Rozwija wersję 3.0.1, bez usuwania komend oraz integracji z YouTube OAuth, Spotify Web API, Audius, Jamendo, radiem, plikami lokalnymi, AutoDJ i trybem 24/7.

## Co nowego w 4.0

| Funkcja | Komendy / możliwości |
| --- | --- |
| 🎚️ Nowa kolejka | `/kolejka usun numer:2`, `/kolejka przenies z:3 na:1`, `/kolejka tasuj`, `/kolejka wyczysc` |
| ❤️ Ulubione na użytkownika | `/ulubione dodaj`, `/ulubione lista`, `/ulubione graj numer:1`, `/ulubione usun numer:1` |
| 🔁 Powtarzanie | `/powtorz tryb:one`, `/powtorz tryb:all`, `/powtorz tryb:off`; bez argumentu: status |
| 🎛️ Panel 4.0 | `/panel` — dotychczasowe 4 przyciski plus **Tasuj kolejkę** i **Zmień powtarzanie** |
| 💾 Bezpieczny zapis | Ulubione w `data/favorites-<guildId>-<userId>.json`, maksymalnie 30 pozycji na użytkownika i serwer |
| 🛡️ Ochrona odtwarzania | Pominięte, błędne i diagnostyczne utwory oraz tryby ciągłe 24/7 nie są powtarzane |

Nowe komendy kolejki wymagają pobytu **na tym samym kanale głosowym** co bot. Ulubione są prywatne dla danego użytkownika w ramach konkretnego serwera. Tryb powtarzania działa tylko w bieżącej sesji (po restarcie jest wyłączony). Przy `one` aktualny utwór wraca na początek kolejki, przy `all` — na koniec. Radio/AutoDJ 24/7 ma własne zachowanie i nie korzysta z powtarzania 4.0.

## Zachowane funkcje 3.0.1

- `/play`, `/search`, `/skip`, `/pause`, `/resume`, `/stop`, `/volume`, `/queue`, `/nowplaying`, `/files`, `/testaudio`, `/status`.
- `/playlist save|load|list|delete` — playlisty serwera.
- `/radio list|play|panel|now|stop|add|remove` oraz `/247 on|off|status`.
- `/autodj`, `/equalizer`, `/dj`.
- `/alternatywa add|remove|list` — własne legalne strumienie i pliki.
- `/zrodla status|szukaj|graj` — dostępne nagrania w Audius i Jamendo.
- `/spotify status|utwor` — wyłącznie metadane Spotify Web API.
- `/youtube status|konto|playlisty` — odczyt danych YouTube przez OAuth.

**Ważne:** Spotify Web API i YouTube Data API **nie dostarczają strumienia audio do Discorda**. OAuth nie usuwa blokady HTTP 403 YouTube. Bot nie obchodzi DRM; odtwarza jedynie dostępne i dozwolone źródła audio.

## Aktualizacja na Bot-Hosting.net

1. Zrób kopię `.env`, `data/` i `music/`. W `.env` są prywatne tokeny, więc nie wrzucaj go na GitHub.
2. Panel Bot-Hosting.net → **Pliki → GitHub** → repozytorium `ifotos747-glitch/Bober-music-bot`, gałąź `main` → **Merge / Scal**, bez **Replace all files**.
3. Jeśli hosting wymaga, uruchom `npm install --no-audit --no-fund`; plik startowy: `index.js`.
4. Zrestartuj serwer; bot automatycznie rejestruje komendy na serwerze Discord wskazanym przez `GUILD_ID`.
5. Sprawdź `/status`, `/panel`, `/kolejka tasuj`, `/ulubione lista` oraz `/youtube konto`. Zachowaj stare pliki `data/` — zawierają zapisane playlisty, efekty, stacje i ustawienia 24/7.

Szczegóły: [BH_README.md](BH_README.md). Prywatna konfiguracja: [.env.example](.env.example). OAuth: [YOUTUBE_OAUTH_KROK_PO_KROKU.md](YOUTUBE_OAUTH_KROK_PO_KROKU.md).

## Testy / bezpieczeństwo

```bash
npm install --no-audit --no-fund
npm run check
```

GitHub Actions uruchamia `npm run check` na gałęziach i pull requestach. Testy modułów weryfikują kolejkę, powtarzanie i izolację ulubionych. Testy automatyczne nie zastępują testu żywego połączenia z Discord Voice i dostępności strumieni na Bot-Hosting.net.

Nie publikuj plików `.env*`, `data/`, Client Secret ani tokenów. Pliki zawierające te dane są ignorowane przez `.gitignore`.
