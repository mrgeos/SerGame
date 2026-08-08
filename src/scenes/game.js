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
    this.pickupTimer = 16;
    this.zoneIdx = 0;
    this.ents = [];
    this.paused = false;

    // подгоны от Геоса: выдаются один раз за забег
    this.gift = { hatOffered: false, hatOn: false, dragonOffered: false, dragonUsed: false };
    this.cinematic = false;
    this.bossElapsed = 0;

    this.buildWorld();
    this.buildHero();
    this.buildHud();
    this.bindInput();

    SG.Audio.init();
    SG.Audio.music('run');

    this.banner('ПЯТНИЦА, 18:59', C.intro[1]);

    var self = this;
    this.events.on('shutdown', function () { self.input.keyboard.removeAllListeners(); });
  },

  buildWorld: function () {
    var W = this.W, H = this.H, G = this.G;
    this.zones = [];
    for (var i = 0; i < 4; i++) {
      var z = {
        sky:  this.add.image(0, 0, 'sky' + i).setOrigin(0).setDisplaySize(W, H).setDepth(0),
        far:  this.add.tileSprite(0, G - 220, W, 220, 'bg' + i + '_far').setOrigin(0).setDepth(1),
        near: this.add.tileSprite(0, G - 220, W, 220, 'bg' + i + '_near').setOrigin(0).setDepth(2),
        gnd:  this.add.tileSprite(0, G, W, H - G, 'ground' + i).setOrigin(0).setDepth(3)
      };
      var a = i === 0 ? 1 : 0;
      z.sky.setAlpha(a); z.far.setAlpha(a); z.near.setAlpha(a); z.gnd.setAlpha(a);
      this.zones.push(z);
    }
    // тёмная виньетка снизу, чтобы персонажи читались
    this.add.rectangle(0, G, W, H - G, 0x171223, 0.18).setOrigin(0).setDepth(4);
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

  doJump: function () {
    if (this.phase === 'dead' || this.phase === 'outro' || this.cinematic) return;
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
    if (this.phase === 'dead' || this.phase === 'outro' || this.cinematic) return;
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
    else if (this.phase === 'bossIntro') this.updateBossIntro(dt);
    else if (this.phase === 'boss' && !this.cinematic) this.updateBoss(dt);
    else if (this.phase === 'outro') this.updateOutro(dt);

    this.updateHero(dt);
    this.updateHat(dt);
    this.updateEnts(dt);
    this.updateScroll(dt);
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

    this.checkZone();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPattern();
      var prog = Math.min(1, this.meters / C.run.bossAtMeters);
      this.spawnTimer = (0.95 - 0.32 * prog) + Math.random() * 0.55;
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.spawnPickup();
      this.pickupTimer = 15 + Math.random() * 9;
    }

    if (this.gift.hatOffered && !this.gift.hatWorn && this.hatDeadline &&
        this.time.now > this.hatDeadline) {
      this.wearHat();
    }

    if (this.meters >= C.run.bossAtMeters) this.startBoss();
  },

  updateHero: function (dt) {
    var h = this.hero, C = SG.CFG.run, now = this.time.now;

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

    // мигание в неуязвимости
    this.heroSpr.setAlpha(now < h.invulnUntil ? (Math.floor(now / 70) % 2 ? 0.35 : 1) : 1);

    // режим «шред» — золотая аура
    var shred = now < this.shredUntil;
    this.heroSpr.setTint(shred ? 0xffe08a : 0xffffff);

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
      var say = SG.txt(this, x, G - 82, SG.CFG.taunts[Math.floor(Math.random() * SG.CFG.taunts.length)],
        11, '#c8f0a0', { strokeThickness: 3 }).setDepth(11);
      e.say = say;
    }
    return e;
  },

  spawnPickup: function (kind) {
    if (!kind) kind = (this.lives < SG.CFG.run.lives && Math.random() < 0.65) ? 'life' : 'coffee';
    var y = this.G - 118;
    var spr = this.add.sprite(this.W + 60, y, kind === 'life' ? 'pick_life' : 'pick_coffee')
      .setOrigin(0.5, 0.5).setDepth(10);
    SG.Art.fit(spr, spr.texture.key);
    return this.addEnt({ kind: 'pickup', sub: kind, obj: spr, x: this.W + 60, cy: y, hw: 22, hh: 22, vx: 0, baseY: y, t: 0 });
  },

  spawnPattern: function () {
    var W = this.W, x0 = W + 60;
    var C = SG.CFG;
    var prog = Math.min(1, this.meters / C.run.bossAtMeters);
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
    // шапка-дурилка работает как бесконечный «шред»: сносит всё телом
    var shred = now < this.shredUntil || this.gift.hatOn;
    var C = SG.CFG.run;

    var hx = this.heroX, hcy = this.hero.y - 32, hhw = 15, hhh = 30;
    var ax = hx + 4 + C.attackRange / 2, acy = this.hero.y - 38, ahw = C.attackRange / 2, ahh = 40;

    for (var i = this.ents.length - 1; i >= 0; i--) {
      var e = this.ents[i];
      e.t = (e.t || 0) + dt;
      e.x += (e.vx - this.scroll) * dt;
      e.obj.x = e.x;

      if (e.kind === 'flyer') {
        e.cy = e.baseY + Math.sin(e.t * 4) * 8;
        e.obj.y = e.cy;
      } else if (e.kind === 'pickup') {
        e.cy = e.baseY + Math.sin(e.t * 3) * 7;
        e.obj.y = e.cy;
        e.obj.rotation = Math.sin(e.t * 2) * 0.25;
      } else if (e.kind === 'zombie') {
        e.obj.setTexture(Math.floor(e.t * 6) % 2 ? 'zombie1' : 'zombie0');
        if (e.say) { e.say.x = e.x; }
      } else if (e.kind === 'shot') {
        e.obj.rotation += dt * 6 * (e.spin || 1);
      }

      if (e.x < -140) { this.killEnt(e, i, false); continue; }

      // удар аккордом
      if ((atk || shred) && e.smashable !== false && e.kind !== 'pickup') {
        var inAtk = shred
          ? (Math.abs(e.x - hx) < e.hw + 34 && Math.abs(e.cy - hcy) < e.hh + hhh)
          : (Math.abs(e.x - ax) < e.hw + ahw && Math.abs(e.cy - acy) < e.hh + ahh);
        if (inAtk) { this.smash(e, i); continue; }
      }

      // столкновение с героем
      if (Math.abs(e.x - hx) < e.hw + hhw && Math.abs(e.cy - hcy) < e.hh + hhh) {
        if (e.kind === 'pickup') { this.takePickup(e, i); continue; }
        if (shred) { this.smash(e, i); continue; }
        this.hurt();
        if (e.kind !== 'card') this.killEnt(e, i, true);
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
    if (fx) this.puff(e.x, e.cy, 5);
    if (e.say) e.say.destroy();
    e.obj.destroy();
    if (idx === undefined) idx = this.ents.indexOf(e);
    if (idx >= 0) this.ents.splice(idx, 1);
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
      this.shredUntil = this.time.now + 6000;
      SG.Audio.sfx('coffee');
      this.floatText(e.x, e.cy - 20, 'РЕЖИМ ШРЕД!', '#ffb3a6');
      this.cameras.main.flash(160, 255, 220, 140);
    }
    this.refreshLives();
    this.burst(e.x, e.cy, 'fx_spark', 10);
    this.killEnt(e, idx, false);
  },

  hurt: function () {
    var now = this.time.now;
    if (this.phase === 'dead') return;
    if (now < this.hero.invulnUntil) return;
    if (this.gift.hatOn || this.cinematic) return;      // в шапке-дурилке урона нет
    // Геос уже написал — добить до того, как подгон дойдёт, не дадим,
    // иначе вся страховка бессмысленна
    if (this.gift.hatOffered && !this.gift.hatWorn) return;
    if (this.gift.dragonOffered && !this.gift.dragonUsed) return;

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

  checkZone: function () {
    var zs = SG.CFG.zones;
    var idx = 0;
    for (var i = 0; i < zs.length; i++) { if (this.meters >= zs[i].until) idx = i + 1; }
    idx = Math.min(idx, this.zones.length - 1);
    if (idx === this.zoneIdx) return;

    var from = this.zones[this.zoneIdx], to = this.zones[idx];
    this.zoneIdx = idx;
    this.tweens.add({ targets: [from.sky, from.far, from.near, from.gnd], alpha: 0, duration: 900 });
    this.tweens.add({ targets: [to.sky, to.far, to.near, to.gnd], alpha: 1, duration: 900 });
    this.banner(zs[idx].name, '');
  },

  updateHud: function () {
    this.scoreTxt.setText(String(Math.round(this.score)));
    this.metersTxt.setText(Math.round(this.meters) + ' м');
    var prog = Phaser.Math.Clamp(this.meters / SG.CFG.run.bossAtMeters, 0, 1);
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

  /* Уведомление в духе мессенджера, выезжает сверху */
  geosMessage: function (text, holdMs) {
    var W = this.W;
    var w = Math.min(W - 48, 470);
    var msg = SG.txt(this, 0, 0, text, 13, '#f2e9d8',
      { originX: 0, originY: 0, strokeThickness: 3, align: 'left', wrap: w - 78 });
    var h = Math.max(56, msg.height + 34);

    var card = this.add.graphics();
    card.fillStyle(0x171223, 0.94);
    card.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    card.lineStyle(2, 0xf5c542, 0.95);
    card.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    var av = this.add.image(-w / 2 + 30, 0, 'geos').setScale(2);
    var name = SG.txt(this, -w / 2 + 56, -h / 2 + 9, SG.CFG.geos.name, 13, '#f5c542',
      { originX: 0, originY: 0, strokeThickness: 3 });
    msg.setPosition(-w / 2 + 56, -h / 2 + 27);

    var box = this.add.container(W / 2, -h).setDepth(35);
    box.add([card, av, name, msg]);

    SG.Audio.sfx('msg');
    this.tweens.add({
      targets: box, y: h / 2 + 14, duration: 380, ease: 'Back.easeOut',
      hold: holdMs || 2400, yoyo: true,
      onComplete: function () { box.destroy(); }
    });
  },

  /* Реплика героя в пузыре */
  say: function (text, ms) {
    var x = this.heroX + 30, y = this.hero.y - 104;
    var t = SG.txt(this, 0, 0, text, 14, '#171223',
      { originX: 0.5, originY: 0.5, strokeThickness: 0 });
    var w = t.width + 22, h = t.height + 16;

    var g = this.add.graphics();
    g.fillStyle(0xf2e9d8, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillTriangle(-10, h / 2 - 1, 2, h / 2 - 1, -12, h / 2 + 12);

    var box = this.add.container(x, y).setDepth(34).setScale(0.5).setAlpha(0);
    box.add([g, t]);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.time.delayedCall(ms || 1500, function () {
      box.destroy();
    });
    return box;
  },

  offerHat: function () {
    var self = this, C = SG.CFG;
    this.gift.hatOffered = true;

    this.geosMessage(C.geos.hatMsg, 2600);

    // расчищаем полосу: и то, что уже летит, и ближайшие спавны
    for (var i = this.ents.length - 1; i >= 0; i--) {
      if (this.ents[i].kind !== 'pickup') this.killEnt(this.ents[i], i, true);
    }
    this.spawnTimer = Math.max(this.spawnTimer, C.hat.clearLaneSec);
    // страховка: если шапку каким-то чудом не подобрали — надеваем сами
    this.hatDeadline = this.time.now + C.hat.spawnDelayMs + 9000;

    this.time.delayedCall(C.hat.spawnDelayMs, function () {
      if (self.phase !== 'run' || self.gift.hatOn) return;
      // на уровне головы и с щедрым хитбоксом — промахнуться нельзя,
      // иначе вся страховка теряет смысл
      var y = self.G - 72;
      var spr = self.add.sprite(self.W + 60, y, 'pick_hat')
        .setOrigin(0.5, 0.5).setDepth(10);
      SG.Art.fit(spr, 'pick_hat');
      self.tweens.add({ targets: spr, angle: 12, duration: 500, yoyo: true, repeat: -1 });
      self.addEnt({
        kind: 'pickup', sub: 'hat', obj: spr, x: self.W + 60, cy: y,
        hw: 30, hh: 30, vx: 0, baseY: y, t: 0
      });
      self.floatText(self.W - 70, self.G - 150, C.geos.hatHint, '#f5c542');
      SG.Audio.sfx('whirr');
    });
  },

  wearHat: function () {
    var C = SG.CFG;
    this.gift.hatOn = true;
    this.gift.hatWorn = true;
    this.hero.invulnUntil = 0;                 // мигание больше не нужно

    // шапка едет на голове, пропеллер крутится отдельно
    this.hatSpr = this.add.image(this.heroX - 1, this.hero.y - 54, 'hat_worn')
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

  dropHat: function () {
    if (!this.gift.hatOn) return;
    this.gift.hatOn = false;
    var h = this.hatSpr, p = this.hatProp;
    this.hatSpr = null; this.hatProp = null;
    this.tweens.add({
      targets: [h, p], y: '-=60', x: '-=90', alpha: 0, angle: 200, duration: 900,
      onComplete: destroyTargets
    });
    this.floatText(this.heroX, this.G - 130, SG.CFG.geos.hatOff, '#c9c3dd');
  },

  updateHat: function (dt) {
    if (!this.gift.hatOn || !this.hatSpr) return;
    this.hatSpr.y = this.hero.y - 54;
    this.hatProp.y = this.hatSpr.y - this.hatSpr.displayHeight + 8;
    this.hatProp.rotation += dt * 26;

    // полосы скорости
    if (Math.random() < 0.6) {
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

    this.geosMessage(C.geos.dragonMsg, 2600);

    // сносим летящие таски, чтобы подгон было видно
    for (var i = this.ents.length - 1; i >= 0; i--) {
      if (this.ents[i].kind === 'shot') this.killEnt(this.ents[i], i, true);
    }
    // страховка: если дракона почему-то не подобрали — зовём сами
    this.dragonDeadline = this.time.now + 11000;

    this.time.delayedCall(1400, function () {
      if (self.phase !== 'boss' || self.gift.dragonUsed) return;
      var y = self.G - 75;
      var spr = self.add.sprite(self.W + 50, y, 'pick_dragon')
        .setOrigin(0.5, 0.5).setDepth(10);
      SG.Art.fit(spr, 'pick_dragon');
      self.addEnt({
        kind: 'pickup', sub: 'dragon', obj: spr, x: self.W + 50, cy: y,
        hw: 30, hh: 30, vx: -170, baseY: y, t: 0
      });
      self.floatText(self.W - 80, self.G - 160, C.geos.dragonHint, '#f5c542');
      SG.Audio.sfx('whirr');
    });
  },

  /* Дракон прилетает и заканчивает спор с боссом */
  dragonFinish: function () {
    var self = this, C = SG.CFG;
    this.gift.dragonUsed = true;
    this.cinematic = true;

    // сносим летящие таски, чтобы не мешали смотреть
    for (var i = this.ents.length - 1; i >= 0; i--) this.killEnt(this.ents[i], i, false);

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
   *  БОСС
   * ===================================================================== */

  startBoss: function () {
    var self = this;
    this.phase = 'bossIntro';
    this.introT = 0;

    // убираем всё, что не долетело
    for (var i = this.ents.length - 1; i >= 0; i--) this.killEnt(this.ents[i], i, false);

    // шапка донесла до босса — дальше он сам
    this.dropHat();

    SG.Audio.stopMusic();
    SG.Audio.music('boss');

    this.bossBaseX = Math.round(this.W * 0.74);
    this.bossSpr = this.add.sprite(this.W + 120, this.G, 'boss_idle')
      .setOrigin(0.5, 1).setDepth(12);
    SG.Art.fit(this.bossSpr, 'boss_idle');
    this.boss = {
      x: this.W + 120, hp: SG.CFG.boss.hp, maxHp: SG.CFG.boss.hp,
      st: 'enter', t: 0, shots: 0, hitFlash: 0, vulnerable: false
    };

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

  bossSay: function () {
    var L = SG.CFG.bossLines;
    this.floatText(this.boss.x, this.G - 150, L[Math.floor(Math.random() * L.length)], '#ffb3a6');
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
    this.outroT = 0;
    this.boss.st = 'dead';

    SG.Audio.stopMusic();
    SG.Audio.sfx('win');

    for (var i = this.ents.length - 1; i >= 0; i--) this.killEnt(this.ents[i], i, false);

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
  },

  updateOutro: function (dt) {
    this.outroT += dt;
    this.scroll = Math.min(420, this.scroll + 500 * dt);
    this.distPx += this.scroll * dt;
    this.meters = this.distPx / this.PX_PER_M;
    this.checkZone();

    if (this.outroT > 3.2) {
      SG.state.score = Math.round(this.score);
      SG.state.meters = Math.round(this.meters);
      SG.state.kills = this.kills;
      SG.state.usedHat = !!this.gift.hatWorn;
      SG.state.usedDragon = !!this.gift.dragonUsed;
      SG.state.saveBest(Math.round(this.score));
      SG.state.markWon();
      SG.Audio.stopMusic();
      this.scene.start('Victory');
    }
  }
});
