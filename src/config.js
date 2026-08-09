/* Серёга спешит домой — конфигурация.
 *
 * Тут собрано всё, что можно менять без правки кода игры:
 * имена, тексты, баланс. Правь смело.
 */
window.SG = window.SG || {};

SG.CFG = {
  /* ---- Персонализация -------------------------------------------------
   * В любом тексте игры можно писать {hero}, {wife}, {daughter} —
   * подставится имя из этого блока. Заглавные варианты — {HERO}, {WIFE},
   * {DAUGHTER} — подставят его же капсом (см. SG.fmt ниже).
   * Имена держим в именительном падеже, тексты под это и написаны. */
  hero: 'Серёга',
  wife: 'Таня',
  daughter: 'Майя',
  bossName: 'ГЛАВНЫЙ ЗОМБИ-МЕНЕДЖЕР',

  intro: [
    'Пятница. 18:59.',
    'Дома ждут {wife}, {daughter} и торт.',
    'Дорогу перекрыли таски и менеджеры.',
    'Но гитара уже на плече.'
  ],

  finale: {
    title: 'С ДНЁМ РОЖДЕНИЯ, {HERO}!',
    lines: [
      'Все таски закрыты. Все созвоны отменены.',
      'Дома — торт, {wife} и {daughter}.',
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

  /* ---- Подгоны от Геоса ------------------------------------------------
   * Страховка от провала: на последней жизни прилетает шапка-дурилка,
   * а если и с ней босс не даётся — дракон. Проиграть подарок нельзя. */
  geos: {
    name: 'ГЕОС',
    hatMsg: '{HERO}, вот тебе подгон — шапка-дурилка',
    hatHint: 'ХВАТАЙ ШАПКУ!',
    hatWorn: 'ШАПКА-ДУРИЛКА НАДЕТА',
    hatOff: 'ШАПКА СВОЁ ОТРАБОТАЛА',
    accept: 'ПРИНЯТЬ ПОДГОН',
    dragonMsg: 'Этот по-хорошему не пропустит. Держи дракона',
    dragonHint: 'БЕРИ ДРАКОНА!',
    dragonLine: 'ЭЙ, ТЫ ДРАКОНА ЗНАЕШЬ?',
    thanksHat: 'отдельное спасибо Геосу за шапку-дурилку',
    thanksDragon: 'отдельное спасибо Геосу — за шапку и дракона'
  },

  hat: {
    speedMul: 2.1,        // во сколько раз быстрее бежит в шапке
    spawnDelayMs: 1500,   // через сколько после сообщения прилетает шапка
    clearLaneSec: 3.4     // на столько замолкает спавнер, чтобы шапку дали взять
  },

  dragon: {
    stallSec: 50,         // сколько барахтаться с боссом до подгона
    stallHpFrac: 0.5      // ...и при каком остатке HP босса
  },

  /* ---- Баланс --------------------------------------------------------- */
  run: {
    startSpeed: 300,      // px/сек в начале
    maxSpeed: 560,        // потолок
    accelPerMeter: 0.55,  // насколько разгоняется за «метр»
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

  /* ---- Уровни ----------------------------------------------------------
   * У каждой зоны свой конец: офис кончается лифтом, улица — метро,
   * двор — подъездом, у которого ждёт босс. Между уровнями — плашка
   * с итогом этапа; она уезжает сама, тапа не ждёт.
   *
   * until  — на скольки «метрах» кончается зона;
   * gate   — какой выход выезжает навстречу (elevator | metro | porch);
   * hint   — что мигает над выходом, когда он появился;
   * cleared/sub — заголовок и подпись на плашке итога (падежи разные,
   *          поэтому фраза пишется целиком, а не собирается из имени зоны).
   * Последняя зона плашки не имеет: там босс и финал. */
  zones: [
    { until: 160, name: 'ОФИС',  gate: 'elevator',
      hint: 'ЛИФТ',     cleared: 'ОФИС ПРОЙДЕН',    sub: 'лифт вниз — и на воздух' },
    { until: 320, name: 'УЛИЦА', gate: 'metro',
      hint: 'МЕТРО',    cleared: 'УЛИЦА ПРОЙДЕНА',  sub: 'две станции до дома' },
    { until: 480, name: 'ДВОР',  gate: 'porch',
      hint: 'ПОДЪЕЗД',  cleared: '',                sub: '' }
  ],

  level: {
    approachMeters: 24,   // за сколько метров до конца зоны выезжает выход
    continueMs: 900,      // через сколько на плашке загорается кнопка
    continueLabel: 'ПРОДОЛЖИТЬ'
  }
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
  /* RES — во сколько раз холст плотнее игровых координат. Мир остаётся
   * W×H, а рисуется всё в W*RES × H*RES: на retina-экране телефона под
   * это есть запас, и спрайты можно делать вдвое детальнее. */
  return { W: W, H: H, GROUND: 300, SCALE: 2, RES: 2 };
})();

/* Камера показывает ровно игровой мир, растянутый на плотный холст */
SG.setupCamera = function (scene) {
  var c = scene.cameras.main;
  c.setZoom(SG.VIEW.RES);
  c.centerOn(SG.VIEW.W / 2, SG.VIEW.H / 2);
};

/* Подстановка имён: {wife} → Таня, {WIFE} → ТАНЯ.
 * Применяется ко всему тексту, который выводит SG.txt. */
SG.fmt = function (s) {
  if (typeof s !== 'string' || s.indexOf('{') === -1) return s;
  return s.replace(/\{(hero|wife|daughter|HERO|WIFE|DAUGHTER)\}/g, function (m, key) {
    var low = key.toLowerCase();
    var val = SG.CFG[low];
    if (val === undefined) return m;
    return key === low ? val : val.toUpperCase();
  });
};

/* Склонение при числе: SG.plural(2, ['менеджер','менеджера','менеджеров'])
 * → 'менеджера'. Формы задаются для 1, 2 и 5. */
SG.plural = function (n, forms) {
  var a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
};

/* Единый стиль текста */
SG.FONT = '"Courier New", ui-monospace, monospace';
SG.txt = function (scene, x, y, text, size, color, opts) {
  opts = opts || {};
  var t = scene.add.text(x, y, SG.fmt(text), {
    fontFamily: SG.FONT,
    fontSize: size + 'px',
    resolution: SG.VIEW.RES,
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
