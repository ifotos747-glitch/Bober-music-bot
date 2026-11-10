# 🎵 BOBER MUSIC BOT 3.0 — start w Bot-Hosting.net

**Uruchamianie:** Node.js 24, `index.js`. Pakiety: `npm install --no-fund --no-audit`.

### Jeżeli aktualizujesz obecny serwer 2.7

1. Zrób kopię zapasową **.env, data/ i music/**.
2. W panelu przejdź do **Pliki**, naciśnij ikonę **GitHub** i połącz repozytorium.
3. Wybierz gałąź `main` i metodę **Merge / Scal**.
4. **Nie używaj Replace all files** (usuwa dane hostingu).
5. Upewnij się, że `index.js` jest ustawiony jako **Startup File**.
6. Uruchom ponownie i sprawdź `/status`, `/zrodla status`, `/testaudio`.

### GitHub

Kod możesz trzymać w prywatnym repozytorium. **Nie wysyłaj `.env` ani tokenu bota do GitHub!**
Trzymaj zmienne w pliku `.env` tylko na serwerze lub jako sekrety w panelu. `.gitignore` ukrywa również prywatne pliki `data/` i muzykę `music/`.

### Muzyka ze Spotify

`/play` rozpoznaje tytuł i wykonawcę z linku Spotify, sprawdza mapowania, pliki lokalne, Audius i Jamendo. Gdy nic nie pasuje jednoznacznie, użyj `/zrodla szukaj` i `/zrodla graj` albo `/alternatywa add`. Spotify nie jest tu źródłem audio.

### Weryfikacja API

`/zrodla status` testuje API z IP hostingu; `/status` sprawdza FFmpeg, yt-dlp i Voice. Test API nie potwierdza praw do odtwarzania utworu.

### Dodatkowa konfiguracja `.env`

```ini
AUDIUS_ENABLED=1
BOBER_YOUTUBE_FALLBACK=0
# JAMENDO_CLIENT_ID=TU_WLASNY_ID
```

Jeśli nie ma źródła, bot **nie obchodzi DRM ani blokady YouTube**, nie podmienia utworów losowo.
