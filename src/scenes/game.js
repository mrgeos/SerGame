/* Основной геймплей: забег → босс → финал. */
window.SG = window.SG || {};

/* Общий onComplete для одноразовых частиц (без него замыкание в цикле
 * держало бы ссылку только на последний спрайт). */
function destroyTargets(tween, targets) {
  for (var i = 0; i < targets.length; i++) targets[i].destroy();
}

SG.GameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

  /* =====================================================================
   *  СТАРТ
   * ===================================================================== */

  create: function () {
    SG.setupCamera(this);
    var C = SG.CFG, V = SG.VIEW;
    this.W = V.W; this.H = V.H; this.G = V.GROUND; this.S = V.SCALE;
    this.PX_PER_M = 70;

    this.phase = 'run';
    this.speed = C.run.startSpeed;
    this.scroll = C.run.startSpeed;
    this.distPx = 0;
    this.meters = 0;
    this.score = 0;
    this.kills = 0;
    this.lives = C.run.lives;
    this.combo = 0;
    this.comboTimer = 0;
    this.shredUntil = 0;
    this.spawnTimer = 1.2;
    this.pickupTimer = 16;   // перебивается ниже, если есть учебные бонусы
    this.zoneIdx = 0;
    this.ents = [];
    this.paused = false;

    /* Дом — там, где кончается последняя зона. Оттуда же считается
     * разгон спавнера и полоса прогресса. */
    this.goalMeters = C.zones[C.zones.length - 1].until;

    // выход с уровня: выезжает навстречу в конце зоны
    this.gate = null;
    this.gateStep = '';
    this.gateStarted = false;
    this.heroFrozen = false;          // true — спрайтом героя двигает кат-сцена
    this.lap = { score: 0, kills: 0, meters: 0 };   // с чего начался текущий этап

    // учёба: что уже показывали за этот забег и чем гарантированно
    // угостить на первом уровне
    this.taught = {};
    var tut = C.tutorial && C.tutorial.enabled ? C.tutorial : null;
    this.demoPickups = tut ? tut.firstPickups.slice() : [];
    this.demoAt = tut ? tut.firstPickupsAt.slice() : [];
    this.modals = [];

    // подгоны от Геоса: выдаются один раз за забег
    this.gift = { hatOffered: false, hatOn: false, dragonOffered: false, dragonUsed: false };
    this.cinematic = false;
    this.bossElapsed = 0;

    // обычный спавнер на первом уровне придерживаем: учебные бонусы
    // выдаются отдельно, и втроём они бы толпились
    if (this.demoPickups.length) this.pickupTimer = 26;

    this.buildWorld();
    this.buildHero();
    this.buildHud();
    this.bindInput();

    SG.Audio.init();
    SG.Audio.music('run');

    this.banner(C.intro[0].replace('. ', ', ').replace(/\.$/, '').toUpperCase(), C.intro[1]);

    var self = this;
    this.events.on('shutdown', function () { self.input.keyboard.removeAllListeners(); });
  },

  buildWorld: function () {
    var W = this.W, H = this.H, G = this.G;
    this.zones = [];
    for (var i = 0; i < SG.CFG.zones.length; i++) {
      // Высоту полосы задаёт сама текстура: тайлспрайт кладёт её пиксель
      // в пиксель, поэтому высокому дому нужен и высокий слой. Рисованные
      // фоны все 220, но подменить их можно картинкой любой высоты.
      var z = {
        sky:  this.add.image(0, 0, 'sky' + i).setOrigin(0).setDisplaySize(W, H).setDepth(0),
        far:  this.bgLayer('bg' + i + '_far', 1),
        near: this.bgLayer('bg' + i + '_near', 2),
        gnd:  this.add.tileSprite(0, G, W, H - G, 'ground' + i).setOrigin(0).setDepth(3)
      };
      var a = i === 0 ? 1 : 0;
      z.sky.setAlpha(a); z.far.setAlpha(a); z.near.setAlpha(a); z.gnd.setAlpha(a);
      this.zones.push(z);
    }
    // тёмная виньетка снизу, чтобы персонажи читались
    this.add.rectangle(0, G, W, H - G, 0x171223, 0.18).setOrigin(0).setDepth(4);
  },

  /* Слой фона во всю ширину, высотой со свою текстуру, нижним краем на земле */
  bgLayer: function (key, depth) {
    var src = this.textures.get(key).getSourceImage();
    var h = Math.min(this.G, (src && src.height) || 220);
    return this.add.tileSprite(0, this.G - h, this.W, h, key).setOrigin(0).setDepth(depth);
  },

  buildHero: function () {
    var G = this.G;
    this.heroX = Math.round(this.W * 0.22);
    this.hero = {
      y: G, vy: 0, onGround: true, jumps: 0,
      invulnUntil: 0, attackUntil: 0, cdUntil: 0, hurtUntil: 0,
      runT: 0
    };
    this.heroSpr = this.add.sprite(this.heroX, G, 'hero_run0')
      .setOrigin(0.5, 1).setDepth(12);
    SG.Art.fit(this.heroSpr, 'hero_run0');
    // куда возвращать героя после кат-сцены и каким его масштаб был до неё
    this.heroHomeX = this.heroX;
    this.heroBaseScale = this.heroSpr.scale;
    this.heroShadow = this.add.ellipse(this.heroX, G + 2, 44, 10, 0x171223, 0.35).setDepth(11);
  },

  buildHud: function () {
    var W = this.W;
    this.lifeIcons = [];
    for (var i = 0; i < SG.CFG.run.lives; i++) {
      this.lifeIcons.push(
        SG.Art.fit(this.add.image(18 + i * 26, 20, 'pick_life').setDepth(30), 'pick_life', 0.7)
      );
    }
    this.scoreTxt = SG.txt(this, W - 12, 12, '0', 20, '#f5c542', { originX: 1, originY: 0 });
    this.metersTxt = SG.txt(this, W - 12, 36, '0 м', 13, '#c9c3dd', { originX: 1, originY: 0, strokeThickness: 3 });
    this.scoreTxt.setDepth(30); this.metersTxt.setDepth(30);

    this.comboTxt = SG.txt(this, W / 2, 58, '', 18, '#7de8ff').setDepth(30).setAlpha(0);

    // прогресс до дома
    this.add.rectangle(W / 2, this.H - 8, W - 120, 4, 0x171223, 0.6).setDepth(30);
    this.progBar = this.add.rectangle(60, this.H - 8, 0, 4, 0xf5c542).setOrigin(0, 0.5).setDepth(30);
    this.homeIcon = SG.txt(this, W - 52, this.H - 8, 'ДОМ', 11, '#c9c3dd', { strokeThickness: 3 }).setDepth(30);

    this.buildShredHud();
  },

  /* Табло режима «море по колено»: название и остаток времени.
   * Стоит под жизнями — там пусто, и взгляд туда уже приучен ходить. */
  buildShredHud: function () {
    this.SHRED_BAR = 152;
    this.shredLabel = SG.txt(this, 14, 34, SG.CFG.modeName.toUpperCase(), 11, '#f5c542',
      { originX: 0, originY: 0, strokeThickness: 3 }).setDepth(30).setAlpha(0);
    this.shredBarBg = this.add.rectangle(14, 54, this.SHRED_BAR, 7, 0x171223, 0.75)
      .setOrigin(0, 0.5).setDepth(30).setAlpha(0);
    this.shredBar = this.add.rectangle(15, 54, this.SHRED_BAR - 2, 5, 0xf5c542)
      .setOrigin(0, 0.5).setDepth(30).setAlpha(0);

    // золотая засветка поверх сцены — «весь экран в режиме»
    this.shredGlow = this.add.rectangle(0, 0, this.W, this.H, 0xf5c542)
      .setOrigin(0).setDepth(28).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  },

  /* Пока режим идёт: фон пульсирует золотом, поверх сцены дышит засветка,
   * слева тикает полоса остатка. Фон красим тинтом, а не заливкой поверх, —
   * так препятствия и герой остаются в своих цветах и хорошо читаются. */
  updateShred: function () {
    var now = this.time.now, on = now < this.shredUntil;

    if (!on) {
      if (this.shredWasOn) {
        this.shredWasOn = false;
        this.shredGlow.setAlpha(0);
        this.tintZone(0xffffff);
        [this.shredLabel, this.shredBarBg, this.shredBar]
          .forEach(function (o) { o.setAlpha(0); });
      }
      return;
    }

    this.shredWasOn = true;
    var left = Phaser.Math.Clamp((this.shredUntil - now) / SG.CFG.run.shredMs, 0, 1);
    var pulse = 0.5 + 0.5 * Math.sin(now / 120);

    this.shredLabel.setAlpha(1);
    this.shredBarBg.setAlpha(0.85);
    this.shredBar.setAlpha(1);
    this.shredBar.width = (this.SHRED_BAR - 2) * left;
    // на последней секунде полоса начинает моргать — время выходит
    if (left < 0.18) this.shredBar.setAlpha(pulse > 0.5 ? 1 : 0.25);

    // засветку поверх сцены держим слабой — она бьёт и по герою,
    // а вот фон уводим в золото сильно: его перекрывать некому
    this.shredGlow.setAlpha(0.04 + pulse * 0.09);
    this.tintZone((255 << 16) |
                  (Math.round(255 + (0xc8 - 255) * pulse) << 8) |
                   Math.round(255 + (0x50 - 255) * pulse));
  },

  tintZone: function (tint) {
    var z = this.zones[this.zoneIdx];
    z.sky.setTint(tint); z.far.setTint(tint); z.near.setTint(tint); z.gnd.setTint(tint);
  },

  bindInput: function () {
    var self = this;
    this.input.addPointer(2);

    this.input.on('pointerdown', function (p) {
      if (self.paused) return;
      if (p.x < self.W * 0.5) self.doJump(); else self.doAttack();
    });

    var kb = this.input.keyboard;
    ['SPACE', 'UP', 'W'].forEach(function (k) {
      kb.on('keydown-' + k, function () { self.doJump(); });
    });
    ['X', 'Z', 'ENTER', 'DOWN', 'S'].forEach(function (k) {
      kb.on('keydown-' + k, function () { self.doAttack(); });
    });
  },

  /* =====================================================================
   *  ДЕЙСТВИЯ ГЕРОЯ
   * ===================================================================== */

  /* Во время кат-сцен управление глухое: и у подгонов Геоса,
   * и на выходе с уровня спрайтом героя двигает сцена. */
  locked: function () {
    return this.paused || this.phase === 'dead' || this.phase === 'outro' ||
           this.cinematic || this.heroFrozen ||
           (this.phase === 'gate' && this.gateStep !== 'approach');
  },

  doJump: function () {
    if (this.locked()) return;
    var h = this.hero, C = SG.CFG.run;
    if (h.onGround) {
      h.vy = C.jumpVel; h.onGround = false; h.jumps = 1;
      SG.Audio.sfx('jump');
      this.puff(this.heroX, this.G, 4);
    } else if (h.jumps < 2) {
      h.vy = C.doubleJumpVel; h.jumps = 2;
      SG.Audio.sfx('djump');
      this.puff(this.heroX, h.y - 20, 5, 'fx_sparkc');
    }
  },

  doAttack: function () {
    if (this.locked()) return;
    var now = this.time.now, C = SG.CFG.run;
    if (now < this.hero.cdUntil) return;
    this.hero.attackUntil = now + C.attackActiveMs;
    this.hero.cdUntil = now + C.attackCooldownMs;
    this.hero.didHitThisSwing = false;

    SG.Audio.chord();

    var sl = this.add.image(this.heroX + 38, this.hero.y - 34, 'fx_slash')
      .setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
    SG.Art.fit(sl, 'fx_slash', 0.9);
    this.tweens.add({
      targets: sl, alpha: 0, scaleX: sl.scaleX * 1.4, duration: C.attackActiveMs + 90,
      onComplete: function () { sl.destroy(); }
    });

    // нотка + название аккорда
    var n = this.add.image(this.heroX + 52, this.hero.y - 70, 'fx_note').setDepth(14);
    SG.Art.fit(n, 'fx_note');
    this.tweens.add({
      targets: n, y: n.y - 34, x: n.x + 22, alpha: 0, duration: 520,
      onComplete: function () { n.destroy(); }
    });
  },

  /* =====================================================================
   *  ГЛАВНЫЙ ЦИКЛ
   * ===================================================================== */

  update: function (time, delta) {
    if (this.paused) return;
    var dt = Math.min(delta, 48) / 1000;

    if (this.phase === 'run') this.updateRun(dt);
    else if (this.phase === 'gate') this.updateGate(dt);
    else if (this.phase === 'bossIntro') this.updateBossIntro(dt);
    else if (this.phase === 'boss' && !this.cinematic) this.updateBoss(dt);

    // страховка по шапке живёт вне updateRun: подгон могли выдать
    // прямо перед выходом с уровня, и добежать до босса надо в любом случае
    if (this.gift.hatOffered && !this.gift.hatWorn && this.phase !== 'dead' &&
        this.hatDeadline && this.time.now > this.hatDeadline) {
      this.wearHat();
    }

    this.updateHero(dt);
    this.updateHat(dt);
    this.updateEnts(dt);
    this.updateScroll(dt);
    this.updateShred();
    this.updateHud(dt);
  },

  updateScroll: function (dt) {
    var z = this.zones[this.zoneIdx];
    z.far.tilePositionX  += this.scroll * 0.16 * dt;
    z.near.tilePositionX += this.scroll * 0.42 * dt;
    z.gnd.tilePositionX  += this.scroll * dt;
  },

  updateRun: function (dt) {
    var C = SG.CFG;
    this.distPx += this.scroll * dt;
    this.meters = this.distPx / this.PX_PER_M;
    this.score += C.score.perMeter * (this.scroll * dt) / this.PX_PER_M;

    this.speed = Math.min(C.run.maxSpeed, C.run.startSpeed + this.meters * C.run.accelPerMeter);
    this.scroll = this.speed * (this.gift.hatOn ? C.hat.speedMul : 1);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
      var prog = Math.min(1, this.meters / this.goalMeters);
      this.spawnTimer = (0.95 - 0.32 * prog) + Math.random() * 0.55;
    }

    // учебные бонусы — по расстоянию, чтобы точно попали в первый уровень
    if (this.demoAt.length && this.meters >= this.demoAt[0]) {
      this.demoAt.shift();
      this.spawnPickup(this.demoPickups.shift());
      this.pickupTimer = Math.max(this.pickupTimer, 8);
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.spawnPickup();
      this.pickupTimer = 15 + Math.random() * 9;
    }

    // конец зоны: навстречу выезжает выход
    var zone = C.zones[this.zoneIdx];
    if (!this.gateStarted && this.meters >= zone.until - C.level.approachMeters) {
      // подгон уже в пути — сперва дадим забрать шапку, выход подождёт
      if (!(this.gift.hatOffered && !this.gift.hatWorn)) this.startGate();
    }
  },

  updateHero: function (dt) {
    var h = this.hero, C = SG.CFG.run, now = this.time.now;
    if (this.heroFrozen) return;         // спрайтом сейчас управляет кат-сцена

    h.vy += C.gravity * dt;
    h.y += h.vy * dt;
    if (h.y >= this.G) {
      if (!h.onGround && h.vy > 0) this.puff(this.heroX, this.G, 3);
      h.y = this.G; h.vy = 0; h.onGround = true; h.jumps = 0;
    }

    // кадр анимации
    var tex;
    if (now < h.attackUntil) tex = h.onGround ? 'hero_atk0' : 'hero_atk1';
    else if (!h.onGround) tex = 'hero_air';
    else { h.runT += dt * (8 + this.scroll / 70); tex = 'hero_run' + (Math.floor(h.runT) % 4); }
    if (now < h.hurtUntil) tex = 'hero_hurt';
    this.heroSpr.setTexture(tex);
    this.heroSpr.y = h.y;
    this.heroSpr.x = this.heroX;         // на выходе с уровня Серёга идёт к двери
    this.heroShadow.x = this.heroX;

    // мигание в неуязвимости
    this.heroSpr.setAlpha(now < h.invulnUntil ? (Math.floor(now / 70) % 2 ? 0.35 : 1) : 1);

    // режим «море по колено»: герой мигает золотом и сыплет искрами —
    // ровной подсветки в динамике было почти не видно
    if (now < this.shredUntil) {
      this.heroSpr.setTint(Math.floor(now / 120) % 2 ? 0xfff3b0 : 0xffa32a);
      if (Math.random() < 0.35) {
        this.burst(this.heroX + (Math.random() - 0.5) * 26,
                   h.y - 20 - Math.random() * 40, 'fx_spark', 1);
      }
    } else {
      this.heroSpr.setTint(0xffffff);
    }

    this.heroShadow.y = this.G + 2;
    var airFrac = Phaser.Math.Clamp((this.G - h.y) / 120, 0, 1);
    this.heroShadow.setScale(1 - airFrac * 0.45).setAlpha(0.35 - airFrac * 0.22);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this.comboTxt.setAlpha(0); }
    }
  },

  /* =====================================================================
   *  СУЩНОСТИ
   * ===================================================================== */

  addEnt: function (e) { this.ents.push(e); return e; },

  spawnCard: function (x, textIdx) {
    var G = this.G;
    var cols = ['card_blue', 'card_green', 'card_violet'];
    var box = this.add.container(x, G).setDepth(10);
    var spr = this.add.sprite(0, 0, cols[Math.floor(Math.random() * cols.length)])
      .setOrigin(0.5, 1);
    SG.Art.fit(spr, spr.texture.key);
    var label = SG.txt(this, 0, -62, SG.CFG.tasks[textIdx % SG.CFG.tasks.length], 11,
      '#f2e9d8', { strokeThickness: 3 });
    box.add([spr, label]);
    return this.addEnt({ kind: 'card', obj: box, x: x, cy: G - 26, hw: 28, hh: 22, vx: 0, smashable: false });
  },

  spawnFlyer: function (x) {
    var G = this.G;
    var box = this.add.container(x, G - 70).setDepth(10);
    var spr = SG.Art.fit(this.add.sprite(0, 0, 'card_fly').setOrigin(0.5, 0.5), 'card_fly');
    var label = SG.txt(this, 0, -40, 'СРОЧНО!!!', 11, '#ffb3a6', { strokeThickness: 3 });
    box.add([spr, label]);
    var e = this.addEnt({ kind: 'flyer', obj: box, x: x, cy: G - 70, hw: 30, hh: 20, vx: -40, smashable: true, baseY: G - 70, t: 0 });
    return e;
  },

  spawnZombie: function (x) {
    var G = this.G;
    var spr = SG.Art.fit(this.add.sprite(x, G, 'zombie0').setOrigin(0.5, 1).setDepth(10), 'zombie0');
    var e = this.addEnt({ kind: 'zombie', obj: spr, x: x, cy: G - 34, hw: 20, hh: 30, vx: -95, smashable: true, t: 0 });
    if (Math.random() < 0.5) {
      var T = SG.CFG.taunts;
      e.say = this.bubble(x, G - 88, T[Math.floor(Math.random() * T.length)]).setDepth(11);
    }
    return e;
  },

  /* Реплика в светлой плашке.
   *
   * Тёмным по светлому читается заметно быстрее, чем светлым с обводкой
   * по пёстрому фону, — а реплика зомби живёт на экране пару секунд, и её
   * надо успеть прочитать. tailDx — куда смотрит хвостик снизу. */
  bubble: function (x, y, text, tailDx) {
    var t = SG.txt(this, 0, 0, text, 12, '#171223',
      { originX: 0.5, originY: 0.5, strokeThickness: 0 });
    var w = t.width + 20, h = t.height + 12;
    var tx = tailDx === undefined ? 0 : tailDx;

    var g = this.add.graphics();
    g.fillStyle(0xf2e9d8, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.fillTriangle(tx - 6, h / 2 - 1, tx + 6, h / 2 - 1, tx - 2, h / 2 + 9);
    g.lineStyle(1, 0x171223, 0.4);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);

    var box = this.add.container(x, y).setScale(0.7).setAlpha(0);
    box.add([g, t]);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    return box;
  },

  /* Реплика не исчезает вместе с зомби: повисает в воздухе и тает,
   * иначе аккорд стирает её раньше, чем её успевают дочитать. */
  dropBubble: function (e) {
    if (!e.say) return;
    var b = e.say;
    e.say = null;
    this.tweens.add({
      targets: b, y: b.y - 16, alpha: 0, duration: SG.CFG.run.tauntFadeMs,
      delay: 260, onComplete: function () { b.destroy(); }
    });
  },

  /* Бонус в оболочке: сам предмет и вращающиеся лучи под ним.
   *
   * Лучи нужны, чтобы предмет замечали: он мелкий, летит на уровне головы
   * и легко теряется на пёстром фоне. Кладём их первыми, поэтому предмет
   * всегда поверх, а свечение выходит из-за него. */
  pickupBox: function (key, x, y, depth) {
    var box = this.add.container(x, y).setDepth(depth === undefined ? 10 : depth);
    var rays = SG.Art.fit(this.add.image(0, 0, 'fx_rays'), 'fx_rays')
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    var spr = SG.Art.fit(this.add.sprite(0, 0, key), key);
    box.add([rays, spr]);
    box.rays = rays;
    box.spr = spr;
    box.baseSX = spr.scaleX;
    box.baseRS = rays.scaleX;
    return box;
  },

  spawnPickup: function (kind) {
    if (!kind) kind = (this.lives < SG.CFG.run.lives && Math.random() < 0.65) ? 'life' : 'coffee';
    var y = this.G - 118;
    var box = this.pickupBox(kind === 'life' ? 'pick_life' : 'pick_coffee', this.W + 60, y);
    return this.addEnt({ kind: 'pickup', sub: kind, obj: box, x: this.W + 60, cy: y, hw: 22, hh: 22, vx: 0, baseY: y, t: 0 });
  },

  spawnPattern: function () {
    var W = this.W, x0 = W + 60;
    var C = SG.CFG;
    var prog = Math.min(1, this.meters / this.goalMeters);
    var ti = Math.floor(Math.random() * C.tasks.length);

    var pool = ['card', 'card', 'card'];
    if (prog > 0.05) pool.push('zombie', 'zombie', 'zombie');
    if (prog > 0.16) pool.push('flyer', 'flyer');
    if (prog > 0.26) pool.push('cardPair', 'cardPair');
    if (prog > 0.38) pool.push('zombieCard', 'zombieCard');
    if (prog > 0.50) pool.push('zombie2');
    if (prog > 0.62) pool.push('flyerCard');
    if (prog > 0.74) pool.push('gauntlet');

    var p = pool[Math.floor(Math.random() * pool.length)];
    var gap = Math.max(150, this.speed * 0.42);

    switch (p) {
      case 'card':       this.spawnCard(x0, ti); break;
      case 'cardPair':   this.spawnCard(x0, ti); this.spawnCard(x0 + gap, ti + 1); break;
      case 'flyer':      this.spawnFlyer(x0); break;
      case 'zombie':     this.spawnZombie(x0); break;
      case 'zombie2':    this.spawnZombie(x0); this.spawnZombie(x0 + gap * 1.1); break;
      case 'zombieCard': this.spawnCard(x0, ti); this.spawnZombie(x0 + gap * 1.25); break;
      case 'flyerCard':  this.spawnCard(x0, ti); this.spawnFlyer(x0 + gap * 1.35); break;
      case 'gauntlet':
        this.spawnZombie(x0);
        this.spawnCard(x0 + gap * 1.2, ti);
        this.spawnFlyer(x0 + gap * 2.4);
        break;
    }
  },

  updateEnts: function (dt) {
    var now = this.time.now;
    var atk = now < this.hero.attackUntil;
    // шапка-дурилка работает как бесконечное «море по колено»: сносит всё телом
    var shred = now < this.shredUntil || this.gift.hatOn;
    var C = SG.CFG.run;

    var hx = this.heroX, hcy = this.hero.y - 32, hhw = 15, hhh = 30;
    var ax = hx + 4 + C.attackRange / 2, acy = this.hero.y - 38, ahw = C.attackRange / 2, ahh = 40;

    for (var i = this.ents.length - 1; i >= 0; i--) {
      var e = this.ents[i];
      // Список могли вычистить прямо посреди цикла: hurt() умеет позвать
      // подгон Геоса, а тот сносит всё, что летит навстречу.
      if (!e || e.dead) continue;
      e.t = (e.t || 0) + dt;
      e.x += (e.vx - this.scroll) * dt;
      e.obj.x = e.x;

      if (e.kind === 'flyer') {
        e.cy = e.baseY + Math.sin(e.t * 4) * 8;
        e.obj.y = e.cy;
      } else if (e.kind === 'pickup') {
        e.cy = e.baseY + Math.sin(e.t * 3) * 7;
        e.obj.y = e.cy;
        var b = e.obj;
        if (b.rays) {
          b.rays.rotation += dt * 1.5;
          b.rays.setAlpha(0.42 + Math.sin(e.t * 5) * 0.18);
          b.rays.setScale(b.baseRS * (1 + Math.sin(e.t * 5) * 0.09));
          // разворот как у монетки, но до ребра не доводим:
          // иначе предмет на мгновение пропадает и его не узнать
          b.spr.scaleX = b.baseSX * (0.45 + 0.55 * Math.abs(Math.cos(e.t * 2.2)));
        }
      } else if (e.kind === 'zombie') {
        if (!e.dying) e.obj.setTexture('zombie' + (Math.floor(e.t * 8) % 4));
        if (e.say) { e.say.x = e.x; }
      } else if (e.kind === 'shot') {
        e.obj.rotation += dt * 6 * (e.spin || 1);
      }

      if (e.x < -140) { this.killEnt(e, i, false); continue; }

      // сбитый зомби ещё мгновение летит, потом исчезает
      if (e.dying) {
        e.obj.setAlpha(Math.max(0, (e.dieAt - now) / 300));
        if (now >= e.dieAt) this.killEnt(e, i, true);
        continue;
      }

      // удар аккордом
      if ((atk || shred) && e.smashable !== false && e.kind !== 'pickup') {
        var inAtk = shred
          ? (Math.abs(e.x - hx) < e.hw + 34 && Math.abs(e.cy - hcy) < e.hh + hhh)
          : (Math.abs(e.x - ax) < e.hw + ahw && Math.abs(e.cy - acy) < e.hh + ahh);
        if (inAtk) { this.smash(e, i); continue; }
      }

      // бонус впервые показался в кадре — рассказываем, что это
      if (e.kind === 'pickup' && !e.shown && e.x < this.W - 70) {
        e.shown = true;
        this.teachPickup(e.sub);
      }

      // столкновение с героем
      if (Math.abs(e.x - hx) < e.hw + hhw && Math.abs(e.cy - hcy) < e.hh + hhh) {
        if (e.kind === 'pickup') { this.takePickup(e, i); continue; }
        if (shred) { this.smash(e, i); continue; }

        var lesson = this.canBeHurt() ? this.teach(e.kind) : null;
        if (!lesson || lesson.costsLife) this.hurt();
        // после урока препятствие убираем всегда: на паузе Серёга стоит
        // прямо в нём, и без этого урок повторился бы сразу после неё
        if (lesson || e.kind !== 'card') this.killEnt(e, i, true);
        continue;
      }

      // таск успешно перепрыгнут
      if (!e.scored && e.x < hx - 40) {
        e.scored = true;
        if (e.kind === 'card' || e.kind === 'flyer') this.addScore(SG.CFG.score.perTaskDodged);
      }
    }
  },

  killEnt: function (e, idx, fx) {
    if (!e || e.dead) return;
    e.dead = true;
    if (fx) this.puff(e.x, e.cy, 5);
    if (e.say) e.say.destroy();
    e.obj.destroy();
    // индекс мог протухнуть, если список тронули по дороге
    if (idx === undefined || this.ents[idx] !== e) idx = this.ents.indexOf(e);
    if (idx >= 0) this.ents.splice(idx, 1);
  },

  /* Снести всё, что летит навстречу.
   *
   * Зовётся в том числе из середины updateEnts — через hurt(), который умеет
   * вызвать подгон Геоса. Поэтому список пересобирается целиком, а не
   * выщипывается по индексам: иначе итератор наверху остаётся с чужими
   * номерами и уходит за границу массива.
   *
   * keep — необязательный фильтр: что вернёт true, то остаётся жить. */
  clearEnts: function (fx, keep) {
    var list = this.ents, kept = [];
    this.ents = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      if (keep && keep(e)) { kept.push(e); continue; }
      e.dead = true;
      if (fx) this.puff(e.x, e.cy, 5);
      if (e.say) e.say.destroy();
      e.obj.destroy();
    }
    this.ents = kept;
  },

  smash: function (e, idx) {
    if (this.hero.attackUntil > this.time.now) this.hero.didHitThisSwing = true;
    this.kills++;
    this.combo++;
    this.comboTimer = 2.4;

    var base = e.kind === 'zombie' ? SG.CFG.score.perKill : SG.CFG.score.perKill * 0.6;
    var bonus = (this.combo - 1) * SG.CFG.score.comboStep;
    this.addScore(Math.round(base + bonus));

    if (this.combo > 1) {
      this.comboTxt.setText('COMBO x' + this.combo).setAlpha(1).setScale(1.3);
      this.tweens.add({ targets: this.comboTxt, scale: 1, duration: 180 });
    }

    SG.Audio.sfx(e.kind === 'zombie' ? 'kill' : 'smash');
    this.burst(e.x, e.cy, e.kind === 'zombie' ? 'fx_spark' : 'fx_sparkc', 8);
    this.floatText(e.x, e.cy - 30, SG.CFG.chords[Math.floor(Math.random() * SG.CFG.chords.length)], '#7de8ff');
    this.cameras.main.shake(90, 0.004);

    // зомби не исчезает мгновенно: показываем кадр удара и отбрасываем
    if (e.kind === 'zombie') {
      e.dying = true;
      e.dieAt = this.time.now + 300;
      e.vx = 220;
      e.obj.setTexture('zombie_hit');
      this.dropBubble(e);
      return;
    }
    this.killEnt(e, idx, false);
  },

  takePickup: function (e, idx) {
    if (e.sub === 'hat') {
      this.killEnt(e, idx, false);
      this.wearHat();
      return;
    }
    if (e.sub === 'dragon') {
      this.killEnt(e, idx, false);
      this.dragonFinish();
      return;
    }
    if (e.sub === 'life') {
      if (this.lives < SG.CFG.run.lives) this.lives++;
      else this.addScore(150);
      SG.Audio.sfx('pickup');
      this.floatText(e.x, e.cy - 20, '+МЕДИАТОР', '#f5c542');
    } else {
      this.shredUntil = this.time.now + SG.CFG.run.shredMs;
      SG.Audio.sfx('coffee');
      this.floatText(e.x, e.cy - 20, SG.CFG.modeName.toUpperCase() + '!', '#ffb3a6');
      this.cameras.main.flash(160, 255, 220, 140);
    }
    this.refreshLives();
    this.burst(e.x, e.cy, 'fx_spark', 10);
    this.killEnt(e, idx, false);
  },

  /* Пройдёт ли сейчас урон. Вынесено отдельно, потому что по тому же
   * правилу решается, показывать ли учебное окно: урок вместо удара
   * имеет смысл только там, где удар вообще прошёл бы. */
  canBeHurt: function () {
    if (this.phase === 'dead') return false;
    if (this.time.now < this.hero.invulnUntil) return false;
    if (this.gift.hatOn || this.cinematic) return false;   // в шапке-дурилке урона нет
    // Геос уже написал — добить до того, как подгон дойдёт, не дадим,
    // иначе вся страховка бессмысленна
    if (this.gift.hatOffered && !this.gift.hatWorn) return false;
    if (this.gift.dragonOffered && !this.gift.dragonUsed) return false;
    return true;
  },

  hurt: function () {
    var now = this.time.now;
    if (!this.canBeHurt()) return;

    this.lives--;
    this.combo = 0;
    this.comboTxt.setAlpha(0);
    this.hero.invulnUntil = now + SG.CFG.run.invulnMs;
    this.hero.hurtUntil = now + 280;
    this.refreshLives();
    SG.Audio.sfx('hurt');
    this.cameras.main.shake(220, 0.012);
    this.cameras.main.flash(120, 200, 60, 60);

    if (this.lives <= 0) {
      // у босса Геос не даёт проиграть — присылает дракона вместо поражения
      // (включая выезд босса: попасть туда нечем, но дыры быть не должно)
      if ((this.phase === 'boss' || this.phase === 'bossIntro') && !this.gift.dragonOffered) {
        this.lives = 1;
        this.refreshLives();
        this.offerDragon();
        return;
      }
      this.die();
      return;
    }

    // осталась последняя жизнь — прилетает шапка-дурилка
    if (this.phase === 'run' && this.lives === 1 && !this.gift.hatOffered) this.offerHat();
  },

  refreshLives: function () {
    for (var i = 0; i < this.lifeIcons.length; i++) {
      this.lifeIcons[i].setAlpha(i < this.lives ? 1 : 0.18);
    }
  },

  die: function () {
    var self = this;
    this.phase = 'dead';
    this.scroll = 0;
    SG.Audio.stopMusic();
    SG.Audio.sfx('death');
    this.heroSpr.setTexture('hero_hurt');
    this.tweens.add({ targets: this.heroSpr, angle: -80, y: this.G + 6, duration: 620 });
    SG.state.score = Math.round(this.score);
    SG.state.meters = Math.round(this.meters);
    SG.state.kills = this.kills;
    SG.state.saveBest(Math.round(this.score));
    this.time.delayedCall(1000, function () { self.scene.start('GameOver'); });
  },

  /* =====================================================================
   *  ЗОНЫ И HUD
   * ===================================================================== */

  /* Декорации меняются мгновенно — под плашкой итога этапа экран чёрный,
   * так что кроссфейд тут не нужен и только смазал бы смену места. */
  setZone: function (idx) {
    idx = Math.min(idx, this.zones.length - 1);
    if (idx === this.zoneIdx) return;
    var from = this.zones[this.zoneIdx], to = this.zones[idx];
    [from.sky, from.far, from.near, from.gnd].forEach(function (o) {
      o.setAlpha(0); o.setTint(0xffffff);
    });
    [to.sky, to.far, to.near, to.gnd].forEach(function (o) { o.setAlpha(1); });
    this.zoneIdx = idx;
  },

  updateHud: function () {
    this.scoreTxt.setText(String(Math.round(this.score)));
    this.metersTxt.setText(Math.round(this.meters) + ' м');
    var prog = Phaser.Math.Clamp(this.meters / this.goalMeters, 0, 1);
    this.progBar.width = (this.W - 120) * prog;
  },

  banner: function (title, sub) {
    var W = this.W;
    var t = SG.txt(this, W / 2, 120, title, 30, '#f5c542').setDepth(31).setAlpha(0);
    var s = sub ? SG.txt(this, W / 2, 152, sub, 14, '#f2e9d8', { strokeThickness: 3 }).setDepth(31).setAlpha(0) : null;
    var targets = s ? [t, s] : [t];
    this.tweens.add({ targets: targets, alpha: 1, duration: 260, yoyo: true, hold: 1300,
      onComplete: function () { targets.forEach(function (o) { o.destroy(); }); } });
  },

  floatText: function (x, y, text, color) {
    var t = SG.txt(this, x, y, text, 14, color, { strokeThickness: 3 }).setDepth(20);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 700,
      onComplete: function () { t.destroy(); } });
  },

  burst: function (x, y, tex, n) {
    for (var i = 0; i < n; i++) {
      var p = SG.Art.fit(this.add.image(x, y, tex).setDepth(16), tex);
      var a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 55;
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        alpha: 0, scale: 0.4, duration: 320 + Math.random() * 260,
        onComplete: destroyTargets
      });
    }
  },

  puff: function (x, y, n, tex) {
    for (var i = 0; i < n; i++) {
      var c = this.add.circle(x + (Math.random() - 0.5) * 18, y - 4, 3 + Math.random() * 4,
        0xc9c3dd, 0.55).setDepth(11);
      this.tweens.add({
        targets: c, x: c.x - 40 - Math.random() * 40, y: c.y - Math.random() * 16,
        alpha: 0, scale: 1.6, duration: 380,
        onComplete: destroyTargets
      });
    }
    if (tex) this.burst(x, y - 10, tex, 4);
  },

  addScore: function (v) {
    var mult = this.time.now < this.shredUntil ? 2 : 1;
    this.score += v * mult;
  },

  /* =====================================================================
   *  ПОДГОНЫ ОТ ГЕОСА
   *
   *  Идея: подарок нельзя проиграть. На последней жизни приходит шапка-
   *  дурилка и проносит Серёгу до босса. Если и с боссом не задалось —
   *  прилетает дракон и заканчивает разговор.
   * ===================================================================== */

  /* Остановить мир: забег замирает, отложенные вызовы тоже.
   *
   * Часы Phaser при этом продолжают идти — time.paused глушит только
   * таймеры, но не time.now. Поэтому абсолютные метки (неуязвимость,
   * «море по колено», страховочные сроки) при снятии паузы сдвигаются
   * на её длительность: иначе они тихо истекут, пока игрок читает. */
  pauseWorld: function () {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = this.time.now;
    this.time.paused = true;
  },

  resumeWorld: function () {
    if (!this.paused) return;
    var dt = this.time.now - this.pausedAt;
    this.paused = false;
    this.time.paused = false;

    var h = this.hero;
    h.invulnUntil += dt; h.attackUntil += dt; h.cdUntil += dt; h.hurtUntil += dt;
    this.shredUntil += dt;
    if (this.hatDeadline) this.hatDeadline += dt;
    if (this.dragonDeadline) this.dragonDeadline += dt;
  },

  /* Окно поверх игры: картинка слева, заголовок, текст и кнопка.
   *
   * На нём держатся и подгоны Геоса, и учебные подсказки первого уровня —
   * разница только в картинке, заголовке и надписи на кнопке. Мир на время
   * окна встаёт: и подгон, и урок надо успеть прочитать.
   *
   * Окна выстраиваются в очередь. Иначе повторный урок, который снимает
   * жизнь, мог бы вызвать сообщение Геоса про шапку — и две карточки
   * легли бы друг на друга. Пауза держится до последнего окна в очереди. */
  modal: function (opt) {
    this.modals = this.modals || [];
    this.modals.push(opt);
    this.pauseWorld();
    if (this.modals.length === 1) this.showModal(opt);
  },

  showModal: function (opt) {
    var self = this, W = this.W, H = this.H;

    var veil = this.add.rectangle(0, 0, W, H, 0x0d0a16, 0.62)
      .setOrigin(0).setDepth(40).setAlpha(0);

    var w = Math.min(W - 56, 430);
    var msg = SG.txt(this, 0, 0, opt.text, 14, '#f2e9d8',
      { originX: 0, originY: 0, strokeThickness: 0, align: 'left', wrap: w - 86 });
    var h = Math.max(44, msg.height) + 104;      // шапка с заголовком + кнопка

    var card = this.add.graphics();
    card.fillStyle(0x171223, 0.97);
    card.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    card.lineStyle(2, 0xf5c542, 1);
    card.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);

    var icon = this.modalIcon(opt.icon, -w / 2 + 36, -h / 2 + 34);
    var title = SG.txt(this, -w / 2 + 66, -h / 2 + 16, opt.title, 14, '#f5c542',
      { originX: 0, originY: 0, strokeThickness: 0 });
    msg.setPosition(-w / 2 + 66, -h / 2 + 38);

    var box = this.add.container(W / 2, H / 2).setDepth(41).setScale(0.86).setAlpha(0);
    box.add([card, icon, title, msg]);

    SG.Audio.sfx(opt.sfx || 'msg');
    this.tweens.add({ targets: veil, alpha: 1, duration: 220 });
    this.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 280, ease: 'Back.easeOut' });

    var btn = this.button(opt.button, H / 2 + h / 2 - 28, function () {
      veil.destroy(); box.destroy(); btn.destroy();
      if (opt.onAccept) opt.onAccept();
      self.modals.shift();
      if (self.modals.length) self.showModal(self.modals[0]);
      else self.resumeWorld();
    });
  },

  /* Картинка в углу окна. Спрайты разного калибра — от медиатора до
   * зомби, — поэтому вписываем их в общий квадратик, а не тянем каждый
   * своим эталонным размером. */
  modalIcon: function (key, x, y) {
    var img = this.add.image(x, y, key);
    SG.Art.fit(img, key);
    var box = 52;
    var k = Math.min(1, box / Math.max(img.displayWidth, img.displayHeight));
    return img.setScale(img.scaleX * k, img.scaleY * k);
  },

  /* Сообщение от Геоса. Всё, что подгон запускает, вешается на onAccept:
   * пока окно открыто, ни шапка, ни дракон появиться не должны. */
  geosMessage: function (text, onAccept) {
    var C = SG.CFG;
    this.modal({
      icon: 'geos', title: C.geos.name, text: text,
      button: C.geos.accept, onAccept: onAccept
    });
  },

  /* =====================================================================
   *  УЧЕБНЫЕ ОКНА
   *
   *  Первый уровень объясняет игру на живых примерах: врезался в таск —
   *  узнал, что их перепрыгивают. Первый урок бесплатный, второй уже
   *  бьёт как обычно. Про бонусы рассказываем, когда предмет впервые
   *  показался в кадре, — по разу.
   * ===================================================================== */

  /* Урок по столкновению. Возвращает null, если учить нечему, иначе
   * говорит, снимать ли за это столкновение жизнь. */
  teach: function (kind) {
    var C = SG.CFG.tutorial;
    if (!C || !C.enabled || this.zoneIdx !== C.zone) return null;
    var lesson = C.lessons[kind];
    if (!lesson) return null;

    var seen = this.taught[kind] || 0;
    if (seen >= C.shows) return null;
    this.taught[kind] = seen + 1;

    this.showLesson(lesson, seen > 0);
    return { costsLife: seen > 0 };     // первое знакомство — бесплатно
  },

  /* Урок по бонусу: показывается один раз, когда предмет впервые попал в кадр */
  teachPickup: function (sub) {
    var C = SG.CFG.tutorial;
    if (!C || !C.enabled || this.zoneIdx !== C.zone) return;
    var lesson = C.lessons[sub];
    if (!lesson || this.taught[sub]) return;
    this.taught[sub] = 1;
    this.showLesson(lesson, false);
  },

  showLesson: function (lesson, again) {
    var C = SG.CFG.tutorial;
    this.modal({
      icon: lesson.icon,
      title: lesson.title,
      text: (again ? C.repeat : '') + lesson.text,
      button: C.ok,
      sfx: 'msg'
    });
  },

  /* Реплика героя — та же плашка, только хвостик смотрит вниз-влево, на него */
  say: function (text, ms) {
    var box = this.bubble(this.heroX + 30, this.hero.y - 104, text, -14).setDepth(34);
    this.time.delayedCall(ms || 1500, function () { box.destroy(); });
    return box;
  },

  offerHat: function () {
    var self = this, C = SG.CFG;
    this.gift.hatOffered = true;

    // Полосу расчищаем сразу, до окна: на паузе перед глазами не должно
    // висеть то, во что Серёга воткнётся в момент её снятия.
    this.clearEnts(true, function (e) { return e.kind === 'pickup'; });

    this.geosMessage(C.geos.hatMsg, function () {
      self.spawnTimer = Math.max(self.spawnTimer, C.hat.clearLaneSec);
      // страховка: если шапку каким-то чудом не подобрали — надеваем сами
      self.hatDeadline = self.time.now + C.hat.spawnDelayMs + 9000;

      self.time.delayedCall(C.hat.spawnDelayMs, function () {
        if (self.phase !== 'run' || self.gift.hatOn) return;
        // на уровне головы и с щедрым хитбоксом — промахнуться нельзя,
        // иначе вся страховка теряет смысл
        var y = self.G - 72;
        var spr = self.pickupBox('pick_hat', self.W + 60, y);
        self.addEnt({
          kind: 'pickup', sub: 'hat', obj: spr, x: self.W + 60, cy: y,
          hw: 30, hh: 30, vx: 0, baseY: y, t: 0
        });
        self.floatText(self.W - 70, self.G - 150, C.geos.hatHint, '#f5c542');
        SG.Audio.sfx('whirr');
      });
    });
  },

  wearHat: function () {
    var C = SG.CFG;
    this.gift.hatOn = true;
    this.gift.hatWorn = true;
    this.hero.invulnUntil = 0;                 // мигание больше не нужно

    // шапка едет на голове, пропеллер крутится отдельно
    this.hatSpr = this.add.image(this.heroX - 1, this.hero.y - this.heroHatOffset(), 'hat_worn')
      .setOrigin(0.5, 1).setDepth(13);
    SG.Art.fit(this.hatSpr, 'hat_worn');
    // пропеллер держим над куполом, а не поверх него
    this.hatProp = this.add.image(this.heroX - 1, 0, 'hat_prop')
      .setOrigin(0.5, 0.5).setDepth(13);
    SG.Art.fit(this.hatProp, 'hat_prop');
    this.hatProp.y = this.hatSpr.y - this.hatSpr.displayHeight + 8;

    SG.Audio.sfx('hatOn');
    this.cameras.main.flash(260, 255, 230, 150);
    this.banner(C.geos.hatWorn, 'таски больше не проблема');
    this.burst(this.heroX, this.hero.y - 60, 'fx_spark', 14);
    this.speedLines = [];
  },

  /* Шапка отработала уровень и слетает.
   *
   * На прощание возвращает жизни: без этого Серёга остался бы на новом
   * уровне с одной и без защиты, а подарок проиграть нельзя. И сбрасывает
   * флаги подгона — если жизни снова кончатся, Геос пришлёт новую шапку. */
  dropHat: function () {
    if (!this.gift.hatOn) return;
    var C = SG.CFG;
    this.gift.hatOn = false;
    this.gift.hatOffered = false;
    this.gift.hatWorn = false;
    this.hatDeadline = 0;

    var h = this.hatSpr, p = this.hatProp;
    this.hatSpr = null; this.hatProp = null;
    this.tweens.add({
      targets: [h, p], y: '-=60', x: '-=90', alpha: 0, angle: 200, duration: 900,
      onComplete: destroyTargets
    });
    this.floatText(this.heroX, this.G - 130, C.geos.hatOff, '#c9c3dd');

    if (this.lives < C.hat.livesBack) {
      this.lives = C.hat.livesBack;
      this.refreshLives();
      this.floatText(this.heroX, this.G - 158, '+' + C.hat.livesBack + ' ' +
        SG.plural(C.hat.livesBack, ['ЖИЗНЬ', 'ЖИЗНИ', 'ЖИЗНЕЙ']), '#f5c542');
      SG.Audio.sfx('pickup');
    }
  },

  /* Куда сажать шапку: считаем от высоты спрайта героя, потому что
   * у кода-арта и у сгенерированных кадров голова на разной высоте */
  heroHatOffset: function () {
    return this.heroSpr.displayHeight * 0.72;
  },

  updateHat: function (dt) {
    if (!this.gift.hatOn || !this.hatSpr) return;
    this.hatSpr.x = this.heroX - 1;
    this.hatProp.x = this.heroX - 1;
    this.hatSpr.y = this.hero.y - this.heroHatOffset();
    this.hatProp.y = this.hatSpr.y - this.hatSpr.displayHeight + 8;
    this.hatProp.rotation += dt * 26;

    // полосы скорости — только на бегу, у двери они ни к чему
    if (this.phase === 'run' && Math.random() < 0.6) {
      var y = this.G - 20 - Math.random() * 130;
      var ln = this.add.rectangle(this.W + 20, y, 30 + Math.random() * 40, 2,
        0xf5c542, 0.5).setDepth(9);
      this.tweens.add({
        targets: ln, x: -80, alpha: 0, duration: 420 + Math.random() * 200,
        onComplete: destroyTargets
      });
    }
  },

  offerDragon: function () {
    var self = this, C = SG.CFG;
    if (this.gift.dragonOffered) return;
    this.gift.dragonOffered = true;

    // сносим летящие таски: и чтобы подгон было видно, и чтобы на паузе
    // перед носом не висел таск, который прилетит в момент её снятия
    this.clearEnts(true, function (e) { return e.kind !== 'shot'; });

    this.geosMessage(C.geos.dragonMsg, function () {
      // страховка: если дракона почему-то не подобрали — зовём сами
      self.dragonDeadline = self.time.now + 11000;

      self.time.delayedCall(1400, function () {
        if (self.phase !== 'boss' || self.gift.dragonUsed) return;
        var y = self.G - 75;
        var spr = self.pickupBox('pick_dragon', self.W + 50, y);
        self.addEnt({
          kind: 'pickup', sub: 'dragon', obj: spr, x: self.W + 50, cy: y,
          hw: 30, hh: 30, vx: -170, baseY: y, t: 0
        });
        self.floatText(self.W - 80, self.G - 160, C.geos.dragonHint, '#f5c542');
        SG.Audio.sfx('whirr');
      });
    });
  },

  /* Дракон прилетает и заканчивает спор с боссом */
  dragonFinish: function () {
    var self = this, C = SG.CFG;
    this.gift.dragonUsed = true;
    this.cinematic = true;

    // сносим летящие таски, чтобы не мешали смотреть
    this.clearEnts(false);

    this.heroSpr.setTexture('hero_atk0');
    this.say(C.geos.dragonLine, 2000);

    this.time.delayedCall(1300, function () {
      SG.Audio.sfx('roar');
      self.cameras.main.shake(900, 0.008);

      var d = self.add.sprite(-140, self.G - 175, 'dragon')
        .setOrigin(0.5, 0.5).setDepth(18);
      SG.Art.fit(d, 'dragon');
      self.tweens.add({
        targets: d, y: self.G - 155, duration: 420, yoyo: true, repeat: 3, ease: 'Sine.easeInOut'
      });
      self.tweens.add({
        targets: d, x: self.W + 180, duration: 2600, ease: 'Sine.easeInOut',
        onComplete: destroyTargets
      });

      // огонь по боссу на подлёте
      self.time.delayedCall(1200, function () {
        SG.Audio.sfx('fire');
        self.cameras.main.flash(500, 255, 190, 90);
        var bx = self.boss ? self.boss.x : self.W * 0.74;
        for (var k = 0; k < 26; k++) {
          (function (k) {
            self.time.delayedCall(k * 24, function () {
              self.burst(bx + (Math.random() - 0.5) * 90, self.G - 40 - Math.random() * 110,
                'fx_flame', 3);
            });
          })(k);
        }
      });

      self.time.delayedCall(1900, function () {
        self.cinematic = false;
        if (self.boss && self.boss.hp > 0) self.bossHit(self.boss.hp);
      });
    });
  },

  /* =====================================================================
   *  ВЫХОД С УРОВНЯ
   *
   *  Зоны больше не перетекают одна в другую на ходу: у каждой свой конец.
   *  Офис кончается лифтом, улица — входом в метро, двор — подъездом,
   *  у которого ждёт босс. Схема одна и та же: выход выезжает навстречу,
   *  мир тормозит, Серёга доходит до двери — дальше по обстоятельствам.
   * ===================================================================== */

  /* Где на спрайте выхода дверь — долями от его размера.
   *
   *   cx   — центр проёма по ширине (у лифта посередине, у дома Серёги
   *          подъезд смещён вправо);
   *   w    — ширина проёма;
   *   base — насколько порог поднят над землёй: дверь подъезда стоит
   *          на цоколе, а не прямо на асфальте.
   *
   * Створка масштабируется ровно в половину проёма, поэтому её картинка
   * должна быть вырезана по этой половине — тогда и высота сойдётся сама.
   * Раскладка одна и для код-арта, и для подменяющей картинки. */
  GATE_DOOR: {
    elevator: { leaf: 'gate_elev_leaf',  cx: 0.5,  w: 44 / 60, base: 0 },
    porch:    { leaf: 'gate_porch_leaf', cx: 0.762, w: 0.140,  base: 0.0146 }
  },

  /* Где сейчас дверь выхода по горизонтали */
  doorX: function () {
    return this.gate ? this.gate.x + this.gate.doorDx : Math.round(this.W * 0.8);
  },

  startGate: function () {
    var C = SG.CFG, zone = C.zones[this.zoneIdx];
    this.gateStarted = true;
    this.phase = 'gate';
    this.gateStep = 'approach';

    // расчищаем полосу: у двери урона быть не должно
    this.clearEnts(true);
    // шапка работает ровно один уровень: до выхода донесла — и хватит
    this.dropHat();

    this.buildGate(zone.gate);
    this.floatText(this.W - 70, this.G - 170, zone.hint, '#f5c542');
  },

  buildGate: function (kind) {
    var key = 'gate_' + kind;
    var spr = SG.Art.fit(this.add.sprite(0, this.G, key).setOrigin(0.5, 1).setDepth(8), key);
    var halfW = spr.displayWidth / 2;
    var d = this.GATE_DOOR[kind];

    // Дом Серёги встаёт правым краем к обрезу экрана: он шире прочих
    // выходов, а подъезд у него сбоку — так дверь оказывается в кадре
    // с запасом слева, где потом дерётся босс.
    var restX = kind === 'porch'
      ? Math.round(this.W - halfW)
      : Math.min(Math.round(this.W * 0.72), Math.round(this.W - halfW - 8));

    var g = {
      kind: kind, spr: spr, x: Math.round(this.W + halfW + 60), restX: restX,
      leaves: [], dx: [], doorDx: 0
    };

    // Створки прижимаются к косякам: левая растёт вправо от левого косяка,
    // правая — влево от правого. Открываются сжатием по X, то есть уезжают
    // каждая в свою стену, как настоящие.
    if (d) {
      var half = spr.displayWidth * d.w / 2;
      var doorY = this.G - spr.displayHeight * d.base;
      g.doorDx = spr.displayWidth * (d.cx - 0.5);
      g.dx = [g.doorDx - half, g.doorDx + half];

      for (var i = 0; i < 2; i++) {
        var o = this.add.sprite(0, doorY, d.leaf).setOrigin(i, 1).setDepth(9);
        var img = o.texture.getSourceImage();
        o.setScale(half / ((img && img.width) || half));
        o.baseSX = o.scaleX;
        g.leaves.push(o);
      }
    }
    this.gate = g;
  },

  openGateDoors: function () {
    var g = this.gate;
    if (!g || !g.leaves.length || g.open) return;
    g.open = true;
    SG.Audio.sfx('doors');
    for (var i = 0; i < g.leaves.length; i++) {
      this.tweens.add({
        targets: g.leaves[i], scaleX: g.leaves[i].baseSX * 0.07,
        duration: 620, ease: 'Sine.easeInOut'
      });
    }
  },

  closeGateDoors: function () {
    var g = this.gate;
    if (!g || !g.leaves.length || !g.open) return;
    g.open = false;
    SG.Audio.sfx('doors');
    for (var i = 0; i < g.leaves.length; i++) {
      this.tweens.add({
        targets: g.leaves[i], scaleX: g.leaves[i].baseSX,
        duration: 620, ease: 'Sine.easeInOut'
      });
    }
  },

  destroyGate: function () {
    var g = this.gate;
    if (!g) return;
    g.spr.destroy();
    g.leaves.forEach(function (o) { o.destroy(); });
    this.gate = null;
  },

  updateGate: function (dt) {
    var g = this.gate;
    if (!g) return;

    if (this.gateStep === 'approach') {
      this.scroll = Math.max(0, this.scroll - 620 * dt);
      this.distPx += this.scroll * dt;
      this.meters = this.distPx / this.PX_PER_M;
      g.x += (g.restX - g.x) * Math.min(1, dt * 2.4);
      if (this.scroll <= 1 && Math.abs(g.x - g.restX) < 3) {
        this.scroll = 0;
        g.x = g.restX;
        // приземляем, если подъехали в прыжке — дальше идёт кат-сцена
        this.hero.vy = 0; this.hero.y = this.G;
        this.hero.onGround = true; this.hero.jumps = 0;
        this.arriveAtGate();
      }
    }

    g.spr.x = g.x;
    for (var i = 0; i < g.leaves.length; i++) g.leaves[i].x = g.x + g.dx[i];
  },

  arriveAtGate: function () {
    var self = this, g = this.gate;

    // у подъезда никто не заходит: оттуда выходит босс
    if (g.kind === 'porch') {
      this.gateStep = 'boss';
      this.banner('ДОМ', 'осталось зайти');
      // дверь открывается под конец плашки, босс выходит уже после неё
      this.time.delayedCall(900, function () { self.openGateDoors(); });
      this.time.delayedCall(1900, function () { self.startBoss(); });
      return;
    }

    this.gateStep = 'walk';
    this.openGateDoors();
    var door = this.doorX();
    var dist = Math.abs(door - this.heroX);
    this.tweens.add({
      targets: this, heroX: door, duration: Math.max(500, dist * 2.1),
      ease: 'Sine.easeInOut', delay: 260,
      onComplete: function () { self.enterGate(); }
    });
  },

  /* Серёга скрывается в проёме: в лифте створки закрываются за ним,
   * в метро он сбегает по лестнице вниз. */
  enterGate: function () {
    var self = this, g = this.gate;
    this.gateStep = 'in';
    this.heroFrozen = true;
    this.heroSpr.setTexture('hero_idle');

    if (g.kind === 'metro') {
      this.tweens.add({ targets: this.heroSpr, y: this.G + 26, alpha: 0,
        scale: this.heroSpr.scale * 0.78, duration: 760, ease: 'Sine.easeIn' });
      this.tweens.add({ targets: this.heroShadow, alpha: 0, duration: 500 });
      this.time.delayedCall(900, function () { self.stageCleared(); });
    } else {
      this.tweens.add({ targets: [this.heroSpr, this.heroShadow], alpha: 0, duration: 380 });
      this.time.delayedCall(420, function () {
        self.closeGateDoors();
        SG.Audio.sfx('ding');
      });
      this.time.delayedCall(1150, function () { self.stageCleared(); });
    }
    if (this.hatSpr) this.tweens.add({ targets: [this.hatSpr, this.hatProp], alpha: 0, duration: 380 });
  },

  /* Плашка с итогом этапа. Экран гаснет, под ним меняются декорации,
   * а следующий уровень ждёт нажатия: это единственная пауза за забег,
   * и торопить тут некуда — пусть счёт успеют прочитать. */
  stageCleared: function () {
    var self = this, C = SG.CFG, W = this.W, H = this.H;
    var zone = C.zones[this.zoneIdx];
    this.gateStep = 'panel';

    var veil = this.add.rectangle(0, 0, W, H, 0x0d0a16, 1).setOrigin(0).setDepth(40).setAlpha(0);
    this.tweens.add({
      targets: veil, alpha: 1, duration: 400,
      onComplete: function () { self.showStagePanel(veil, zone); }
    });
  },

  showStagePanel: function (veil, zone) {
    var self = this, C = SG.CFG, W = this.W, H = this.H;
    var gained = Math.round(this.score) - this.lap.score;
    var killed = this.kills - this.lap.kills;
    var walked = Math.round(this.meters - this.lap.meters);
    var next = C.zones[Math.min(this.zoneIdx + 1, C.zones.length - 1)];

    SG.Audio.sfx('stage');

    var stats = '+' + gained + ' ' + SG.plural(gained, ['очко', 'очка', 'очков']) +
                '   ·   ' + killed + ' ' + SG.plural(killed, SG.CFG.foe) +
                '   ·   ' + walked + ' м';
    var rule = Math.min(W - 80, 340);

    var items = [
      SG.txt(this, W / 2, H / 2 - 46, zone.cleared, 28, '#f5c542'),
      SG.txt(this, W / 2, H / 2 - 16, zone.sub, 14, '#c9c3dd', { light: true, strokeThickness: 3 }),
      this.add.rectangle(W / 2, H / 2 + 2, rule, 1, 0xf5c542, 0.45),
      SG.txt(this, W / 2, H / 2 + 20, stats, 14, '#7de8ff', { strokeThickness: 3 }),
      SG.txt(this, W / 2, H / 2 + 50, 'ДАЛЬШЕ: ' + next.name, 15, '#f2e9d8')
    ];
    items.forEach(function (t, i) {
      t.setDepth(41).setAlpha(0);
      self.tweens.add({ targets: t, alpha: 1, duration: 240, delay: i * 100 });
    });

    // пока темно — переставляем декорации и уводим Серёгу за левый край
    this.destroyGate();
    this.setZone(this.zoneIdx + 1);
    this.lap = { score: Math.round(this.score), kills: this.kills, meters: this.meters };

    // кнопка загорается не сразу: тап, которым только что играли,
    // не должен проскочить плашку насквозь
    this.time.delayedCall(C.level.continueMs, function () {
      items.push(self.button(C.level.continueLabel, self.H / 2 + 92, function () {
        items.forEach(function (t) { t.destroy(); });
        self.resumeRun();
        self.tweens.add({
          targets: veil, alpha: 0, duration: 500,
          onComplete: function () { veil.destroy(); }
        });
      }));
    });
  },

  /* Мигающая кнопка поверх всего. Пока не нажали — игра не идёт дальше.
   *
   * Нажатие ловится по всему экрану, а не только по рамке: попадать
   * пальцем в кнопку на телефоне неудобно, да и привычка от титульного
   * экрана ровно такая. Прыжок при этом не срабатывает — и на плашке, и
   * на паузе управление глухое.
   *
   * Подписка встаёт только после того, как кнопка проявилась: тап,
   * которым игрок только что играл, не должен проскочить её насквозь. */
  button: function (label, y, onPress) {
    var self = this;
    var txt = SG.txt(this, 0, 0, label, 16, '#f5c542');
    var bw = Math.max(160, txt.width + 48), bh = 34;

    var frame = this.add.graphics();
    frame.fillStyle(0x171223, 0.92);
    frame.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 9);
    frame.lineStyle(2, 0xf5c542, 1);
    frame.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 9);

    var btn = this.add.container(this.W / 2, y).setDepth(42).setAlpha(0).setScale(0.9);
    btn.add([frame, txt]);

    var blink = null, kb = this.input.keyboard, armed = false;
    var press = function () {
      if (!armed) return;
      // снимаем всё сразу: сработать должно ровно один раз, а лишние
      // подписки иначе доживут до конца забега
      self.input.off('pointerdown', press);
      kb.off('keydown-SPACE', press);
      kb.off('keydown-ENTER', press);
      if (blink) blink.stop();
      btn.setAlpha(1);
      SG.Audio.sfx('select');
      onPress();
    };

    this.tweens.add({
      targets: btn, alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut',
      onComplete: function () {
        armed = true;
        blink = self.tweens.add({
          targets: btn, alpha: 0.35, duration: 620, yoyo: true, repeat: -1
        });
      }
    });

    this.input.on('pointerdown', press);
    kb.on('keydown-SPACE', press);
    kb.on('keydown-ENTER', press);
    return btn;
  },

  resumeRun: function () {
    var self = this;
    this.gateStep = '';
    this.gateStarted = false;
    this.phase = 'run';

    // Серёга вбегает слева
    this.heroFrozen = false;
    this.hero.y = this.G; this.hero.vy = 0; this.hero.onGround = true; this.hero.jumps = 0;
    this.hero.invulnUntil = 0; this.hero.hurtUntil = 0;
    this.heroSpr.setAlpha(1).setScale(this.heroBaseScale);
    this.heroShadow.setAlpha(0.35);
    if (this.hatSpr) { this.hatSpr.setAlpha(1); this.hatProp.setAlpha(1); }

    this.heroX = -70;
    this.tweens.add({
      targets: this, heroX: this.heroHomeX, duration: 900, ease: 'Sine.easeOut'
    });

    this.scroll = this.speed * (this.gift.hatOn ? SG.CFG.hat.speedMul : 1);
    this.spawnTimer = 1.6;
    this.banner(SG.CFG.zones[this.zoneIdx].name, '');
  },

  /* =====================================================================
   *  БОСС
   * ===================================================================== */

  startBoss: function () {
    var self = this;
    this.phase = 'bossIntro';
    this.introT = 0;

    // убираем всё, что не долетело
    this.clearEnts(false);

    // шапка донесла до босса — дальше он сам
    this.dropHat();

    SG.Audio.stopMusic();
    SG.Audio.music('boss');

    // выходит из подъезда и загораживает дверь
    var doorX = this.doorX();
    this.bossBaseX = Math.round(doorX - 130);
    this.bossSpr = this.add.sprite(doorX, this.G, 'boss_idle')
      .setOrigin(0.5, 1).setDepth(11);
    SG.Art.fit(this.bossSpr, 'boss_idle');
    this.boss = {
      x: doorX, hp: SG.CFG.boss.hp, maxHp: SG.CFG.boss.hp,
      st: 'enter', t: 0, shots: 0, hitFlash: 0, vulnerable: false
    };
    this.time.delayedCall(1100, function () { self.closeGateDoors(); });

    this.bossBarBg = this.add.rectangle(this.W / 2, 30, 260, 12, 0x171223, 0.75).setDepth(30).setAlpha(0);
    this.bossBar = this.add.rectangle(this.W / 2 - 128, 30, 256, 8, 0xe04b4b).setOrigin(0, 0.5).setDepth(30).setAlpha(0);
    this.bossName = SG.txt(this, this.W / 2, 48, SG.CFG.bossName, 12, '#ffb3a6', { strokeThickness: 3 })
      .setDepth(30).setAlpha(0);

    this.banner('БОСС', SG.CFG.bossName);
    this.time.delayedCall(500, function () {
      self.tweens.add({ targets: [self.bossBarBg, self.bossBar, self.bossName], alpha: 1, duration: 400 });
    });
  },

  updateBossIntro: function (dt) {
    this.introT += dt;
    this.scroll = Math.max(0, this.scroll - 700 * dt);

    var b = this.boss;
    b.x += (this.bossBaseX - b.x) * Math.min(1, dt * 2.6);
    this.bossSpr.x = b.x;

    if (this.scroll <= 1 && Math.abs(b.x - this.bossBaseX) < 4) {
      this.scroll = 0;
      b.x = this.bossBaseX;
      b.st = 'idle'; b.t = 0;
      this.phase = 'boss';
      this.bossSay();
    }
  },

  /* Реплика босса — в той же плашке, что у зомби-клиентов и у Серёги.
   *
   * Он один говорил всплывающим текстом и выбивался из общего вида.
   * Всплывающий текст в игре остаётся, но только для отклика на действия
   * и подсказок — «+МЕДИАТОР», названия аккордов, «ХВАТАЙ ШАПКУ»;
   * речь персонажей везде в плашках. */
  bossSay: function () {
    var self = this, L = SG.CFG.bossLines;
    if (this.bossBubble) this.bossBubble.destroy();

    var b = this.bubble(this.boss.x, this.G - 172,
      L[Math.floor(Math.random() * L.length)]).setDepth(20);
    this.bossBubble = b;
    this.tweens.add({
      targets: b, alpha: 0, y: b.y - 14, delay: 2100, duration: 700,
      onComplete: function () {
        b.destroy();
        if (self.bossBubble === b) self.bossBubble = null;
      }
    });
  },

  dropBossBubble: function () {
    if (!this.bossBubble) return;
    this.bossBubble.destroy();
    this.bossBubble = null;
  },

  spawnShot: function (high) {
    var y = high ? this.G - 70 : this.G - 26;
    var spr = this.add.sprite(this.boss.x - 40, y, high ? 'card_fly' : 'card_blue')
      .setOrigin(0.5, 0.5).setDepth(10);
    SG.Art.fit(spr, spr.texture.key, 0.85);
    this.addEnt({
      kind: 'shot', obj: spr, x: this.boss.x - 40, cy: y,
      hw: 26, hh: 18, vx: high ? -330 : -390,
      smashable: !!high, spin: high ? 1 : -1
    });
  },

  bossHit: function (dmg) {
    var b = this.boss;
    b.hp -= dmg;
    b.hitFlash = 180;
    SG.Audio.sfx('bossHit');
    this.burst(b.x, this.G - 70, 'fx_sparkc', 12);
    this.cameras.main.shake(160, 0.01);
    this.addScore(120);
    this.bossBar.width = 256 * Math.max(0, b.hp / b.maxHp);
    if (b.hp <= 0) this.bossDie();
  },

  updateBoss: function (dt) {
    var b = this.boss, C = SG.CFG.boss, now = this.time.now;
    b.t += dt * 1000;
    if (b.hitFlash > 0) b.hitFlash -= dt * 1000;

    // затянулось и HP почти не тронуто — Геос присылает дракона
    this.bossElapsed += dt;
    if (!this.gift.dragonOffered &&
        this.bossElapsed > SG.CFG.dragon.stallSec &&
        b.hp > b.maxHp * SG.CFG.dragon.stallHpFrac) {
      this.offerDragon();
    }
    if (this.gift.dragonOffered && !this.gift.dragonUsed &&
        this.dragonDeadline && now > this.dragonDeadline) {
      this.dragonFinish();
      return;
    }

    var atk = now < this.hero.attackUntil;
    var inRange = Math.abs(b.x - this.heroX) < SG.CFG.run.attackRange + 60;

    switch (b.st) {
      case 'idle':
        if (b.t > 700) { b.st = Math.random() < 0.55 ? 'volley' : 'charge'; b.t = 0; b.shots = 0; }
        break;

      case 'volley':
        if (b.shots < 3 && b.t > b.shots * C.volleyGapMs) {
          this.spawnShot(b.shots % 2 === 1);
          b.shots++;
        }
        if (b.t > 3 * C.volleyGapMs + 400) { b.st = 'idle'; b.t = 0; this.bossSay(); }
        break;

      case 'charge':                                   // подходит вплотную
        b.x += (this.heroX + 130 - b.x) * Math.min(1, dt * 3.4);
        if (atk && inRange) { this.bossHit(2); b.st = 'retreat'; b.t = 0; break; }
        if (Math.abs(b.x - (this.heroX + 130)) < 8) {
          b.st = 'windup'; b.t = 0;
          SG.Audio.sfx('warn');
        }
        break;

      case 'windup':                                   // окно, когда его можно бить
        if (atk && inRange) { this.bossHit(2); b.st = 'retreat'; b.t = 0; break; }
        if (b.t > C.windupMs) { b.st = 'swing'; b.t = 0; }
        break;

      case 'swing':
        if (b.t < 40) {
          // мах: спасает только прыжок
          if (this.hero.y > this.G - 74) this.hurt();
          this.burst(this.heroX + 60, this.G - 40, 'fx_spark', 8);
          this.cameras.main.shake(180, 0.01);
        }
        if (b.t > C.swingMs) { b.st = 'retreat'; b.t = 0; }
        break;

      case 'retreat':
        b.x += (this.bossBaseX - b.x) * Math.min(1, dt * 3.2);
        if (Math.abs(b.x - this.bossBaseX) < 6) { b.x = this.bossBaseX; b.st = 'idle'; b.t = 0; }
        break;
    }

    this.bossSpr.x = b.x;
    if (this.bossBubble) this.bossBubble.x = b.x;
    var tex = 'boss_idle';
    if (b.hitFlash > 0) tex = 'boss_hurt';
    else if (b.st === 'windup' || b.st === 'charge') tex = 'boss_windup';
    else if (b.st === 'swing') tex = 'boss_swing';
    this.bossSpr.setTexture(tex);
    this.bossSpr.y = this.G + (b.st === 'windup' ? Math.sin(b.t / 40) * 2 : 0);
  },

  bossDie: function () {
    var self = this;
    this.phase = 'outro';
    this.boss.st = 'dead';
    this.dropBossBubble();

    SG.Audio.stopMusic();
    SG.Audio.sfx('win');

    this.clearEnts(false);

    this.tweens.add({ targets: [this.bossBarBg, this.bossBar, this.bossName], alpha: 0, duration: 400 });
    this.cameras.main.shake(500, 0.016);
    this.cameras.main.flash(400, 255, 255, 255);

    var b = this.bossSpr;
    for (var k = 0; k < 14; k++) this.burst(this.boss.x, this.G - 60 - k * 4, k % 2 ? 'fx_spark' : 'fx_sparkc', 4);
    this.tweens.add({
      targets: b, angle: 92, y: this.G + 10, alpha: 0, duration: 1100,
      onComplete: function () { b.destroy(); }
    });

    this.banner('ВСЁ, Я НА ВЫХОДНЫХ', 'спринт закрыт');
    this.time.delayedCall(400, function () { SG.Audio.music('run'); });
    this.time.delayedCall(1500, function () { self.goHome(); });
  },

  /* Дверь свободна: Серёга доходит до подъезда и заходит внутрь */
  goHome: function () {
    var self = this, g = this.gate;
    this.openGateDoors();

    var target = g ? this.doorX() : this.W + 90;
    var dist = Math.abs(target - this.heroX);
    this.tweens.add({
      targets: this, heroX: target, duration: Math.max(700, dist * 2.2), ease: 'Sine.easeIn',
      delay: 350,
      onComplete: function () {
        self.heroFrozen = true;
        self.heroSpr.setTexture('hero_idle');
        self.tweens.add({ targets: [self.heroSpr, self.heroShadow], alpha: 0, duration: 420 });
        self.time.delayedCall(520, function () {
          self.closeGateDoors();
          self.finish();
        });
      }
    });
  },

  finish: function () {
    var self = this;
    var veil = this.add.rectangle(0, 0, this.W, this.H, 0x0d0a16, 1)
      .setOrigin(0).setDepth(40).setAlpha(0);
    this.tweens.add({
      targets: veil, alpha: 1, duration: 700,
      onComplete: function () {
        SG.state.score = Math.round(self.score);
        SG.state.meters = Math.round(self.meters);
        SG.state.kills = self.kills;
        SG.state.saveBest(Math.round(self.score));
        SG.state.markWon();
        SG.Audio.stopMusic();
        self.scene.start('Victory');
      }
    });
  }
});
