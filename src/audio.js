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

  function init() {
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

      ready = true;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ready = false; }
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

  /* Em – C – G – D, по 8 шестнадцатых на аккорд */
  var PROG = {
    run:  [[40, [40, 47, 52]], [36, [36, 43, 48]], [43, [43, 50, 55]], [38, [38, 45, 50]]],
    boss: [[38, [38, 45, 50]], [37, [37, 44, 49]], [38, [38, 45, 50]], [43, [43, 49, 54]]]
  };
  var ARP = [0, 2, 1, 2, 0, 1, 2, 1];

  function scheduleStep(time) {
    var prog = PROG[track] || PROG.run;
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
    tone({ freq: hz(notes[ARP[slot]] + 12), type: 'square', dur: 0.1, vol: 0.09,
           at: time, through: musicGain });
    // бочка / рабочий / хэт
    if (slot === 0 || slot === 3 || slot === 6) {
      tone({ freq: 120, slideTo: 45, type: 'sine', dur: 0.13, vol: 0.34, at: time, through: musicGain });
    }
    if (slot === 4 || (track === 'boss' && slot === 7)) {
      noise({ dur: 0.13, freq: 1900, vol: 0.16, at: time, through: musicGain });
    }
    noise({ dur: 0.03, freq: 8000, vol: 0.05, at: time, through: musicGain });
  }

  function pump() {
    if (!ready || !ctx) return;
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

    music: function (which) {
      if (!ready) return;
      track = which;
      tempo = which === 'boss' ? 190 : 168;
      if (timer) return;
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      timer = setInterval(pump, 25);
    },

    stopMusic: function () {
      if (timer) { clearInterval(timer); timer = null; }
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
