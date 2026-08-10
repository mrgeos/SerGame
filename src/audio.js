/* Звук целиком синтезируется в браузере — никаких файлов.
 * Гитара, прыжки, удары и качающий чиптюн-панк на фоне.
 *
 * iOS не даёт запустить звук без касания, поэтому init() зовётся
 * из первого тапа (см. menu.js).
 */
window.SG = window.SG || {};

SG.Audio = (function () {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var dist = null;
  var muted = false;
  var timer = null, step = 0, nextTime = 0, tempo = 168, track = 'run';
  var ready = false;

  try { muted = localStorage.getItem('sg_muted') === '1'; } catch (e) {}

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function distCurve(amount) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return curve;
  }

  /* Айфон с включённым бесшумным режимом глушит WebAudio: страница по
   * умолчанию сидит в «звонковой» аудиосессии, которую рубит переключатель
   * на боку. Стоит начать проигрывать обычный <audio>, и сессия становится
   * «медийной» — тогда звук идёт даже при выключенном звонке. Гоняем по
   * кругу секунду тишины, слышно её быть не может.
   */
  var silent = null;

  function unmuteSwitch() {
    if (silent) { silent.play().catch(function () {}); return; }
    try {
      var sr = 8000, n = sr;                       // секунда 8-битной тишины
      var b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
      function s(o, t) { for (var i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); }
      s(0, 'RIFF'); dv.setUint32(4, 36 + n, true); s(8, 'WAVEfmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr, true);
      dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
      s(36, 'data'); dv.setUint32(40, n, true);
      b.fill(128, 44);                             // 128 — ноль для 8 бит без знака

      silent = document.createElement('audio');
      silent.loop = true;
      silent.playsInline = true;
      silent.setAttribute('playsinline', '');
      silent.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
      silent.style.display = 'none';
      document.body.appendChild(silent);       // оторванный от страницы iOS не жалует
      silent.play().catch(function () {});
    } catch (e) { silent = null; }
  }

  function init() {
    unmuteSwitch();
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);

      musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);
      sfxGain   = ctx.createGain(); sfxGain.gain.value   = 0.9;  sfxGain.connect(master);

      dist = ctx.createWaveShaper();
      dist.curve = distCurve(28);
      dist.oversample = '2x';
      dist.connect(sfxGain);

      buildBand();
      ready = true;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ready = false; }
  }

  /* ---- «состав» под песню ----------------------------------------------
   *
   * Ритм-гитара звучит через перегруз общим узлом, а не по ноте: живой
   * перегруз тем и отличается, что аккорд в нём перемалывается целиком, и
   * именно от этого получается гитарный рык, а не три отдельные пилы.
   * За перегрузом фильтр — без него пила режет уши.
   */
  var band = null;

  function bus(drive, cut, vol) {
    var head, tail;
    if (drive) {
      head = ctx.createWaveShaper();
      head.curve = distCurve(drive);
      head.oversample = '2x';
    }
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cut;
    var g = ctx.createGain();
    g.gain.value = vol;
    if (head) head.connect(f); else head = f;
    f.connect(g);
    g.connect(musicGain);
    tail = head;
    return tail;
  }

  function buildBand() {
    band = {
      rhythm: bus(9, 2600, 0.5),      // ритм-гитара: перегруз погрязнее
      lead:   bus(4, 4400, 0.6),      // соло и вокальная мелодия: помягче
      bass:   bus(2, 900, 0.8),       // бас: почти чистый, но с телом
      drums:  bus(0, 12000, 0.9)
    };
  }

  /* ---- примитивы ------------------------------------------------------ */

  function tone(opts) {
    if (!ready) return;
    var t = ctx.currentTime + (opts.at || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + opts.dur);
    if (opts.detune) o.detune.value = opts.detune;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.2, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

    o.connect(g);
    g.connect(opts.through || sfxGain);
    o.start(t);
    o.stop(t + opts.dur + 0.02);
  }

  function noise(opts) {
    if (!ready) return;
    var t = ctx.currentTime + (opts.at || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * opts.dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.freq || 1800;
    var g = ctx.createGain(); g.gain.value = opts.vol || 0.2;
    src.connect(f); f.connect(g); g.connect(opts.through || sfxGain);
    src.start(t);
  }

  /* ---- эффекты --------------------------------------------------------- */

  var CHORDS = [
    [40, 47, 52],  // E5
    [45, 52, 57],  // A5
    [43, 50, 55],  // G5
    [38, 45, 50]   // D5
  ];
  var chordIdx = 0;

  function chord() {                       // удар по струнам
    if (!ready) return;
    var c = CHORDS[chordIdx++ % CHORDS.length];
    for (var i = 0; i < c.length; i++) {
      tone({ freq: hz(c[i]), type: 'sawtooth', dur: 0.42, vol: 0.22,
             at: i * 0.012, detune: (i - 1) * 7, through: dist });
      tone({ freq: hz(c[i] + 12), type: 'square', dur: 0.28, vol: 0.07,
             at: i * 0.012, through: dist });
    }
    noise({ dur: 0.05, freq: 3800, vol: 0.12 });
  }

  var SFX = {
    jump:    function () { tone({ freq: 300, slideTo: 720, type: 'square', dur: 0.13, vol: 0.18 }); },
    djump:   function () { tone({ freq: 520, slideTo: 980, type: 'square', dur: 0.12, vol: 0.16 });
                           tone({ freq: 780, type: 'triangle', dur: 0.1, vol: 0.1, at: 0.03 }); },
    kill:    function () { noise({ dur: 0.22, freq: 900, vol: 0.28, filter: 'lowpass' });
                           tone({ freq: 220, slideTo: 70, type: 'sawtooth', dur: 0.24, vol: 0.16 }); },
    smash:   function () { noise({ dur: 0.3, freq: 2400, vol: 0.3 });
                           tone({ freq: 900, slideTo: 200, type: 'square', dur: 0.2, vol: 0.14 }); },
    hurt:    function () { tone({ freq: 340, slideTo: 90, type: 'sawtooth', dur: 0.35, vol: 0.3 });
                           noise({ dur: 0.2, freq: 500, vol: 0.2, filter: 'lowpass' }); },
    pickup:  function () { tone({ freq: hz(76), type: 'square', dur: 0.09, vol: 0.2 });
                           tone({ freq: hz(83), type: 'square', dur: 0.14, vol: 0.2, at: 0.08 }); },
    coffee:  function () { [72, 76, 79, 84].forEach(function (n, i) {
                             tone({ freq: hz(n), type: 'square', dur: 0.12, vol: 0.18, at: i * 0.05 }); }); },
    bossHit: function () { tone({ freq: 160, slideTo: 60, type: 'sawtooth', dur: 0.3, vol: 0.3, through: dist });
                           noise({ dur: 0.25, freq: 1400, vol: 0.25 }); },
    warn:    function () { tone({ freq: 180, type: 'square', dur: 0.14, vol: 0.22 });
                           tone({ freq: 180, type: 'square', dur: 0.14, vol: 0.22, at: 0.2 }); },
    death:   function () { [64, 60, 55, 48].forEach(function (n, i) {
                             tone({ freq: hz(n), type: 'sawtooth', dur: 0.32, vol: 0.25, at: i * 0.14, through: dist }); }); },
    win:     function () { [64, 68, 71, 76, 71, 76, 83].forEach(function (n, i) {
                             tone({ freq: hz(n), type: 'square', dur: 0.28, vol: 0.22, at: i * 0.13 });
                             tone({ freq: hz(n - 12), type: 'triangle', dur: 0.3, vol: 0.14, at: i * 0.13 }); }); },
    select:  function () { tone({ freq: hz(72), type: 'square', dur: 0.07, vol: 0.18 }); },

    /* выходы с уровней */
    doors:   function () { noise({ dur: 0.5, freq: 700, vol: 0.16, filter: 'bandpass' });
                           tone({ freq: 80, type: 'square', dur: 0.14, vol: 0.13, at: 0.42 }); },
    ding:    function () { tone({ freq: hz(88), type: 'sine', dur: 0.5, vol: 0.24 });
                           tone({ freq: hz(83), type: 'sine', dur: 0.7, vol: 0.2, at: 0.22 }); },
    stage:   function () { [67, 72, 76, 79].forEach(function (n, i) {
                             tone({ freq: hz(n), type: 'square', dur: 0.22, vol: 0.2, at: i * 0.09 }); }); },

    /* подгоны от Геоса */
    msg:     function () { tone({ freq: hz(84), type: 'sine', dur: 0.1, vol: 0.22 });
                           tone({ freq: hz(91), type: 'sine', dur: 0.16, vol: 0.2, at: 0.1 }); },
    hatOn:   function () { [60, 64, 67, 72, 76, 79, 84].forEach(function (n, i) {
                             tone({ freq: hz(n), type: 'square', dur: 0.1, vol: 0.2, at: i * 0.055 }); });
                           noise({ dur: 0.5, freq: 900, vol: 0.1, filter: 'bandpass', at: 0.1 }); },
    whirr:   function () { tone({ freq: 90, slideTo: 150, type: 'sawtooth', dur: 0.5, vol: 0.09 }); },
    roar:    function () { tone({ freq: 110, slideTo: 40, type: 'sawtooth', dur: 1.1, vol: 0.34, through: dist });
                           tone({ freq: 165, slideTo: 55, type: 'square', dur: 1.0, vol: 0.16, through: dist });
                           noise({ dur: 1.2, freq: 420, vol: 0.3, filter: 'lowpass' }); },
    fire:    function () { noise({ dur: 0.9, freq: 1200, vol: 0.32, filter: 'bandpass' });
                           tone({ freq: 300, slideTo: 90, type: 'sawtooth', dur: 0.8, vol: 0.14, through: dist }); }
  };

  /* ---- фоновая музыка -------------------------------------------------- */

  /* Дорожки: аккорд на такт (8 шестнадцатых), бочка и рабочий — списками
   * слотов. Где есть lead, поверх арпеджио идёт мелодия: массив на все
   * такты подряд, null — пауза. */
  var TRACKS = {
    run: {
      tempo: 168,
      prog: [[40, [40, 47, 52]], [36, [36, 43, 48]], [43, [43, 50, 55]], [38, [38, 45, 50]]],
      kick: [0, 3, 6], snare: [4]
    },
    boss: {
      tempo: 190,
      prog: [[38, [38, 45, 50]], [37, [37, 44, 49]], [38, [38, 45, 50]], [43, [43, 49, 54]]],
      kick: [0, 3, 6], snare: [4, 7]
    },
    /* Комикс: Am – F – C – G с отдельной мелодией — заставочная тема
     * в духе шестнадцатибитных приставок, помедленнее забега. */
    comic: {
      tempo: 150,
      prog: [[45, [45, 52, 57]], [41, [41, 48, 53]], [36, [36, 43, 48]], [43, [43, 50, 55]]],
      kick: [0, 6], snare: [4], arpVol: 0.05,
      lead: [
        81, 81, null, 84, null, 83, 81, null,
        79, null, 77, null, 76, null, 77, 79,
        81, 81, null, 84, null, 86, 84, null,
        83, null, 81, null, 79, 78, 79, null
      ]
    }
  };
  var ARP = [0, 2, 1, 2, 0, 1, 2, 1];

  function scheduleStep(time) {
    var tr = TRACKS[track] || TRACKS.run;
    var prog = tr.prog;
    var bar = Math.floor(step / 8) % prog.length;
    var slot = step % 8;
    var root = prog[bar][0];
    var notes = prog[bar][1];

    // бас
    if (slot % 2 === 0) {
      tone({ freq: hz(root - 12), type: 'sawtooth', dur: 0.14, vol: 0.3,
             at: time, through: musicGain });
    }
    // арпеджио
    tone({ freq: hz(notes[ARP[slot]] + 12), type: 'square', dur: 0.1,
           vol: tr.arpVol || 0.09, at: time, through: musicGain });
    // мелодия: две расстроенные пилы — так лид звучит толще, чем один квадрат
    if (tr.lead) {
      var n = tr.lead[step % tr.lead.length];
      if (n !== null && n !== undefined) {
        tone({ freq: hz(n), type: 'sawtooth', dur: 0.19, vol: 0.14,
               at: time, detune: -8, through: musicGain });
        tone({ freq: hz(n), type: 'square', dur: 0.17, vol: 0.08,
               at: time, detune: 9, through: musicGain });
      }
    }
    // бочка / рабочий / хэт
    if (tr.kick.indexOf(slot) >= 0) {
      tone({ freq: 120, slideTo: 45, type: 'sine', dur: 0.13, vol: 0.34, at: time, through: musicGain });
    }
    if (tr.snare.indexOf(slot) >= 0) {
      noise({ dur: 0.13, freq: 1900, vol: 0.16, at: time, through: musicGain });
    }
    noise({ dur: 0.03, freq: 8000, vol: 0.05, at: time, through: musicGain });
  }

  /* ---- песня из партитуры ------------------------------------------------
   *
   * Дорожку можно задать не сеткой аккордов, а готовыми нотами — их
   * складывает tools/midi_song.py из MIDI. События лежат дельтами по
   * миллисекундам, поэтому у каждой партии свой курсор: свой номер события
   * и своё накопленное время.
   */
  var SONGS = {};                          // имя дорожки → партитура
  var PARTS = ['lead', 'rhythm', 'bass', 'drums'];
  var songAt = 0;                          // когда по часам ctx начался круг
  var songPos = 0;                         // где встали, мс — чтобы продолжить
  var songName = null;                     // чьё это место
  var cur = null;
  var LOOP_GAP = 700;                      // вдох между кругами

  function songSeek(ms) {
    var s = SONGS[track];
    cur = {};
    for (var p = 0; p < PARTS.length; p++) {
      var name = PARTS[p], list = s[name] || [], c = { i: 0, t: 0 };
      while (c.i < list.length && c.t + list[c.i][0] < ms) {
        c.t += list[c.i][0];
        c.i++;
      }
      cur[name] = c;
    }
  }

  function hit(kind, at) {
    if (kind === 0) {
      tone({ freq: 132, slideTo: 44, type: 'sine', dur: 0.15, vol: 0.95,
             at: at, through: band.drums });
    } else if (kind === 1) {
      noise({ dur: 0.14, freq: 1800, vol: 0.5, at: at, through: band.drums });
      tone({ freq: 196, type: 'triangle', dur: 0.08, vol: 0.28,
             at: at, through: band.drums });
    } else if (kind === 2) {
      noise({ dur: 0.035, freq: 9000, vol: 0.14, filter: 'highpass',
              at: at, through: band.drums });
    } else if (kind === 3) {
      tone({ freq: 190, slideTo: 92, type: 'sine', dur: 0.22, vol: 0.5,
             at: at, through: band.drums });
    } else {
      noise({ dur: 0.7, freq: 5200, vol: 0.26, filter: 'highpass',
              at: at, through: band.drums });
    }
  }

  function voice(part, note, ms, at) {
    var f = hz(note), d = ms / 1000;
    if (part === 'bass') {
      tone({ freq: f, type: 'sawtooth', dur: Math.min(d, 0.5), vol: 0.5,
             at: at, through: band.bass });
    } else if (part === 'rhythm') {
      tone({ freq: f, type: 'sawtooth', dur: Math.min(d, 0.45), vol: 0.15,
             at: at, through: band.rhythm });
    } else {
      // мелодию ведут две расстроенные пилы — одна звучит тонко
      tone({ freq: f, type: 'sawtooth', dur: Math.min(d, 0.9), vol: 0.3,
             at: at, detune: -7, through: band.lead });
      tone({ freq: f, type: 'sawtooth', dur: Math.min(d, 0.9), vol: 0.2,
             at: at, detune: 8, through: band.lead });
    }
  }

  function pumpSong() {
    var s = SONGS[track];
    var horizon = ctx.currentTime + 0.2;

    for (var p = 0; p < PARTS.length; p++) {
      var name = PARTS[p], list = s[name] || [], c = cur[name];
      while (c.i < list.length) {
        var e = list[c.i];
        var t = c.t + e[0];
        var when = songAt + t / 1000;
        if (when > horizon) break;
        c.t = t; c.i++;
        var at = Math.max(0, when - ctx.currentTime);
        if (name === 'drums') hit(e[1], at);
        else voice(name, e[1], e[2], at);
      }
    }

    songPos = (ctx.currentTime - songAt) * 1000;
    if (songPos > s.ms + LOOP_GAP) {       // круг закончился — заходим снова
      songAt = ctx.currentTime;
      songPos = 0;
      songSeek(0);
    }
  }

  function pump() {
    if (!ready || !ctx) return;
    if (SONGS[track]) { pumpSong(); return; }
    var spb = 60 / tempo / 2;              // длительность шестнадцатой
    while (nextTime < ctx.currentTime + 0.14) {
      scheduleStep(Math.max(0, nextTime - ctx.currentTime));
      nextTime += spb;
      step++;
    }
  }

  return {
    init: init,
    isReady: function () { return ready; },

    sfx: function (name) { if (ready && SFX[name]) { try { SFX[name](); } catch (e) {} } },
    chord: function () { try { chord(); } catch (e) {} },

    /* Партитура из MIDI (см. tools/midi_song.py). Кладётся по имени
     * дорожки и подменяет собой её сетку аккордов; не положили — играет
     * прежний чиптюн, так что без файла ничего не ломается. */
    setSong: function (which, data) {
      if (data && data.ms) SONGS[which] = data;
    },

    music: function (which) {
      if (!ready) return;
      var next = (TRACKS[which] || SONGS[which]) ? which : 'run';
      var changed = next !== track;
      if (changed) step = 0;
      track = next;
      tempo = (TRACKS[track] || TRACKS.run).tempo;

      if (SONGS[track]) {
        // после босса забег продолжается с того же места песни, а не
        // с первого такта — иначе вступление звучит второй раз
        if (songName !== track) { songName = track; songPos = 0; }
        songAt = ctx.currentTime + 0.08 - songPos / 1000;
        songSeek(songPos);
      } else if (changed || !timer) {
        nextTime = ctx.currentTime + 0.05;
      }
      if (timer) return;
      timer = setInterval(pump, 25);
    },

    stopMusic: function () {
      if (timer) { clearInterval(timer); timer = null; }
    },

    /* Уход из вкладки глушит музыку — по возвращении её надо завести
     * снова, иначе дальше играется тишина до конца забега. */
    resumeMusic: function () {
      if (!ready || timer) return;
      if (ctx.state === 'suspended') ctx.resume();
      this.music(track);
    },

    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.85;
      try { localStorage.setItem('sg_muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },

    isMuted: function () { return muted; }
  };
})();
