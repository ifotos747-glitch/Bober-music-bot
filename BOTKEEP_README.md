# BOBER MUSIC BOT 4.1 — BOTKEEP EDITION

Gałąź migracyjna bazująca na 4.0.1. Nie zmienia logiki muzycznej ani formatów danych. 
## Migracja
1. Na starym hostingu wykonaj prywatną kopię .env, data/ i music/. Nie umieszczaj jej na GitHub.
2. Na Botkeep utwórz serwer Node.js >=24.17.0 i zaimportuj repozytorium ifotos747-glitch/Bober-music-bot, gałąź botkeep-4.1 (lub ZIP tej gałęzi). Plik package.json musi znajdować się w katalogu głównym.
3. Przenieś dane i muzykę oraz ustaw prywatne zmienne środowiskowe na podstawie .env.example. Zachowaj identyczny token i CLIENT_ID. Nie udostępniaj tokenów.
4. Instalacja: npm install --no-audit --no-fund. Jeśli FFmpeg nie działa, sprawdź czy skrypt instalacyjny ffmpeg-static został wykonany zgodnie z polityką npm hostingu.
5. Opcjonalnie npm run install:ytdlp (Linux x64, pobieranie z GitHub musi być dozwolone); alternatywnie ustaw YTDLP_PATH na dostępne narzędzie.
6. Uruchom npm run check oraz npm run check:host. Diagnostyka nie printuje wartości sekretów ani nie łączy się z Discordem. Brak yt-dlp jest ostrzeżeniem, nie blokuje radia.
7. Zatrzymaj starą instancję. Na Botkeep uruchom npm start (lub node index.js).
8. Sprawdź /status, /testaudio, /radio, /247, /equalizer, /dj, /ulubione, /playlist oraz /youtube diagnoza na dozwolonym materiale.
9. Zmierz zużycie RAM/dysku przy odtwarzaniu. UDP Discord Voice i YouTube nie są gwarantowane. Nie uruchamiaj równocześnie dwóch instancji z tym samym tokenem.
10. W razie problemu zatrzymaj Botkeep i uruchom poprzednią instancję. Nie usuwaj starego serwera przed zakończeniem testów.

Pakiet zakłada dostępność Node.js >=24.17, uruchamiania procesów FFmpeg/yt-dlp, trwałego dysku i wyjściowego UDP. Wymaga potwierdzenia na rzeczywistym hostingu. OAuth nie usuwa blokad YouTube; Spotify API zwraca metadane, nie audio.
