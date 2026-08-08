/* Титульный экран */
window.SG = window.SG || {};

SG.MenuScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function MenuScene() { Phaser.Scene.call(this, { key: 'Menu' }); },

  create: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H, G = SG.VIEW.GROUND, S = SG.VIEW.SCALE;
    var C = SG.CFG;

    this.add.image(0, 0, 'sky1').setOrigin(0).setDisplaySize(W, H);
    this.far = this.add.tileSprite(0, G - 220, W, 220, 'bg1_far').setOrigin(0);
    this.near = this.add.tileSprite(0, G - 220, W, 220, 'bg1_near').setOrigin(0).setAlpha(0.9);
    this.gnd = this.add.tileSprite(0, G, W, H - G, 'ground1').setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x171223, 0.35).setOrigin(0);

    // Серёга бежит на месте
    this.hero = this.add.sprite(W * 0.5, G + 4, 'hero_run0').setOrigin(0.5, 1).setScale(S);
    this.t = 0;

    SG.txt(this, W / 2, 52, C.hero.toUpperCase(), 42, '#f5c542');
    SG.txt(this, W / 2, 88, 'СПЕШИТ ДОМОЙ', 22, '#f2e9d8');
    SG.txt(this, W / 2, 112, 'там торт', 14, '#c9c3dd', { light: true, strokeThickness: 3 });

    // Подсказка по управлению
    var hy = H - 46;
    SG.txt(this, W * 0.27, hy - 16, '◀ ЛЕВАЯ ПОЛОВИНА', 13, '#8de0ff', { strokeThickness: 3 });
    SG.txt(this, W * 0.27, hy + 2, 'ПРЫЖОК (можно двойной)', 12, '#c9c3dd', { light: true, strokeThickness: 3 });
    SG.txt(this, W * 0.73, hy - 16, 'ПРАВАЯ ПОЛОВИНА ▶', 13, '#ffb3a6', { strokeThickness: 3 });
    SG.txt(this, W * 0.73, hy + 2, 'АККОРД — БЬЁТ МЕНЕДЖЕРОВ', 12, '#c9c3dd', { light: true, strokeThickness: 3 });

    if (SG.state.best > 0) {
      SG.txt(this, W / 2, 136, 'ЛУЧШИЙ СЧЁТ: ' + SG.state.best, 14, '#c9c3dd', { strokeThickness: 3 });
    }
    if (SG.state.won) {
      SG.txt(this, W / 2, 156, 'ТОРТ УЖЕ БЫЛ СЪЕДЕН ✓', 12, '#7de8ff', { light: true, strokeThickness: 3 });
    }

    this.startHint = SG.txt(this, W / 2, 188, 'ТАП — ПОЕХАЛИ', 20, '#f5c542');
    this.tweens.add({ targets: this.startHint, alpha: 0.25, duration: 620, yoyo: true, repeat: -1 });

    this.makeMuteButton();

    var self = this;
    var go = function (p) {
      if (self.muteHit && p && p.x > W - 54 && p.y < 44) return;   // не стартуем по кнопке звука
      SG.Audio.init();
      SG.Audio.sfx('select');
      self.scene.start('Game');
    };
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown-SPACE', go);
    this.input.keyboard.on('keydown-ENTER', go);
  },

  makeMuteButton: function () {
    var W = SG.VIEW.W;
    var self = this;
    var label = function () { return SG.Audio.isMuted() ? '♪ ВЫКЛ' : '♪ ВКЛ'; };
    var btn = SG.txt(this, W - 12, 18, label(), 13, '#c9c3dd', { originX: 1, strokeThickness: 3 });
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', function (p, lx, ly, ev) {
      if (ev) ev.stopPropagation();
      self.muteHit = true;
      SG.Audio.init();
      SG.Audio.toggleMute();
      btn.setText(label());
      self.time.delayedCall(60, function () { self.muteHit = false; });
    });
  },

  update: function (time, delta) {
    var d = delta / 1000;
    this.t += d;
    this.far.tilePositionX += 18 * d;
    this.near.tilePositionX += 46 * d;
    this.gnd.tilePositionX += 150 * d;
    this.hero.setTexture('hero_run' + (Math.floor(this.t * 12) % 4));
  }
});
