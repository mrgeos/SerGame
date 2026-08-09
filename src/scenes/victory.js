/* Финал: Серёга дома. */
window.SG = window.SG || {};

SG.VictoryScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function VictoryScene() { Phaser.Scene.call(this, { key: 'Victory' }); },

  create: function () {
    SG.setupCamera(this);
    var W = SG.VIEW.W, H = SG.VIEW.H, S = SG.VIEW.SCALE;
    var FLOOR = 300;
    var C = SG.CFG, st = SG.state;
    var self = this;

    this.buildRoom(W, H, FLOOR);

    // Серёга вбегает слева
    this.hero = SG.Art.fit(
      this.add.sprite(-50, FLOOR, 'hero_run0').setOrigin(0.5, 1).setDepth(12), 'hero_run0');
    this.runT = 0; this.running = true;
    this.tweens.add({
      targets: this.hero, x: Math.round(W * 0.34), duration: 1500, ease: 'Sine.easeOut',
      onComplete: function () {
        self.running = false;
        self.hero.setTexture('hero_idle');   // дома вспышка от аккорда ни к чему
        SG.Audio.init();
        SG.Audio.sfx('select');
      }
    });

    // Стол с тортом
    var tx = Math.round(W * 0.56);
    this.add.rectangle(tx, FLOOR, 130, 10, 0x7a5330).setOrigin(0.5, 1).setDepth(9);
    this.add.rectangle(tx - 48, FLOOR + 0, 10, 46, 0x553719).setOrigin(0.5, 0).setDepth(8);
    this.add.rectangle(tx + 48, FLOOR + 0, 10, 46, 0x553719).setOrigin(0.5, 0).setDepth(8);
    this.cake = SG.Art.fit(this.add.image(tx, FLOOR - 10, 'cake')
      .setOrigin(0.5, 1).setDepth(10).setAlpha(0), 'cake', 0.45);
    this.tweens.add({ targets: this.cake, alpha: 1, y: FLOOR - 10, duration: 500, delay: 900 });

    // Жена и дочка
    this.wife = SG.Art.fit(this.add.image(Math.round(W * 0.74), FLOOR, 'wife')
      .setOrigin(0.5, 1).setDepth(11).setAlpha(0), 'wife');
    this.daughter = SG.Art.fit(this.add.image(Math.round(W * 0.86), FLOOR, 'daughter')
      .setOrigin(0.5, 1).setDepth(11).setAlpha(0), 'daughter');
    this.tweens.add({ targets: [this.wife, this.daughter], alpha: 1, duration: 400, delay: 500 });
    this.tweens.add({ targets: this.daughter, y: FLOOR - 12, duration: 380, yoyo: true, repeat: -1,
      delay: 900, ease: 'Sine.easeInOut' });

    if (C.wife) {
      SG.txt(this, this.wife.x, FLOOR + 16, '{WIFE}', 12, '#f2e9d8', { strokeThickness: 3 }).setDepth(24);
    }
    if (C.daughter) {
      SG.txt(this, this.daughter.x, FLOOR + 16, '{DAUGHTER}', 12, '#f2e9d8', { strokeThickness: 3 }).setDepth(24);
    }
    // подпись героя ставим сразу в конечную точку — он до неё ещё бежит
    var heroLabel = SG.txt(this, Math.round(W * 0.34), FLOOR + 16, '{HERO}', 12, '#f5c542',
      { strokeThickness: 3 }).setDepth(24).setAlpha(0);
    this.tweens.add({ targets: heroLabel, alpha: 1, duration: 300, delay: 1500 });

    this.confetti = [];
    this.time.delayedCall(1300, function () { self.showFinale(); });

    this.time.delayedCall(1600, function () { SG.Audio.sfx('win'); });
  },

  buildRoom: function (W, H, FLOOR) {
    this.add.rectangle(0, 0, W, FLOOR, 0x5b4a6b).setOrigin(0).setDepth(0);        // стена
    this.add.rectangle(0, FLOOR, W, H - FLOOR, 0x6b4a33).setOrigin(0).setDepth(1); // пол
    this.add.rectangle(0, FLOOR - 6, W, 6, 0x4a3226).setOrigin(0).setDepth(2);     // плинтус

    // обои в полоску
    for (var x = 0; x < W; x += 26) {
      this.add.rectangle(x, 0, 10, FLOOR - 6, 0x66537a).setOrigin(0).setDepth(0).setAlpha(0.5);
    }
    // окно с вечером
    var wx = Math.round(W * 0.14);
    this.add.rectangle(wx, 46, 96, 84, 0x3b3560).setOrigin(0.5, 0).setDepth(1);
    this.add.rectangle(wx, 50, 88, 76, 0x2b2545).setOrigin(0.5, 0).setDepth(1);
    this.add.circle(wx + 24, 76, 11, 0xf2e9d8).setDepth(1);
    for (var s = 0; s < 8; s++) {
      this.add.circle(wx - 38 + (s * 13) % 84, 60 + (s * 29) % 60, 1.5, 0xffffff, 0.8).setDepth(1);
    }
    this.add.rectangle(wx, 46, 96, 6, 0x4a3226).setOrigin(0.5, 0).setDepth(2);
    this.add.rectangle(wx - 3, 46, 6, 84, 0x4a3226).setOrigin(0, 0).setDepth(2);

    // ковёр
    this.add.ellipse(Math.round(W * 0.45), FLOOR + 26, 320, 40, 0x8c5a5a, 0.55).setDepth(2);

    // гирлянда
    for (var g = 0; g < 14; g++) {
      var gx = 20 + g * ((W - 40) / 13);
      var gy = 14 + Math.sin(g * 0.7) * 8;
      this.add.circle(gx, gy, 4, [0xf5c542, 0xe04b4b, 0x4fb06a, 0x7de8ff][g % 4]).setDepth(23);
    }
  },

  showFinale: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H;
    var C = SG.CFG, st = SG.state;
    var self = this;

    this.add.rectangle(0, 0, W, H, 0x171223, 0.45).setOrigin(0).setDepth(20);

    var title = SG.txt(this, W / 2, 62, C.finale.title, 28, '#f5c542').setDepth(21).setScale(0.6);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, y: 58, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    C.finale.lines.forEach(function (l, i) {
      var t = SG.txt(self, W / 2, 104 + i * 22, l, 14, '#f2e9d8', { strokeThickness: 3 })
        .setDepth(21).setAlpha(0);
      self.tweens.add({ targets: t, alpha: 1, duration: 340, delay: 250 + i * 220 });
    });

    // Кроме поздравления и статистики на финале ничего не пишем: экран
    // и так самый нагруженный за забег, а смотреть тут надо на торт.
    var sy = 104 + C.finale.lines.length * 22 + 18;
    SG.txt(this, W / 2, sy, 'СЧЁТ ' + st.score + '   ·   ' + st.meters + ' м   ·   ' + st.kills + ' ' +
      SG.plural(st.kills, SG.CFG.foe),
      13, '#7de8ff', { strokeThickness: 3 }).setDepth(21);

    var hint = SG.txt(this, W / 2, H - 12, 'ТАП — ПОБЕЖАТЬ ЕЩЁ РАЗ', 15, '#c9c3dd').setDepth(21);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.time.delayedCall(900, function () {
      self.input.once('pointerdown', function () { SG.Audio.sfx('select'); self.scene.start('Menu'); });
      self.input.keyboard.once('keydown-SPACE', function () { self.scene.start('Menu'); });
    });

    this.confettiOn = true;
  },

  update: function (time, delta) {
    var d = delta / 1000;
    if (this.running) {
      this.runT += d;
      this.hero.setTexture('hero_run' + (Math.floor(this.runT * 12) % 4));
    }

    if (!this.confettiOn) return;
    var W = SG.VIEW.W, H = SG.VIEW.H;

    if (this.confetti.length < 60 && Math.random() < 0.6) {
      var cols = [0xf5c542, 0xe04b4b, 0x4fb06a, 0x7de8ff, 0xf2a8c0];
      var r = this.add.rectangle(Math.random() * W, -10, 5, 9,
        cols[Math.floor(Math.random() * cols.length)]).setDepth(22);
      r.vy = 40 + Math.random() * 70;
      r.vx = (Math.random() - 0.5) * 50;
      r.spin = (Math.random() - 0.5) * 8;
      this.confetti.push(r);
    }
    for (var i = this.confetti.length - 1; i >= 0; i--) {
      var c = this.confetti[i];
      c.y += c.vy * d;
      c.x += Math.sin(c.y / 26) * 22 * d + c.vx * d;
      c.rotation += c.spin * d;
      if (c.y > H + 14) { c.destroy(); this.confetti.splice(i, 1); }
    }
  }
});
