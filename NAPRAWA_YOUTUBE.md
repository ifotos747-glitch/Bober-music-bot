# YouTube 403 na Bot-Hosting.net — BOBER MUSIC BOT 2.6

Wykryte dotychczas logi `Sign in to confirm you’re not a bot` oraz `HTTP Error 403` świadczą o odrzucaniu żądania przez YouTube (metadane albo pobranie strumienia audio). `ffmpeg` i sam Discord nie naprawiają takiej blokady.

Wersja 2.6:
- pomija osobne wywołanie metadanych dla linków `/play` do YouTube (można przywrócić przez `YOUTUBE_FETCH_METADATA=1`),
- zgłasza czytelnie przyczynę problemu z yt-dlp,
- umożliwia `/alternatywa add` przypisanie posiadanego legalnie pliku albo bezpośredniego strumienia do linku YouTube/Spotify.

**Nie oznacza to, że pobieranie z YouTube zostało naprawione dla zablokowanego IP hostingu.** Nie przesyłaj prywatnych cookies Google na hosting.

Jeśli chcesz porównać sieci: testuj ten sam publiczny film z tym samym yt-dlp na swoim Windowsie, bez cookies; rozbieżność jest przesłanką ograniczenia po stronie sieci hostingu.
