'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { Readable, PassThrough, Transform } = require('node:stream');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const eventDelay = monitorEventLoopDelay({ resolution: 20 });
eventDelay.enable();
const audioBufferMs = (key, fallback) => Math.max(500, Math.min(10000, Number(process.env[key]) || fallback));
const path = require('node:path');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, StreamType, NoSubscriberBehavior,
  VoiceConnectionStatus, entersState,
} = require('@discordjs/voice');
const { listFiles, MUSIC_DIR, getFFmpegPath, getYtdlpPath, youtubeArgs, isYoutubeChallenge, classifyYoutubeFailure } = require('./media');
const effectsStore = require('./effects');
const queueTools = require('./queue-tools');
const TEST_OGG_FILE = path.join(MUSIC_DIR, 'test-dzwiek.ogg'); // diag-ogg-opus-v2.2

const sessions = new Map();
const lastGuildErrors = new Map();
const MAX_QUEUE = 100;
const IDLE_MINUTES = Math.max(2, Math.min(120, Number(process.env.IDLE_MINUTES || 20) || 20));
function cleanTitle(title) {
  return String(title || 'Utwór').replace(/[\n\r*`_~|]/g, ' ').slice(0, 130);
}
function scrubErrors(s) {
  return String(s || '').replace(/https?:\/\/\S+/g, '[URL]').slice(-450);
}

class MusicSession {
  constructor(guild, voiceChannel, textChannel) {
    this.guildId = guild.id;
    this.channelId = voiceChannel.id;
    this.textChannel = textChannel;
    this.queue = [];
    this.current = null;
    this.repeatMode = 'off'; // off | one | all, na czas bieżącej sesji
    this.skipRepeat = false;
    this.volume = 100;
    this.effects = effectsStore.read(guild.id);
    this.resource = null;
    this.ffmpegProcess = null;
    this.radioAbort = null;
    this.radioInput = null;
    this.audioBuffer = null;
    this.audioMeter = null;
    this.audioMonitor = null;
    this.ytProcess = null;
    this.closed = false;
    this.starting = false;
    this.idleTimer = null;
    this.startupTimer = null;
    this.autodj = false;
    this.alwaysOn = null;
    this.radio247Failures = 0;
    this.autodj247Failures = 0;
    this.radio247RetryAt = 0;
    this.retryTimer = null;
    this.autodjIndex = 0;
    this.lastError = null;
    this.failedCurrent = false;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id, guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator, selfDeaf: true,
    });
    this.connection.subscribe(this.player);

    this.connection.on('stateChange', (oldState, state) => {
      if (oldState.status !== state.status) console.log(`[VOICE ${this.guildId}] ${oldState.status} → ${state.status}`);
    });
    this.player.on('stateChange', (oldState, state) => {
      if (this.closed || oldState.status === state.status) return;
      console.log(`[AUDIO ${this.guildId}] ${oldState.status} → ${state.status}`);
      if (state.status === AudioPlayerStatus.Playing) {
        this.clearStartupTimer();
        // Reset backoff dopiero gdy odtwarzacz faktycznie zaczął przyjmować audio.
        if (this.current?.kind === 'file' && this.alwaysOn?.mode === 'autodj') {
          this.autodj247Failures = 0;
          this.radio247RetryAt = 0;
        }
        if (this.current?.kind === 'radio' && this.alwaysOn?.mode === 'radio') {
          this.radio247Failures = 0;
          this.radio247RetryAt = 0;
        }
        if (this.current) this.notify(`▶️ Odtwarzanie: **${cleanTitle(this.current.title)}**`);
      }
    });
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.closed) return;
      if (this.current?.kind === 'radio' && this.alwaysOn?.mode === 'radio' && !this.failedCurrent) {
        // Koniec/zamknięcie streamu; daj rozgłośni chwilę na ponowne połączenie.
        this.radio247RetryAt = Date.now() + 5000;
      }
      const finished = this.current, failed = this.failedCurrent, skipped = this.skipRepeat;
      this.cleanProcesses();
      this.current = null;
      this.resource = null;
      this.skipRepeat = false;
      queueTools.requeueFinished(this.queue, finished, this.repeatMode, {
        failed, skipped, continuous: Boolean(this.alwaysOn || this.autodj),
      });
      this.startNext();
    });
    this.player.on('error', e => {
      if (this.closed) return;
      this.failTrack(`Błąd odtwarzacza: ${e.message}`);
    });
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.closed) return;
      try {
        // Discord może ponawiać połączenie głosowe (np. zmiana regionu).
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 10_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 10_000),
          entersState(this.connection, VoiceConnectionStatus.Ready, 10_000),
        ]);
      } catch {
        this.lastError = 'Utracono połączenie głosowe Discord (sieć, uprawnienia lub szyfrowanie).';
        lastGuildErrors.set(this.guildId, this.lastError);
        this.notify('⚠️ Utracono połączenie głosowe. Sprawdź uprawnienia Connect/Speak i stan hostingu.');
        this.destroy();
      }
    });
    this.connection.on('error', e => {
      this.lastError = `Połączenie Discord: ${e.message}`;
      console.error(`[VOICE ${this.guildId}] ${this.lastError}`);
    });
  }
  notify(message) {
    this.textChannel?.send({ content: message, allowedMentions: { parse: [] } }).catch(() => {});
  }
  clearStartupTimer() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
  }
  cleanProcesses() {
    this.clearStartupTimer();
    if (this.audioMonitor) clearInterval(this.audioMonitor);
    this.audioMonitor = null;
    this.audioBuffer?.destroy();
    this.audioMeter?.destroy();
    this.audioMeter = null;
    this.audioBuffer = null;
    this.radioAbort?.abort();
    this.radioAbort = null;
    this.radioInput?.destroy();
    this.radioInput = null;
    for (const prop of ['ytProcess', 'ffmpegProcess']) {
      const p = this[prop];
      this[prop] = null;
      if (p && p.exitCode === null && !p.killed) p.kill();
    }
  }
  enqueue(track) {
    if (this.queue.length >= MAX_QUEUE) throw new Error(`Kolejka może mieć maksymalnie ${MAX_QUEUE} utworów.`);
    this.queue.push(track);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (!this.current && !this.starting) void this.startNext();
  }
  failTrack(message, track = this.current) {
    if (this.closed || !track || track !== this.current || this.failedCurrent) return;
    this.failedCurrent = true;
    if (track.kind === 'radio' && this.alwaysOn?.mode === 'radio') {
      this.radio247Failures++;
      this.radio247RetryAt = Date.now() + Math.min(300_000, 15_000 * Math.pow(2, Math.min(5, this.radio247Failures - 1)));
      console.warn(`[24/7 ${this.guildId}] Ponowienie za ${Math.ceil((this.radio247RetryAt - Date.now())/1000)} sekund.`);
    } else if (track.kind === 'file' && this.alwaysOn?.mode === 'autodj') {
      this.autodj247Failures++;
      this.radio247RetryAt = Date.now() + Math.min(120_000, 15_000 * this.autodj247Failures);
      console.warn(`[24/7 ${this.guildId}] Błąd pliku AutoDJ, spróbuję ponownie za chwilę.`);
    } else if (track.kind === 'radio' && (track.radioRetry || 0) < 2 && !/nie można uruchomić ffmpeg/i.test(message)) {
      const next = { ...track, radioRetry: (track.radioRetry || 0) + 1 };
      this.queue.unshift(next);
      console.warn(`[RADIO ${this.guildId}] Próba ponownego połączenia ${next.radioRetry}/2`);
    }
    this.lastError = scrubErrors(message);
    lastGuildErrors.set(this.guildId, this.lastError);
    console.error(`[AUDIO ${this.guildId}] ${this.lastError}`);
    this.notify(`⚠️ Nie udało się odtworzyć **${cleanTitle(track.title)}**. ${this.lastError} Sprawdź \`/status\`.`);
    this.cleanProcesses();
    if (!this.player.stop(true)) {
      this.current = null;
      this.resource = null;
      void this.startNext();
    }
  }
  async startNext() {
    if (this.closed || this.current || this.starting) return;
    this.starting = true;
    try {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      let track = this.queue.shift();
      if (!track && this.alwaysOn?.mode === 'radio') {
        const waitMs = this.radio247RetryAt - Date.now();
        if (waitMs > 0) {
          this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.startNext(); }, waitMs);
          this.retryTimer.unref?.();
          return;
        }
        track = { ...this.alwaysOn.track, radioRetry: 0 };
      }
      if (!track && (this.autodj || this.alwaysOn?.mode === 'autodj')) {
        if (this.alwaysOn?.mode === 'autodj' && this.radio247RetryAt > Date.now()) {
          this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.startNext(); }, this.radio247RetryAt - Date.now());
          this.retryTimer.unref?.();
          return;
        }
        const files = listFiles();
        if (files.length) {
          const filename = files[this.autodjIndex++ % files.length];
          track = { kind: 'file', source: filename, title: `🎵 ${filename} [AutoDJ]` };
        }
      }
      if (!track && this.alwaysOn?.mode === 'silent') {
        // Tryb czuwania — zostajemy na kanale bez otwierania FFmpeg ani strumienia audio.
        return;
      }
      if (!track && this.alwaysOn) {
        console.warn(`[24/7 ${this.guildId}] Brak plików music/ — kolejna próba za 60 sekund.`);
        this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.startNext(); }, 60_000);
        this.retryTimer.unref?.();
        return;
      }
      if (!track) {
        console.log(`[VOICE ${this.guildId}] Kolejka pusta; rozłączenie po ${IDLE_MINUTES} min bezczynności.`);
        this.idleTimer = setTimeout(() => this.destroy(), IDLE_MINUTES * 60_000);
        this.idleTimer.unref?.();
        return;
      }
      this.current = track;
      this.failedCurrent = false;
      this.notify(`⏳ Ładowanie: **${cleanTitle(track.title)}**`);
      try {
        // Nie wysyłamy audio zanim Discord nie potwierdzi gotowości połączenia.
        await entersState(this.connection, VoiceConnectionStatus.Ready, 25_000);
        if (this.closed || this.current !== track) return;
        try { this.beginPlayback(track); }
        catch (e) { this.failTrack(`Nie udało się utworzyć strumienia audio: ${e.message}`, track); }
      } catch (e) {
        this.failTrack(`Nie udało się połączyć z kanałem głosowym w 25 sekund (${e.message}).`, track);
      }
    } finally {
      this.starting = false;
      // Nie uruchamiaj w nieskończoność startNext przy pustej kolejce
      // ani podczas zaplanowanego opóźnienia (np. reconnect radia 24/7).
      if (!this.closed && !this.current && !this.retryTimer &&
          (this.queue.length > 0 || (this.alwaysOn && this.alwaysOn.mode !== 'silent'))) {
        setImmediate(() => {
          if (!this.closed && !this.current && !this.starting && !this.retryTimer) void this.startNext();
        });
      }
    }
  }
  beginPlayback(track) {
    if (track.kind === 'diagnostic') {
      if (!fs.existsSync(TEST_OGG_FILE)) throw new Error('Brakuje music/test-dzwiek.ogg — rozpakuj kompletną paczkę 2.2.');
      // Ogg/Opus: bez FFmpeg, yt-dlp i ponownego kodowania dźwięku.
      this.resource = createAudioResource(fs.createReadStream(TEST_OGG_FILE), {
        inputType: StreamType.OggOpus, metadata: track, inlineVolume: false,
      });
      this.player.play(this.resource);
      console.log(`[DIAG ${this.guildId}] test Ogg/Opus bez FFmpeg`);
      this.startupTimer = setTimeout(() => {
        if (this.current === track && this.player.state.status !== AudioPlayerStatus.Playing)
          this.failTrack('Test Opus nie rozpoczął odtwarzania. Sprawdź [VOICE]/[AUDIO] w konsoli.', track);
      }, 15000);
      this.startupTimer.unref?.();
      return;
    }
    const inputArgs = track.kind === 'file'
      ? ['-i', path.join(MUSIC_DIR, track.source)]
      : track.kind === 'radio'
        ? ['-protocol_whitelist', 'pipe', '-threads', '1', '-i', 'pipe:0']
        : track.kind === 'stream'
          ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2', '-rw_timeout', '15000000', '-i', track.source]
          : ['-i', 'pipe:0'];
    const filters = effectsStore.makeFilters(this.effects);
    const args = ['-nostdin', '-hide_banner', '-loglevel', track.kind === 'radio' ? 'warning' : 'error', ...inputArgs,
      '-vn', '-map', '0:a:0', '-ac', '2', '-ar', '48000',
      ...(filters.length ? ['-af', filters.join(',')] : []), '-f', 's16le', 'pipe:1'];
    if (track.kind === 'radio') console.log(`[RADIO FIX 4.2 ${this.guildId}] Start: ${cleanTitle(track.title)} | host: ${new URL(track.source).hostname}`);
    const executable = track.kind === 'radio' ? (process.env.RADIO_FFMPEG_PATH?.trim() || getFFmpegPath()) : getFFmpegPath();
    if (track.kind === 'radio') console.log(`[RADIO SAFE 4.2.1] FFmpeg: ${executable}`);
    const ff = spawn(executable, args, {
      stdio: [track.kind === 'youtube' || track.kind === 'radio' ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    this.ffmpegProcess = ff;
    let ffTail = '';
    ff.stderr.on('data', d => { ffTail = (ffTail + d.toString()).slice(-2000); if (track.kind === 'radio') console.warn(`[RADIO FFMPEG ${this.guildId}] ${scrubErrors(d.toString())}`); });
    let audioBytes = 0;
    const guild = this.guildId;
    const meter = new Transform({ transform(c, enc, cb) { if (!audioBytes && track.kind === 'radio') console.log(`[RADIO ${guild}] Pierwsze dane PCM: ${c.length} B`); audioBytes += c.length; cb(null,c); } });
    this.audioMeter = meter;
    ff.stdout.pipe(meter);
    ff.stdout.on('end', () => {
      if (this.closed || this.ffmpegProcess !== ff || ff.killed) return;
      if (audioBytes === 0 && track.kind !== 'radio') this.failTrack(`FFmpeg nie przesłał żadnych danych audio. ${scrubErrors(ffTail)}`, track);
    });
    ff.on('error', e => this.failTrack(`Nie można uruchomić FFmpeg (${e.code || e.message}). Sprawdź /status.`, track));
    ff.on('close', (code, signal) => {
      if (track.kind === 'radio') console.log(`[RADIO ${this.guildId}] FFmpeg exit=${code} signal=${signal || '-'} PCM=${audioBytes} B; ${scrubErrors(ffTail) || 'brak stderr'}`);
      if (this.closed || this.ffmpegProcess !== ff || ff.killed) return;
      if (track.kind === 'radio' && signal === 'SIGSEGV') console.error('[RADIO SAFE 4.2.1] Awaria natywna FFmpeg w dekoderze. Ustaw RADIO_FFMPEG_PATH na alternatywny działający plik FFmpeg, jeśli dostępny.');
      if (track.kind === 'radio' && audioBytes === 0) return this.failTrack(`FFmpeg radio: brak audio (exit=${code}, signal=${signal || '-'}). ${scrubErrors(ffTail) || 'Brak komunikatu FFmpeg.'}`, track);
      if (code !== 0) this.failTrack(`FFmpeg: ${scrubErrors(ffTail) || 'zakończono z kodem ' + code}`, track);
    });

    if (track.kind === 'radio') {
      const controller = new AbortController();
      this.radioAbort = controller;
      let inputBytes = 0;
      const active = () => !this.closed && this.current === track && this.ffmpegProcess === ff && !controller.signal.aborted;
      ff.stdin.on('error', e => {
        if (active() && e.code !== 'EPIPE') this.failTrack('Radio pipe: ' + e.message, track);
      });
      console.log('[RADIO PIPE 4.2.2] Node HTTP -> FFmpeg stdin');
      fetch(track.source, {
        signal: controller.signal, redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Icy-MetaData': '0', 'Accept-Encoding': 'identity' },
      }).then(response => {
        if (!active()) { void response.body?.cancel().catch(() => {}); return; }
        const type = response.headers.get('content-type') || '';
        console.log(`[RADIO HTTP ${this.guildId}] HTTP ${response.status}; typ=${type}; host=${new URL(response.url).hostname}`);
        if (!response.ok || !response.body || /text\/html|mpegurl|scpls|dash\+xml/i.test(type)) {
          void response.body?.cancel().catch(() => {});
          throw new Error('HTTP ' + response.status + '; typ=' + type + ' (wymagany bezpośredni strumień audio, nie strona ani playlista).');
        }
        const input = Readable.fromWeb(response.body);
        this.radioInput = input;
        input.on('error', e => { if (active()) this.failTrack('Radio HTTP: ' + e.message, track); });
        input.on('data', chunk => {
          if (!inputBytes) console.log(`[RADIO HTTP ${this.guildId}] Pierwsze dane wejściowe: ${chunk.length} B`);
          inputBytes += chunk.length;
        });
        input.pipe(ff.stdin);
      }).catch(e => { if (active()) this.failTrack('Radio HTTP: ' + scrubErrors(e.message), track); });
    }

    if (track.kind === 'youtube') {
      const yt = spawn(getYtdlpPath(), [
        ...youtubeArgs(track.youtubeClient || process.env.YOUTUBE_PLAYER_CLIENT || ''), '--retries', '1', '--fragment-retries', '1',
        '-f', process.env.YOUTUBE_FORMAT || 'bestaudio/best', '-o', '-', track.source,
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      this.ytProcess = yt;
      let ytTail = '';
      yt.stderr.on('data', d => { ytTail = (ytTail + d.toString()).slice(-1500); });
      let youtubeBytes = 0;
      yt.stdout.on('data', d => { youtubeBytes += d.length; });
      yt.stdout.on('end', () => {
        if (this.closed || this.ytProcess !== yt || yt.killed) return;
        if (youtubeBytes === 0) this.failTrack(classifyYoutubeFailure(ytTail).message, track);
      });
      yt.on('error', e => this.failTrack(`Nie można uruchomić yt-dlp (${e.code || e.message}).`, track));
      yt.on('close', code => {
        if (this.closed || this.ytProcess !== yt || yt.killed) return;
        if (code !== 0) this.failTrack(classifyYoutubeFailure(ytTail).message, track);
      });
      yt.stdout.pipe(ff.stdin);
      ff.stdin.on('error', () => {}); // EPIPE po pominięciu utworu jest normalny.
    }
    const buffered = track.kind === 'radio' || track.kind === 'youtube';
    const targetMs = track.kind === 'radio' ? audioBufferMs('RADIO_BUFFER_MS', 3000) : audioBufferMs('YOUTUBE_BUFFER_MS', 8000);
    const targetBytes = Math.ceil(targetMs * 192);
    const buffer = buffered ? new PassThrough({ highWaterMark: targetBytes + 65536 }) : null;
    if (buffer) {
      this.audioBuffer = buffer;
      buffer.on('error', e => { if (this.current === track && this.audioBuffer === buffer) this.failTrack('Audio buffer: ' + e.message, track); });
      meter.pipe(buffer);
    }
    const start = () => {
      if (this.closed || this.current !== track || this.ffmpegProcess !== ff) return;
      this.resource = createAudioResource(buffer || meter, {
        inputType: StreamType.Raw, inlineVolume: true, metadata: track,
      });
      this.resource.volume.setVolume(this.volume / 100);
      this.player.play(this.resource);
      if (buffer) {
        let low = 0;
        this.audioMonitor = setInterval(() => {
          if (this.current !== track || this.audioBuffer !== buffer) return;
          const ms = Math.round(buffer.readableLength / 192);
          if (ms < 100 && !buffer.writableEnded) low++;
          console.log(`[AUDIO STABILITY 4.3 ${this.guildId}] ${track.kind} | buffer=${ms}ms | low=${low} | ping=${this.connection.ping?.ws ?? '-'}ms | loopP99=${(eventDelay.percentile(99)/1e6).toFixed(1)}ms | RSS=${Math.round(process.memoryUsage().rss/1048576)}MB`);
        }, 10000);
        this.audioMonitor.unref?.();
      }
    };
    if (buffer) {
      let started = false;
      const maybeStart = () => {
        if (started || this.closed || this.current !== track || this.ffmpegProcess !== ff) return;
        if (buffer.readableLength < targetBytes && !buffer.writableEnded && !meter.readableEnded) return;
        if (!buffer.readableLength) return;
        started = true;
        buffer.removeListener('readable', maybeStart);
        buffer.removeListener('finish', maybeStart);
        console.log(`[AUDIO STABILITY 4.3] Start ${track.kind}; prebuffer=${Math.round(buffer.readableLength/192)}ms`);
        start();
      };
      buffer.on('readable', maybeStart);
      buffer.on('finish', maybeStart);
    } else start();
    this.startupTimer = setTimeout(() => {
      if (this.current === track && this.player.state.status !== AudioPlayerStatus.Playing)
        this.failTrack(track.kind === 'radio' ? `Radio: brak dźwięku przez 45 s. ${scrubErrors(ffTail) || 'Brak komunikatu FFmpeg.'}` : 'Nie pojawił się dźwięk w ciągu 45 sekund. Sprawdź FFmpeg, yt-dlp i dostęp YouTube.', track);
    }, 45_000);
    this.startupTimer.unref?.();
  }
  applyEffects(setting) {
    this.effects = effectsStore.save(this.guildId, setting);
    // Efekty FFmpeg są kompilowane przy starcie strumienia. Zmiana restartuje
    // aktywny utwór (radio wraca do transmisji na żywo), ale nie kończy sesji.
    const track = this.current;
    if (track && track.kind !== 'diagnostic') {
      this.queue.unshift({ ...track });
      this.skipRepeat = true;
      this.cleanProcesses();
      if (!this.player.stop(true)) {
        this.skipRepeat = false;
        this.current = null;
        this.resource = null;
        void this.startNext();
      }
      return true;
    }
    return false;
  }
  configure247(mode, radioTrack = null) {
    if (this.closed) throw new Error('Sesja jest zamknięta.');
    if (!['radio', 'autodj', 'silent'].includes(mode)) throw new Error('Nieznany tryb 24/7.');
    this.alwaysOn = { mode, track: radioTrack ? { ...radioTrack } : null };
    this.radio247Failures = 0;
    this.autodj247Failures = 0;
    this.radio247RetryAt = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (mode === 'silent') {
      this.autodj = false;
      this.queue = [];
      this.cleanProcesses();
      if (!this.player.stop(true)) {
        this.current = null;
        this.resource = null;
      }
      return;
    }
    if (mode === 'radio') {
      this.autodj = false;
      if (!this.current || this.current.kind !== 'radio' || this.current.source !== radioTrack.source) {
        this.replaceWith(radioTrack);
      }
    } else {
      this.autodj = true;
      if (this.current?.kind === 'radio') this.skip();
      else if (!this.current && !this.starting) void this.startNext();
    }
  }
  disable247() {
    if (this.alwaysOn?.mode === 'autodj') this.autodj = false;
    this.alwaysOn = null;
    this.radio247Failures = 0;
    this.autodj247Failures = 0;
    this.radio247RetryAt = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (!this.current && !this.starting) void this.startNext();
  }
  replaceWith(track) {
    if (this.closed) throw new Error('Sesja jest już zamknięta.');
    this.autodj = false;
    this.queue = [track];
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.current) this.skip();
    else if (!this.starting) void this.startNext();
  }
  stopRadio() {
    if (!this.current || this.current.kind !== 'radio') return false;
    this.queue = [];
    this.autodj = false;
    this.skip();
    return true;
  }
  skip() {
    if (!this.current) return false;
    this.skipRepeat = true;
    this.cleanProcesses();
    if (!this.player.stop(true)) {
      this.skipRepeat = false;
      this.current = null;
      this.resource = null;
      void this.startNext();
    }
    return true;
  }
  destroy() {
    if (this.closed) return;
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.cleanProcesses();
    this.queue = [];
    this.player.stop(true);
    this.connection.destroy();
    if (sessions.get(this.guildId) === this) sessions.delete(this.guildId);
  }
}
function getOrCreateSession(guild, voiceChannel, textChannel) {
  let session = sessions.get(guild.id);
  if (session?.closed) session = null;
  if (session && session.channelId !== voiceChannel.id) throw new Error('Bot gra już na innym kanale — dołącz do niego.');
  if (!session) {
    session = new MusicSession(guild, voiceChannel, textChannel);
    sessions.set(guild.id, session);
  }
  session.textChannel = textChannel;
  return session;
}
module.exports = { sessions, lastGuildErrors, getOrCreateSession, cleanTitle, MAX_QUEUE };
