'use strict';
const { SlashCommandBuilder } = require('discord.js');
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Odtwórz YouTube, Spotify (wyszukiwanie), radio lub plik')
    .addStringOption(o => o.setName('source').setDescription('Link YouTube/Spotify, tytuł utworu, URL radia lub demo.wav').setRequired(true)),
  new SlashCommandBuilder().setName('search').setDescription('Wyszukaj utwór; najpierw sprawdź katalogi źródeł')
    .addStringOption(o => o.setName('query').setDescription('Tytuł utworu / wykonawca').setRequired(true)),
  new SlashCommandBuilder().setName('testaudio').setDescription('12-sekundowy test głosu OGG/Opus BEZ FFmpeg i YouTube'),
  new SlashCommandBuilder().setName('skip').setDescription('Pomiń aktualny utwór'),
  new SlashCommandBuilder().setName('pause').setDescription('Wstrzymaj muzykę'),
  new SlashCommandBuilder().setName('resume').setDescription('Wznów muzykę'),
  new SlashCommandBuilder().setName('stop').setDescription('Zatrzymaj odtwarzanie i rozłącz'),
  new SlashCommandBuilder().setName('queue').setDescription('Pokaż kolejkę'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Pokaż aktualny utwór'),
  new SlashCommandBuilder().setName('files').setDescription('Lista plików audio w music/'),
  new SlashCommandBuilder().setName('volume').setDescription('Głośność muzyki')
    .addIntegerOption(o => o.setName('level').setDescription('Od 0 do 200%').setMinValue(0).setMaxValue(200).setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('Pomoc Bober Music Bot 4.0'),
  new SlashCommandBuilder().setName('panel').setDescription('Wyświetl przyciski sterowania muzyką'),
  new SlashCommandBuilder().setName('autodj').setDescription('Automatycznie odtwarzaj pliki music/')
    .addStringOption(o => o.setName('mode').setDescription('Włącz lub wyłącz AutoDJ')
      .addChoices({ name: 'Włącz', value: 'on' }, { name: 'Wyłącz', value: 'off' }).setRequired(true)),
  new SlashCommandBuilder().setName('playlist').setDescription('Zapisane playlisty serwera')
    .addSubcommand(s => s.setName('save').setDescription('Zapisz teraz grający utwór i kolejkę')
      .addStringOption(o => o.setName('name').setDescription('Nazwa playlisty (do 40 znaków)').setRequired(true)))
    .addSubcommand(s => s.setName('load').setDescription('Dodaj zapisaną playlistę do kolejki')
      .addStringOption(o => o.setName('name').setDescription('Nazwa playlisty').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Lista zapisanych playlist'))
    .addSubcommand(s => s.setName('delete').setDescription('Usuń zapisaną playlistę')
      .addStringOption(o => o.setName('name').setDescription('Nazwa playlisty').setRequired(true))),
  new SlashCommandBuilder().setName('radio').setDescription('Centrum stacji radiowych Bober Music Bot')
    .addSubcommand(s => s.setName('list').setDescription('Pokaż zapisane stacje radiowe'))
    .addSubcommand(s => s.setName('play').setDescription('Odtwórz zapisaną stację na kanale głosowym')
      .addStringOption(o => o.setName('station').setDescription('Nazwa stacji').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('add').setDescription('Dodaj stację (administrator serwera)')
      .addStringOption(o => o.setName('name').setDescription('Nazwa stacji').setRequired(true))
      .addStringOption(o => o.setName('url').setDescription('Bezpośredni URL strumienia MP3/AAC/OGG/HLS').setRequired(true))
      .addStringOption(o => o.setName('genre').setDescription('Gatunek, np. POP, ROCK, TECHNO')))
    .addSubcommand(s => s.setName('remove').setDescription('Usuń stację (administrator serwera)')
      .addStringOption(o => o.setName('station').setDescription('Nazwa stacji').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('panel').setDescription('Wyświetl panel wyboru radia'))
    .addSubcommand(s => s.setName('now').setDescription('Sprawdź obecnie grające radio'))
    .addSubcommand(s => s.setName('stop').setDescription('Zatrzymaj aktualne radio, pozostaw bota na kanale')),
  new SlashCommandBuilder().setName('247').setDescription('Muzyka i radio bez przerwy, także po restarcie bota')
    .addSubcommand(s => s.setName('on').setDescription('Włącz stałe odtwarzanie (administrator)')
      .addStringOption(o => o.setName('mode').setDescription('Źródło muzyki 24/7').setRequired(true)
        .addChoices({ name: 'Cisza: sam pobyt na kanale', value: 'silent' }, { name: 'Radio internetowe', value: 'radio' }, { name: 'AutoDJ z music/', value: 'autodj' }))
      .addStringOption(o => o.setName('station').setDescription('Stacja zapisana przez /radio add').setAutocomplete(true)))
    .addSubcommand(s => s.setName('off').setDescription('Wyłącz tryb 24/7 (administrator)'))
    .addSubcommand(s => s.setName('status').setDescription('Pokaż stan trybu 24/7')),
  new SlashCommandBuilder().setName('equalizer').setDescription('Korektor dźwięku dla YouTube, radia i MP3')
    .addSubcommand(s => s.setName('preset').setDescription('Wybierz profil equalizera')
      .addStringOption(o => o.setName('name').setDescription('Preset').setRequired(true)
        .addChoices({name:'Flat (normalnie)', value:'flat'}, {name:'Bass Boost', value:'bass'},
          {name:'Vocal', value:'vocal'}, {name:'Rock', value:'rock'},
          {name:'Electronic', value:'electronic'}, {name:'Soft', value:'soft'})))
    .addSubcommand(s => s.setName('custom').setDescription('Reguluj trzy pasma -12 do +12 dB')
      .addIntegerOption(o => o.setName('bass').setDescription('Niskie tony -12..12').setMinValue(-12).setMaxValue(12).setRequired(true))
      .addIntegerOption(o => o.setName('mid').setDescription('Średnie tony -12..12').setMinValue(-12).setMaxValue(12).setRequired(true))
      .addIntegerOption(o => o.setName('treble').setDescription('Wysokie tony -12..12').setMinValue(-12).setMaxValue(12).setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('Pokaż korektor i ustawienia DJ'))
    .addSubcommand(s => s.setName('off').setDescription('Wyłącz korektor EQ')),
  new SlashCommandBuilder().setName('dj').setDescription('Efekty DJ podczas odtwarzania YouTube, MP3 i radia')
    .addSubcommand(s => s.setName('preset').setDescription('Wybierz efekt DJ')
      .addStringOption(o => o.setName('name').setDescription('Efekt').setRequired(true)
        .addChoices({name:'Normalnie', value:'off'}, {name:'Nightcore', value:'nightcore'},
          {name:'Slowed', value:'slowed'}, {name:'Echo', value:'echo'},
          {name:'8D (ruch stereo)', value:'8d'}, {name:'Club', value:'club'})))
    .addSubcommand(s => s.setName('status').setDescription('Sprawdź aktywny efekt DJ'))
    .addSubcommand(s => s.setName('off').setDescription('Wyłącz efekty DJ')),
  new SlashCommandBuilder().setName('alternatywa').setDescription('Własne legalne źródła audio dla YouTube i Spotify')
    .addSubcommand(x => x.setName('add').setDescription('Przypisz plik MP3 lub strumień do linku (administrator)')
      .addStringOption(o => o.setName('source').setDescription('Link Spotify/YouTube lub tytuł utworu').setRequired(true))
      .addStringOption(o => o.setName('audio').setDescription('Plik np. piosenka.mp3 z music/ lub bezpośredni strumień audio').setRequired(true)))
    .addSubcommand(x => x.setName('remove').setDescription('Usuń przypisanie (administrator)')
      .addStringOption(o => o.setName('source').setDescription('Link Spotify/YouTube lub tytuł utworu').setRequired(true)))
    .addSubcommand(x => x.setName('list').setDescription('Pokaż przypisane źródła audio')),
  new SlashCommandBuilder().setName('zrodla').setDescription('Szukaj legalnych strumieni w Audius i Jamendo')
    .addSubcommand(s => s.setName('szukaj').setDescription('Znajdź utwór w otwartych katalogach')
      .addStringOption(o => o.setName('query').setDescription('Wykonawca i tytuł').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('Sprawdź dostęp do API Audius i Jamendo z hostingu'))
    .addSubcommand(s => s.setName('graj').setDescription('Odtwórz wybrany numer z ostatniego wyszukiwania')
      .addIntegerOption(o => o.setName('numer').setDescription('Numer 1–8 z /zrodla szukaj').setRequired(true).setMinValue(1).setMaxValue(8))),
  new SlashCommandBuilder().setName('spotify').setDescription('Spotify Web API — metadane utworów (bez audio)')
    .addSubcommand(s => s.setName('status').setDescription('Sprawdź Spotify Client ID i Secret'))
    .addSubcommand(s => s.setName('utwor').setDescription('Pokaż tytuł i wykonawcę nagrania Spotify')
      .addStringOption(o => o.setName('link').setDescription('Link do utworu Spotify (track)').setRequired(true))),
  new SlashCommandBuilder().setName('youtube').setDescription('YouTube OAuth — dane konta, tylko odczyt')
    .addSubcommand(s => s.setName('status').setDescription('Sprawdź konfigurację OAuth 2.0'))
    .addSubcommand(s => s.setName('konto').setDescription('Sprawdź połączony kanał YouTube (administrator)'))
    .addSubcommand(s => s.setName('playlisty').setDescription('Lista playlist konta (administrator)'))
    .addSubcommand(s => s.setName('diagnoza').setDescription('Test audio YouTube z IP hostingu (administrator)')
      .addStringOption(o => o.setName('link').setDescription('Publiczny link do filmu YouTube (opcjonalnie)'))),
  new SlashCommandBuilder().setName('kolejka').setDescription('BOBER 4.0 — zarządzanie oczekującymi utworami')
    .addSubcommand(s => s.setName('usun').setDescription('Usuń utwór z kolejki (nie przerywa aktualnego)')
      .addIntegerOption(o => o.setName('numer').setDescription('Numer w /queue').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand(s => s.setName('przenies').setDescription('Przesuń utwór na inną pozycję')
      .addIntegerOption(o => o.setName('z').setDescription('Numer utworu').setMinValue(1).setMaxValue(100).setRequired(true))
      .addIntegerOption(o => o.setName('na').setDescription('Nowa pozycja').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand(s => s.setName('tasuj').setDescription('Losowo przetasuj oczekujące utwory'))
    .addSubcommand(s => s.setName('wyczysc').setDescription('Usuń oczekujące utwory, nie przerywaj bieżącego')),
  new SlashCommandBuilder().setName('powtorz').setDescription('BOBER 4.0 — powtarzanie utworów w sesji')
    .addStringOption(o => o.setName('tryb').setDescription('Wyłącz, powtarzaj utwór lub całą kolejkę')
      .addChoices({ name: 'Wyłączone', value: 'off' },
        { name: 'Jeden utwór', value: 'one' }, { name: 'Cała kolejka', value: 'all' })),
  new SlashCommandBuilder().setName('ulubione').setDescription('BOBER 4.0 — Twoje prywatne ulubione na tym serwerze')
    .addSubcommand(s => s.setName('dodaj').setDescription('Zapisz aktualnie odtwarzany utwór'))
    .addSubcommand(s => s.setName('lista').setDescription('Wyświetl swoje ulubione utwory'))
    .addSubcommand(s => s.setName('graj').setDescription('Dodaj ulubiony utwór do kolejki')
      .addIntegerOption(o => o.setName('numer').setDescription('Numer z /ulubione lista').setMinValue(1).setMaxValue(30).setRequired(true)))
    .addSubcommand(s => s.setName('usun').setDescription('Usuń utwór ze swoich ulubionych')
      .addIntegerOption(o => o.setName('numer').setDescription('Numer z /ulubione lista').setMinValue(1).setMaxValue(30).setRequired(true))),
  new SlashCommandBuilder().setName('status').setDescription('Stan dźwięku, FFmpeg i YouTube')
];
module.exports = { commands };
