'use strict';
require('dotenv').config();
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const {
  Client, GatewayIntentBits, Events, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { sessions, lastGuildErrors, getOrCreateSession, cleanTitle, MAX_QUEUE } = require('./player');
const { resolveTrack, restoreSaved, listFiles, getYtdlpPath, getFFmpegPath, ensureAudioTools, probeTool } = require('./media');
const playlists = require('./store');
const radios = require('./radios');
const alternatives = require('./alternatives');
const sources = require('./sources');
const always247 = require('./always247');
const effectsStore = require('./effects');
const { VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const token = process.env.DISCORD_TOKEN;
if (!token || token.startsWith('NOWY_TOKEN') || token.startsWith('WPISZ_')) {
  console.error('Brak prawdziwego DISCORD_TOKEN w .env — wymagany NOWY token po resecie.');
  process.exit(1);
}
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const ephemeral = { flags: MessageFlags.Ephemeral };
const help = [
  '**🎵 BOBER MUSIC BOT 3.0 SMART MUSIC & GITHUB**',
  '`/play source:<link YouTube / tytuł / radio / demo.wav>`',
  '`/search query:<tytuł>` — znajdź utwór na YouTube',
  '`/panel` — przyciski ⏸️ ▶️ ⏭️ ⏹️',
  '`/testaudio` — 12-sekundowy test dźwięku bez FFmpeg i YouTube',
  '`/pause` `/resume` `/skip` `/stop` `/volume`',
  '`/queue` `/nowplaying` `/files`',
  '`/playlist save|load|list|delete` — zapisane kolejki',
  '`/autodj mode:on|off` — zapętlenie plików w music/',
  '`/status` — narzędzia yt-dlp / FFmpeg',
  '`/radio list|play|panel|now|stop` — stacje radiowe',
  '`/radio add|remove` — zarządzanie stacjami (administrator)',
  '`/alternatywa add|remove|list` — legalne audio zastępcze dla linków Spotify/YouTube',
  '`/zrodla status` — sprawdź dostęp do Audius/Jamendo na hostingu',
  '`/zrodla szukaj query:...` — wyszukaj nagranie; `/zrodla graj numer:1` — wybierz wynik',
  '`/247 on mode:radio station:<nazwa>` — graj radio bez przerw',
  '`/247 on mode:autodj` — powtarzaj pliki music/ w pętli',
  '`/247 on mode:silent` — stale siedź na kanale, BEZ muzyki',
  '`/equalizer preset|custom|status|off` — ustaw korektor audio',
  '`/dj preset|status|off` — efekty Nightcore, Slowed, Echo, 8D, Club',
  '`/247 off` `/247 status` — wyłącz i sprawdź tryb',
  'Spotify: przypisane audio → lokalny MP3 → jednoznaczne źródło Audius/Jamendo. Jeśli nie ma zgodnego nagrania, wybierz /zrodla szukaj.',
  'YouTube może blokować pobieranie na hostingu (HTTP 403); nie używaj cookies konta.'
].join('\n');
function controls() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bm2:pause').setLabel('Pauza').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm2:resume').setLabel('Wznów').setEmoji('▶️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bm2:skip').setLabel('Pomiń').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bm2:stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
  )];
}
function radioPanel(guildId) {
  const stations = radios.list(guildId);
  if (!stations.length) return { content: '📻 Brak zapisanych stacji. Administrator może dodać pierwszą przez `/radio add name:... url:...`.', components: [] };
  const select = new StringSelectMenuBuilder().setCustomId('bm2:radio:choose')
    .setPlaceholder('Wybierz stację radiową…')
    .addOptions(stations.slice(0, 25).map(s => ({ label: s.name.slice(0, 100), description: s.genre.slice(0, 100), value: s.id })));
  const choose = new ActionRowBuilder().addComponents(select);
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bm2:radio:stop').setLabel('Zatrzymaj radio').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
  );
  return { content: `📻 **BOBER RADIO CENTER 2.4** — ${stations.length} stacji\nWybierz stację poniżej. Musisz być na kanale głosowym.`, components: [choose, actions] };
}
function adminOnly(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Dodawanie i usuwanie stacji wymaga uprawnienia Zarządzanie serwerem.');
}
async function playStation(interaction, station) {
  if (!station) throw new Error('Nie znaleziono tej stacji. Użyj `/radio list`.');
  const vc = await checkVoice(interaction);
  await ensureAudioTools('radio');
  const session = getOrCreateSession(interaction.guild, vc, interaction.channel);
  const saved247 = always247.read(interaction.guild.id);
  if (saved247 && saved247.mode !== 'silent') {
    session.configure247('radio', radios.toTrack(station));
    always247.save(interaction.guild.id, { mode: 'radio', channelId: vc.id,
      textChannelId: interaction.channel.id, stationId: station.id });
  } else session.replaceWith(radios.toTrack(station));
  return `📻 Przełączono radio na **${cleanTitle(station.name)}** (${station.genre}). Odtwarzanie może rozpocząć się po kilku sekundach.`;
}

