# BOBER MUSIC BOT 3.0 — SMART MUSIC + GITHUB

Aktualizacja bota muzycznego dla Discorda, oparta na BOBER MUSIC BOT 2.7.

- Link Spotify: odczyt tytułu i wykonawcy → lokalne pliki → mapowania administratora → dokładne dopasowanie Audius/Jamendo.
- Gdy szukanie „wykonawca tytuł” nie znajduje utworu, bot sprawdza również sam tytuł i ponownie weryfikuje wykonawcę; nie włącza przypadkowych remiksów.
- Lekka pamięć podręczna katalogów (45 sekund, do 40 pozycji) ogranicza API i RAM.
- `/zrodla status`: dostępność Audius i Jamendo testowana bezpośrednio z hostingu.
- `/zrodla szukaj` i `/zrodla graj`: wybór nagrania po numerze, gdy automatyczne dopasowanie jest niejednoznaczne.
- Obsługa radio 24/7, AutoDJ, EQ, DJ, kolejek, playlist, MP3, YouTube (zależnie od uprawnień i blokad), Spotify (jako link do wyszukiwania), wszystkie dotychczasowe komendy.
- `.gitignore`, GitHub Actions i `BH_README.md` dla wdrożenia na Bot-Hosting.net.

**To nie jest obejście DRM Spotify ani zabezpieczeń YouTube.** Nie każde nagranie ma dostępny odpowiednik w Audius/Jamendo; prawa do nagrań trzeba respektować.

Wdrożenie krok po kroku: **`GITHUB_INSTRUKCJA.md`**. Konfiguracja: **`.env.example`**. Testy: `npm install && npm run check`.

Wersja kodu: 3.0.0. Testy lokalne nie zastępują testów połączenia z Discord Voice i strumieni na Twoim hostingu.
