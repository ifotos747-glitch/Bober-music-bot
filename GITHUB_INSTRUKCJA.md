# GitHub → Bot-Hosting.net, po polsku

## Utworzenie repozytorium

1. GitHub → przycisk **+** → **New repository / Nowe repozytorium**.
2. Nazwa: `BOBER-MUSIC-BOT`; wybierz **Private / Prywatne**.
3. Utwórz repozytorium bez dodawania README (pliki są już w paczce).
4. Prześlij do głównego katalogu repozytorium pliki i foldery projektu: `index.js`, `package.json`, `src/`, `tests/`, `music/demo.wav`, `music/test-dzwiek.ogg`, `tools/`, `.env.example`, `.gitignore`, `.github/workflows/test.yml` oraz pliki instrukcji.
5. **Nigdy nie dodawaj `.env`, `data/`, swoich MP3, `node_modules/`, tokenów lub plików cookies.**
6. W zakładce GitHub **Actions / Akcje** sprawdź zielony test.

## Połączenie działającego bota w Bot-Hosting.net

1. **Zatrzymaj** bota i utwórz kopię `.env`, `data/`, `music/`.
2. **Pliki → ikona GitHub** (w panelu plików).
3. Połącz konto GitHub, wybierz repozytorium `BOBER-MUSIC-BOT` i gałąź `main`.
4. Wybierz **Merge / Scal** (zachowaj aktualne dane), NIE **Replace all files / Zastąp wszystkie pliki**.
5. Kliknij **Sync / Synchronizuj**.
6. **Uruchamianie → Startup File: `index.js`**. Uruchom bota.
7. W Discord wpisz `/status`, `/zrodla status` oraz `/testaudio`. Jeśli nowa podkomenda nie pojawia się, zarejestruj komendy przez `node src/register.js` albo mechanizm rejestracji przy starcie.

Bot-Hosting.net oferuje także **Git auto-pull** podczas restartu. Po połączeniu repozytorium możesz sprawdzić, czy opcja jest włączona i świadomie jej używać.

Instrukcja oficjalna: https://bot-hosting.net/docs/guides/clone-a-github-repository

## Sekrety

`.env` musi zostać na hostingu i nie powinien trafić na GitHub, nawet do prywatnego repo. Jeżeli token był kiedykolwiek opublikowany, zresetuj go w Discord Developer Portal.