function sameVoice(interaction, session) {
  return Boolean(session && interaction.member?.voice?.channelId === session.channelId);
}
async function checkVoice(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) throw new Error('Najpierw dołącz do kanału głosowego.');
  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
  if (!channel.permissionsFor(me)?.has(['Connect', 'Speak'])) throw new Error('Bot potrzebuje uprawnień Connect i Speak na kanale głosowym.');
  const old = sessions.get(interaction.guild.id);
  if (old && !old.closed && old.channelId !== channel.id) throw new Error('Bot jest już na innym kanale głosowym.');
  return channel;
}
async function execVersion(cmd, args) {
  return new Promise(resolve => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let value = '';
    const timer = setTimeout(() => { proc.kill(); resolve('brak odpowiedzi'); }, 7000);
    proc.stdout.on('data', d => { value = (value + d.toString()).slice(0, 260); });
    proc.on('error', () => { clearTimeout(timer); resolve('BRAK / nie można uruchomić'); });
    proc.on('close', code => { clearTimeout(timer); resolve(code === 0 ? (value.split('\n')[0] || 'OK') : 'błąd uruchamiania'); });
  });
}
async function executeControl(interaction, action) {
  const session = sessions.get(interaction.guild.id);
  if (!session) throw new Error('Nic nie gra. Użyj `/play`.');
  if (!sameVoice(interaction, session)) throw new Error('Musisz być na kanale głosowym, na którym gra bot.');
  if (action === 'pause') return session.player.pause() ? '⏸️ Pauza.' : 'Nie można wstrzymać.';
  if (action === 'resume') return session.player.unpause() ? '▶️ Wznowiono.' : 'Nie można wznowić.';
  if (action === 'skip') return session.skip() ? '⏭️ Pominięto.' : 'Nie ma utworu do pominięcia.';
  if (action === 'stop') { always247.remove(interaction.guild.id); session.destroy(); return '⏹️ Zatrzymano, wyłączono 24/7 i rozłączono bota.'; }
  throw new Error('Nieznana akcja.');
}
const recovering247 = new Set();
async function ensure247Running(saved) {
  const id = saved.guildId;
  if (recovering247.has(id)) return;
  recovering247.add(id);
  try {
    // Jeśli /247 off podczas próby, nie przywracaj starego trybu.
    const latest = always247.read(id);
    if (!latest) return;
    const guild = client.guilds.cache.get(id) || await client.guilds.fetch(id);
    const vc = guild.channels.cache.get(latest.channelId) || await guild.channels.fetch(latest.channelId);
    if (!vc || !vc.isVoiceBased()) throw new Error('Zapisany kanał głosowy już nie istnieje.');
    const me = guild.members.me || await guild.members.fetchMe();
    if (!vc.permissionsFor(me)?.has(['Connect', 'Speak'])) throw new Error('Brak uprawnień Connect/Speak.');
    const text = guild.channels.cache.get(latest.textChannelId) || await guild.channels.fetch(latest.textChannelId);
    const radio = latest.mode === 'radio' ? radios.find(id, latest.stationId) : null;
    if (latest.mode === 'radio' && !radio) throw new Error('Zapisana stacja radiowa została usunięta.');
    if (latest.mode === 'autodj' && !listFiles().length) throw new Error('Brak plików w music/.');
    if (latest.mode !== 'silent') await ensureAudioTools(latest.mode === 'radio' ? 'radio' : 'file');
    // Skonfiguruj tylko aktualnie zapisany tryb.
    const updated = always247.read(id);
    if (!updated || JSON.stringify(updated) !== JSON.stringify(latest)) return;
    let session = sessions.get(id);
    if (session && (session.closed || session.channelId !== vc.id ||
        session.connection.state.status === VoiceConnectionStatus.Destroyed)) {
      session.destroy(); session = null;
    }
    session = session || getOrCreateSession(guild, vc, text);
    session.textChannel = text;
    const track = radio ? radios.toTrack(radio) : null;
    if (!session.alwaysOn || session.alwaysOn.mode !== latest.mode ||
        (track && session.alwaysOn.track?.stationId !== track.stationId)) {
      session.configure247(latest.mode, track);
      console.log(`[24/7 ${id}] Przywrócono ${latest.mode} na kanale ${vc.id}.`);
    } else if (!session.current && !session.starting) void session.startNext();
  } catch (e) {
    console.warn(`[24/7 ${id}] Nie udało się przywrócić, następna próba później: ${e.message}`);
  } finally { recovering247.delete(id); }
}
function check247() {
  for (const saved of always247.list()) void ensure247Running(saved);
}
client.once(Events.ClientReady, c => {
  console.log(`✅ BOBER MUSIC BOT 3.0 SMART MUSIC & GITHUB online: ${c.user.tag}`);
  setTimeout(check247, 1500).unref?.();
  setInterval(check247, 60_000).unref?.();
});
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isAutocomplete()) {
    if (!['radio', '247'].includes(interaction.commandName) || !interaction.guildId) return;
    const value = String(interaction.options.getFocused() || '').toLocaleLowerCase('pl');
    const matching = radios.list(interaction.guildId)
      .filter(station => station.name.toLocaleLowerCase('pl').includes(value))
      .slice(0, 25).map(station => ({ name: station.name.slice(0, 100), value: station.id }));
    return interaction.respond(matching).catch(() => {});
  }
  if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;
  try {
    if (!interaction.guild) return interaction.reply({ content: 'Tylko na serwerze Discord.', ...ephemeral });
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== 'bm2:radio:choose') return;
      await interaction.deferReply(ephemeral);
      const station = radios.find(interaction.guild.id, interaction.values[0]);
      return interaction.editReply({ content: await playStation(interaction, station), allowedMentions: { parse: [] } });
    }
    if (interaction.isButton() && interaction.customId === 'bm2:radio:stop') {
      const s = sessions.get(interaction.guild.id);
      if (!sameVoice(interaction, s)) throw new Error('Dołącz do tego samego kanału głosowego co bot.');
      if (always247.read(interaction.guild.id)?.mode === 'radio') { always247.remove(interaction.guild.id); s.disable247(); }
      return interaction.reply({ content: s.stopRadio() ? '⏹️ Radio i tryb 24/7 zatrzymane. Bot zostaje na kanale.' : 'Aktualnie radio nie gra.', ...ephemeral });
    }
    if (interaction.isButton()) {
      if (!interaction.customId.startsWith('bm2:')) return;
      return interaction.reply({ content: await executeControl(interaction, interaction.customId.slice(4)), ...ephemeral });
    }
    const name = interaction.commandName;
    if (name === 'zrodla') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'status') {
        await interaction.deferReply(ephemeral);
        const results = await sources.checkProviders();
        const lines = results.map(r => r.status === 'ok'
          ? `✅ ${r.provider}: API odpowiada (${r.results} dostępnych wyników testowych)`
          : r.status === 'disabled'
            ? `⚪ ${r.provider}: nieaktywne — ${r.message}`
            : `❌ ${r.provider}: ${r.message}`);
        return interaction.editReply({ content: '🎼 **Test katalogów muzycznych z hostingu:**\n' + lines.join('\n') + '\nTo test API, a nie gwarancja strumieniowania każdego utworu.' });
      }
      if (sub === 'szukaj') {
        const query = interaction.options.getString('query', true);
        await interaction.deferReply(ephemeral);
        const { results, errors } = await sources.searchCatalog(query);
        const shown = sources.saveResults(interaction.guild.id, interaction.user.id, results);
        const lines = shown.map((s, i) => `${i+1}. **${cleanTitle(s.artist)} — ${cleanTitle(s.title)}** (${s.provider})`).join('\n');
        const notice = errors.length ? `\n⚠️ Część API nie odpowiedziała: ${errors.slice(0,2).map(cleanTitle).join(', ')}` : '';
        return interaction.editReply({ content: (`🎼 **Źródła audio — wynik wyszukiwania**\n${lines || 'Nie znaleziono dostępnych nagrań.'}\n\nAby wybrać nagranie, użyj \`/zrodla graj numer:1\` (numery 1–8). Sprawdź wykonawcę i wersję utworu; katalog może zawierać remiksy. ${notice}`).slice(0,1900), allowedMentions: {parse:[]} });
      }
      const vc = await checkVoice(interaction);
      const track = sources.selectResult(interaction.guild.id, interaction.user.id, interaction.options.getInteger('numer', true));
      await interaction.deferReply();
      await ensureAudioTools('stream');
      const session = getOrCreateSession(interaction.guild, vc, interaction.channel);
      session.enqueue(track);
      return interaction.editReply({ content: `▶️ Dodano: **${cleanTitle(track.title)}**\nŹródło: **${track.provider}**\nAutor: ${cleanTitle(track.attribution)}\nStrona utworu: ${track.page}`, allowedMentions: {parse:[]} });
    }
    if (name === 'alternatywa') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'list') {
        const entries = alternatives.list(interaction.guild.id);
        const text = entries.length ? entries.slice(0, 15).map((a, i) => `${i + 1}. **${cleanTitle(a.original)}** → ${cleanTitle(a.audio)}`).join('\n') + (entries.length > 15 ? `\n…i ${entries.length - 15} kolejnych` : '') : 'Nie zapisano alternatywnych źródeł. Użyj /alternatywa add (administrator).';
        return interaction.reply({ content: ('🎼 **Alternatywne audio:**\n' + text).slice(0, 1900), ...ephemeral, allowedMentions: { parse: [] } });
      }
      adminOnly(interaction);
      const source = interaction.options.getString('source', true);
      if (sub === 'add') {
        const audio = interaction.options.getString('audio', true);
        const result = alternatives.add(interaction.guild.id, source, audio);
        return interaction.reply({ content: `✅ Dodano alternatywne audio: **${cleanTitle(result.original)}** → **${cleanTitle(result.audio)}**. Od teraz /play z tym linkiem nie wymaga YouTube.`, ...ephemeral, allowedMentions: { parse: [] } });
      }
      alternatives.remove(interaction.guild.id, source);
      return interaction.reply({ content: '🗑️ Usunięto alternatywne źródło.', ...ephemeral });
    }
    if (name === 'radio') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'list') {
        const entries = radios.list(interaction.guild.id);
        return interaction.reply({ content: entries.length
          ? '📻 **Dostępne radia:**\n' + entries.map((r,i) => `${i+1}. **${cleanTitle(r.name)}** — ${cleanTitle(r.genre)}`).join('\n')
          : 'Nie ma jeszcze stacji. Administrator może dodać pierwszą komendą `/radio add`.', ...ephemeral, allowedMentions: {parse: []} });
      }
      if (sub === 'add') {
        adminOnly(interaction);
        const r = radios.add(interaction.guild.id, interaction.options.getString('name', true),
          interaction.options.getString('url', true), interaction.options.getString('genre') || 'Różne');
        return interaction.reply({ content: `✅ Zapisano stację **${cleanTitle(r.name)}**. Odtwórz ją przez /radio play albo /radio panel.`, ...ephemeral, allowedMentions: { parse: [] } });
      }
      if (sub === 'remove') {
        adminOnly(interaction);
        const selected = radios.find(interaction.guild.id, interaction.options.getString('station', true));
        const keep = always247.read(interaction.guild.id);
        if (keep?.mode === 'radio' && keep.stationId === selected?.id) throw new Error('Ta stacja gra w trybie 24/7. Użyj /247 off przed jej usunięciem.');
        const r = radios.remove(interaction.guild.id, interaction.options.getString('station', true));
        return interaction.reply({ content: `🗑️ Usunięto **${cleanTitle(r.name)}**.`, ...ephemeral });
      }
      if (sub === 'panel') return interaction.reply({ ...radioPanel(interaction.guild.id), allowedMentions: { parse: [] } });
      if (sub === 'now') {
        const s = sessions.get(interaction.guild.id);
        return interaction.reply({ content: s?.current?.kind === 'radio'
          ? `📻 Teraz gra: **${cleanTitle(s.current.title)}**` : 'Obecnie nie jest odtwarzana stacja radiowa.', ...ephemeral });
      }
      if (sub === 'stop') {
        const s = sessions.get(interaction.guild.id);
        if (!sameVoice(interaction, s)) throw new Error('Musisz być na kanale głosowym bota.');
        if (always247.read(interaction.guild.id)?.mode === 'radio') { always247.remove(interaction.guild.id); s.disable247(); }
        return interaction.reply({ content: s.stopRadio() ? '⏹️ Radio i tryb 24/7 zatrzymane. Bot pozostaje na kanale.' : 'Radio nie jest aktywne.', ...ephemeral });
      }
      if (sub === 'play') {
        await interaction.deferReply();
        const station = radios.find(interaction.guild.id, interaction.options.getString('station', true));
        return interaction.editReply({ content: await playStation(interaction, station), allowedMentions: { parse: [] } });
      }
    }
    if (name === '247') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'status') {
        const conf = always247.read(interaction.guild.id);
        const live = sessions.get(interaction.guild.id);
        const st = conf?.mode === 'radio' ? radios.find(interaction.guild.id, conf.stationId) : null;
        return interaction.reply({ content: conf
          ? `📻 **24/7 WŁĄCZONE** — ${conf.mode === 'silent' ? 'Ciche czuwanie (bez muzyki)' : conf.mode === 'radio' ? 'Radio: ' + cleanTitle(st?.name || 'brak stacji') : 'AutoDJ music/'}\nKanał: <#${conf.channelId}>\nPołączenie: ${live?.connection?.state?.status || 'oczekiwanie na ponowienie'}\nOdtwarzacz: ${live?.player?.state?.status || 'nieaktywny'}`
          : '📻 Tryb 24/7 jest wyłączony. Włącz przez `/247 on`.', ...ephemeral });
      }
      adminOnly(interaction);
      if (sub === 'off') {
        const removed = always247.remove(interaction.guild.id);
        sessions.get(interaction.guild.id)?.disable247();
        return interaction.reply({ content: removed ? '⏹️ Tryb 24/7 WYŁĄCZONY. Aktualne radio może dalej grać do końca połączenia; /stop rozłącza bota.' : 'Tryb 24/7 był już wyłączony.', ...ephemeral });
      }
      if (sub === 'on') {
        const vc = await checkVoice(interaction);
        const mode = interaction.options.getString('mode', true);
        const rawStation = interaction.options.getString('station');
        const chosen = mode === 'radio' ? (rawStation
          ? radios.find(interaction.guild.id, rawStation)
          : radios.list(interaction.guild.id)[0]) : null;
        if (mode === 'radio' && !chosen) throw new Error('Najpierw dodaj radio przez `/radio add`, a potem wybierz je w `/247 on`.');
        if (mode === 'autodj' && !listFiles().length) throw new Error('Brak muzyki w music/ — prześlij MP3/WAV albo wybierz radio.');
        await interaction.deferReply(ephemeral);
        if (mode !== 'silent') await ensureAudioTools(mode === 'radio' ? 'radio' : 'file');
        const session = getOrCreateSession(interaction.guild, vc, interaction.channel);
        if (mode === 'silent') {
          try { await entersState(session.connection, VoiceConnectionStatus.Ready, 25_000); }
          catch (e) { session.destroy(); throw new Error('Discord nie potwierdził połączenia głosowego (25 s). Sprawdź uprawnienia Connect/Speak.'); }
        }
        session.configure247(mode, chosen ? radios.toTrack(chosen) : null);
        always247.save(interaction.guild.id, { mode, channelId: vc.id,
          textChannelId: interaction.channel.id, stationId: chosen?.id });
        return interaction.editReply({ content: `✅ Tryb **24/7 WŁĄCZONY**! ${mode === 'silent' ? 'Ciche czuwanie: bot jest na kanale, ale NIC nie odtwarza' : mode === 'radio' ? 'Radio: **' + cleanTitle(chosen.name) + '**' : 'AutoDJ: pętla music/'}\nBot będzie próbował odtworzyć sesję po restarcie procesu. Hosting musi działać.` });
      }
    }
    if (name === 'equalizer' || name === 'dj') {
      const sub = interaction.options.getSubcommand();
      const old = effectsStore.read(interaction.guild.id);
      if (sub === 'status') {
        return interaction.reply({ content: `🎛️ **Equalizer:** ${old.eqPreset} | Bass ${old.bass} dB, Mid ${old.mid} dB, Treble ${old.treble} dB\n🎧 **DJ:** ${old.dj}`, ...ephemeral });
      }
      // Aktywny odtwarzacz mogą modyfikować tylko osoby z kanału bota.
      // Bez sesji: administrator może przygotować ustawienia przed odtworzeniem.
      const s = sessions.get(interaction.guild.id);
      if (s && !sameVoice(interaction, s)) throw new Error('Dołącz do kanału głosowego bota, aby zmieniać efekty.');
      if (!s) adminOnly(interaction);
      let next;
      if (name === 'equalizer') {
        if (sub === 'off') next = effectsStore.setPreset(old, 'flat');
        else if (sub === 'preset') next = effectsStore.setPreset(old, interaction.options.getString('name', true));
        else if (sub === 'custom') next = effectsStore.setCustom(old,
          interaction.options.getInteger('bass', true), interaction.options.getInteger('mid', true), interaction.options.getInteger('treble', true));
      } else {
        if (sub === 'off') next = effectsStore.setDJ(old, 'off');
        else if (sub === 'preset') next = effectsStore.setDJ(old, interaction.options.getString('name', true));
      }
      if (!next) throw new Error('Nieznana konfiguracja efektów.');
      const restarted = s ? s.applyEffects(next) : (effectsStore.save(interaction.guild.id, next), false);
      return interaction.reply({ content: `✅ ${name === 'dj' ? 'DJ' : 'Equalizer'} ustawiony. EQ: **${next.eqPreset}** (${next.bass}/${next.mid}/${next.treble} dB), DJ: **${next.dj}**. ${restarted ? 'Bieżący utwór jest uruchamiany od nowa z nowym efektem.' : 'Ustawienie zacznie obowiązywać przy następnym odtwarzaniu.'}`, ...ephemeral });
    }
    if (name === 'help') return interaction.reply({ content: help, ...ephemeral });
    if (name === 'status') {
      await interaction.deferReply(ephemeral);
      const [yt, ff] = await Promise.all([probeTool(getYtdlpPath(), ['--version']), probeTool(getFFmpegPath(), ['-version'])]);
      const s = sessions.get(interaction.guild.id);
      const lines = [
        '🛠️ **BOBER MUSIC BOT 3.0 — Diagnostyka audio, radia, DJ i 24/7**',
        `Wersja uruchomiona: **${require('../package.json').version}**`,
        `Przypisane źródła alternatywne: **${alternatives.list(interaction.guild.id).length}**`,
        `Katalogi: Audius ${process.env.AUDIUS_ENABLED==='0'?'wyłączony':'włączony'}; Jamendo ${process.env.JAMENDO_CLIENT_ID?'skonfigurowany':'wymaga Client ID'}`,
        `FFmpeg: **${ff.ok ? '✅' : '❌'}** \`${ff.message.slice(0, 110)}\``,
        `yt-dlp: **${yt.ok ? '✅' : '❌'}** \`${yt.message.slice(0, 110)}\``,
        `Node: \`${process.version}\``,
        `Tryb 24/7: **${always247.read(interaction.guild.id)?.mode || 'wyłączony'}**`,
        `Equalizer: **${effectsStore.read(interaction.guild.id).eqPreset}**`,
        `DJ: **${effectsStore.read(interaction.guild.id).dj}**`,
        `Discord Voice: \`${s?.connection.state.status || 'nie połączono'}\``,
        `Odtwarzacz: \`${s?.player.state.status || 'nieaktywny'}\``,
        `Odtworzone (ms): ${s?.resource?.playbackDuration || 0}`,
        `Teraz gra: ${s?.current ? '**' + cleanTitle(s.current.title) + '**' : 'nic'}`,
        `Ostatni błąd audio: ${s?.lastError || lastGuildErrors.get(interaction.guild.id) || 'brak'}`,
        !ff.ok ? '⚠️ Hosting blokuje skrypt instalacji ffmpeg-static albo FFmpeg nie istnieje. Sprawdź log npm.' : '',
        !yt.ok ? '⚠️ Bez yt-dlp działają tylko MP3/WAV i radio.' : '',
      ];
      return interaction.editReply({ content: lines.filter(Boolean).join('\n').slice(0, 1900), allowedMentions: {parse: []} });
    }
    if (name === 'files') {
      const files = listFiles();
      return interaction.reply({ content: files.length ? `🎵 music/: ${files.slice(0, 35).map(s => '`' + s + '`').join(', ')}` : 'Folder music/ jest pusty.', ...ephemeral });
    }
    if (name === 'testaudio') {
      const vc = await checkVoice(interaction);
      await interaction.deferReply();
      const session = getOrCreateSession(interaction.guild, vc, interaction.channel);
      session.enqueue({ kind: 'diagnostic', source: 'test-dzwiek.ogg', title: 'TEST AUDIO 3.0 (12 sekund)' });
      return interaction.editReply({ content: '🔊 Test OGG/Opus dodany do odtwarzania! Bez FFmpeg i YouTube. Jeżeli nie słychać sygnału, sprawdź głośność bota w Discordzie oraz logi [VOICE] i [AUDIO] w konsoli.' });
    }
    if (name === 'play' || name === 'search') {
      const vc = await checkVoice(interaction);
      const input = name === 'play' ? interaction.options.getString('source', true) : interaction.options.getString('query', true);
      await interaction.deferReply();
      const track = await resolveTrack(input, { guildId: interaction.guild.id });
      await ensureAudioTools(track.kind);
      const session = getOrCreateSession(interaction.guild, vc, interaction.channel);
      session.enqueue(track);
      return interaction.editReply({ content: `✅ Dodano do kolejki: **${cleanTitle(track.title)}**\nŹródło: ${track.kind === 'youtube' ? 'YouTube' : track.kind === 'radio' ? 'Radio / audio URL' : track.kind === 'stream' ? track.provider + ' (strumień)' : 'Plik lokalny'}${track.attribution ? '\nAutor: ' + cleanTitle(track.attribution) + '\nWięcej: ' + track.page : ''}`, allowedMentions: { parse: [] } });
    }
    if (name === 'panel') {
      const session = sessions.get(interaction.guild.id);
      if (!session) return interaction.reply({ content: 'Najpierw użyj `/play`.', ...ephemeral });
      return interaction.reply({ content: `🎚️ **Panel muzyczny**\n▶️ Teraz: **${cleanTitle(session.current?.title || 'cisza')}**\n🎼 Oczekuje: ${session.queue.length}`, components: controls(), allowedMentions: { parse: [] } });
    }
    if (name === 'playlist') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'list') {
        const entries = playlists.list(interaction.guild.id);
        return interaction.reply({ content: entries.length ? entries.map(p => `🎼 **${p.name}** — ${p.count} utworów`).join('\n') : 'Nie ma zapisanych playlist.', ...ephemeral, allowedMentions: { parse: [] } });
      }
      const label = interaction.options.getString('name', true);
      const session = sessions.get(interaction.guild.id);
      if (sub === 'save') {
        if (!sameVoice(interaction, session)) throw new Error('Musisz być na kanale głosowym z botem.');
        const currentAndQueue = [...(session.current ? [session.current] : []), ...session.queue];
        const count = playlists.save(interaction.guild.id, label, currentAndQueue);
        return interaction.reply({ content: `💾 Zapisano playlistę „${playlists.normalizeName(label)}” (${count} utworów).`, ...ephemeral, allowedMentions: { parse: [] } });
      }
      if (sub === 'delete') {
        if (!interaction.memberPermissions?.has('ManageGuild')) throw new Error('Usuwanie playlist: wymagane Zarządzanie serwerem.');
        playlists.remove(interaction.guild.id, label);
        return interaction.reply({ content: `🗑️ Usunięto playlistę „${playlists.normalizeName(label)}”.`, ...ephemeral });
      }
      if (sub === 'load') {
        const vc = await checkVoice(interaction);
        const items = playlists.load(interaction.guild.id, label).map(restoreSaved);
        for (const kind of new Set(items.map(t => t.kind))) await ensureAudioTools(kind);
        const s = getOrCreateSession(interaction.guild, vc, interaction.channel);
        if (s.queue.length + items.length > MAX_QUEUE) throw new Error('Nie ma miejsca w kolejce (limit 100).');
        for (const t of items) s.enqueue(t);
        return interaction.reply({ content: `✅ Dodano playlistę „${playlists.normalizeName(label)}” (${items.length} utworów).`, allowedMentions: { parse: [] } });
      }
    }
    if (name === 'autodj') {
      const vc = await checkVoice(interaction);
      const enabled = interaction.options.getString('mode', true) === 'on';
      if (enabled && !listFiles().length) throw new Error('Brak plików w music/ — dodaj pliki, zanim włączysz AutoDJ.');
      if (enabled) await ensureAudioTools('file');
      const s = enabled ? getOrCreateSession(interaction.guild, vc, interaction.channel) : sessions.get(interaction.guild.id);
      if (!s) return interaction.reply({ content: 'AutoDJ jest już wyłączony.', ...ephemeral });
      if (!enabled && always247.read(interaction.guild.id)?.mode === 'autodj') {
        always247.remove(interaction.guild.id); s.disable247();
      }
      s.autodj = enabled;
      if (s.autodj && !s.current) s.startNext();
      return interaction.reply({ content: s.autodj ? '📻 AutoDJ włączony — odtwarzanie plików music/ w pętli.' : '⏹️ AutoDJ wyłączony.', ...ephemeral });
    }
    if (name === 'queue' || name === 'nowplaying') {
      const s = sessions.get(interaction.guild.id);
      if (!s) return interaction.reply({ content: 'Teraz nic nie gra.', ...ephemeral });
      if (name === 'nowplaying') return interaction.reply({ content: s.current ? `▶️ **${cleanTitle(s.current.title)}**` : 'Nic nie gra.', allowedMentions: { parse: [] } });
      const rows = s.queue.slice(0, 12).map((t, i) => `${i + 1}. ${cleanTitle(t.title)}`).join('\n');
      return interaction.reply({ content: `▶️ **${cleanTitle(s.current?.title || 'cisza')}**\n${rows || 'Brak kolejnych utworów.'}${s.queue.length > 12 ? `\n… i ${s.queue.length - 12} więcej` : ''}`.slice(0, 1950), allowedMentions: { parse: [] } });
    }
    if (name === 'pause' || name === 'resume' || name === 'skip' || name === 'stop') return interaction.reply(await executeControl(interaction, name));
    if (name === 'volume') {
      const s = sessions.get(interaction.guild.id);
      if (!sameVoice(interaction, s)) throw new Error('Dołącz do kanału głosowego bota.');
      const v = interaction.options.getInteger('level', true);
      s.volume = v;
      if (s.resource?.volume) s.resource.volume.setVolume(v / 100);
      return interaction.reply(`🔉 Głośność: ${v}%`);
    }
  } catch (error) {
    console.error('Interakcja:', error.message);
    const response = { content: '❌ ' + String(error.message || 'Błąd').slice(0, 350), ...ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: response.content }).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  for (const s of sessions.values()) s.destroy();
  client.destroy(); process.exit(0);
});
client.login(token).catch(e => { console.error('Nie można zalogować bota:', e.message); process.exitCode = 1; });
