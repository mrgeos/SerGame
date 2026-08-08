/* Серёга спешит домой — конфигурация.
 *
 * Тут собрано всё, что можно менять без правки кода игры:
 * имена, тексты, баланс. Правь смело.
 */
window.SG = window.SG || {};

SG.CFG = {
  /* ---- Персонализация ------------------------------------------------- */
  hero: 'СЕРЁГА',
  wife: 'ЖЕНА',          // ← поставь имя
  daughter: 'ДОЧКА',     // ← поставь имя
  bossName: 'ГЛАВНЫЙ ЗОМБИ-МЕНЕДЖЕР',

  intro: [
    'Пятница. 18:59.',
    'Дома ждут жена, дочка и торт.',
    'Между Серёгой и тортом — таски и менеджеры.',
    'У Серёги есть гитара.'
  ],

  finale: {
    title: 'С ДНЁМ РОЖДЕНИЯ, СЕРЁГА!',
    lines: [
      'Все таски закрыты. Все созвоны отменены.',
      'Дома — торт, жена и дочка.',
      'Так пусть так будет каждую пятницу.'
    ]
  },

  /* Надписи на тасках-препятствиях */
  tasks: [
    'СРОЧНО!!!', 'ПРАВКИ', 'ДЕЙЛИ', 'РЕТРО', 'ГРУМИНГ',
    'ЭТО НА ВЧЕРА', 'СОЗВОН 5 МИН', 'ХОТФИКС', 'ОЦЕНИ ЗАДАЧУ',
    'ГДЕ СТАТУС?', 'ТАЙМШИТЫ', 'ПОДВИНЬ КНОПКУ', 'СПРИНТ ГОРИТ',
    'ЕЩЁ ПРАВКА', 'БЛОКЕР', 'P0', 'РЕГРЕСС', 'ПЕРЕОЦЕНКА'
  ],

  /* Что кричат зомби-менеджеры, когда появляются */
  taunts: [
    'ЕСТЬ МИНУТКА?', 'СИНХРОНИЗИРУЕМСЯ?', 'ЭТО БЫСТРО',
    'НА ПЯТЬ МИНУТ', 'ДАВАЙ ЗААПРУВИМ', 'СТАТУС?', 'Я НА СОЗВОНЕ'
  ],

  bossLines: [
    'ДАВАЙТЕ ЗАФИНАЛИМ!',
    'МНЕ ЭТО НУЖНО ВЧЕРА!',
    'ПЕРЕНЕСЁМ ОТПУСК?',
    'ЕЩЁ ОДИН СПРИНТ!',
    'Я ЗАБРОНИРОВАЛ СУББОТУ'
  ],

  /* Реплики Серёги при ударе аккордом */
  chords: ['E5', 'A5', 'D5', 'G5', 'POWER!', 'RIFF!', 'SOLO!'],

  /* ---- Баланс --------------------------------------------------------- */
  run: {
    startSpeed: 300,      // px/сек в начале
    maxSpeed: 560,        // потолок
    accelPerMeter: 0.55,  // насколько разгоняется за «метр»
    bossAtMeters: 480,    // где встречаем босса
    lives: 3,
    invulnMs: 1300,       // неуязвимость после урона
    jumpVel: -620,
    gravity: 1750,
    doubleJumpVel: -520,
    attackCooldownMs: 290,
    attackActiveMs: 200,
    attackRange: 96,      // длина зоны удара перед Серёгой
    attackHeight: 62
  },

  boss: {
    hp: 10,
    windupMs: 700,        // окно, когда босса можно бить
    swingMs: 260,
    recoverMs: 900,
    volleyGapMs: 620
  },

  score: {
    perMeter: 1,
    perKill: 50,
    perTaskDodged: 10,
    comboStep: 25
  },

  /* Зоны: до скольки «метров» длится и как выглядит фон */
  zones: [
    { until: 160, name: 'ОФИС' },
    { until: 320, name: 'УЛИЦА' },
    { until: 480, name: 'ДВОР' },
    { until: 1e9, name: 'ПОДЪЕЗД' }
  ]
};

/* Виртуальное разрешение. Ширина считается от пропорций экрана,
 * чтобы и на SE2, и на 15 Pro картинка была во весь экран без полос. */
SG.VIEW = (function () {
  var H = 360;
  var w = window.innerWidth || 640, h = window.innerHeight || 360;
  var aspect = w / h;
  if (!isFinite(aspect) || aspect <= 0) aspect = 16 / 9;
  if (aspect < 1) aspect = 1 / aspect;      // держим телефон вертикально → считаем как ландшафт
  var W = Math.round(H * aspect);
  W = Math.max(560, Math.min(880, W));
  return { W: W, H: H, GROUND: 300, SCALE: 2 };
})();

/* Единый стиль текста */
SG.FONT = '"Courier New", ui-monospace, monospace';
SG.txt = function (scene, x, y, text, size, color, opts) {
  opts = opts || {};
  var t = scene.add.text(x, y, text, {
    fontFamily: SG.FONT,
    fontSize: size + 'px',
    color: color || '#f2e9d8',
    fontStyle: opts.light ? 'normal' : 'bold',
    align: opts.align || 'center',
    stroke: opts.stroke || '#171223',
    strokeThickness: opts.strokeThickness === undefined ? 4 : opts.strokeThickness,
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined
  });
  t.setOrigin(opts.originX === undefined ? 0.5 : opts.originX,
              opts.originY === undefined ? 0.5 : opts.originY);
  return t;
};

/* Данные, живущие между сценами */
SG.state = {
  score: 0,
  meters: 0,
  kills: 0,
  best: (function () {
    try { return parseInt(localStorage.getItem('sg_best') || '0', 10) || 0; } catch (e) { return 0; }
  })(),
  won: (function () {
    try { return localStorage.getItem('sg_won') === '1'; } catch (e) { return false; }
  })(),
  saveBest: function (s) {
    if (s > this.best) {
      this.best = s;
      try { localStorage.setItem('sg_best', String(s)); } catch (e) {}
    }
  },
  markWon: function () {
    this.won = true;
    try { localStorage.setItem('sg_won', '1'); } catch (e) {}
  }
};
