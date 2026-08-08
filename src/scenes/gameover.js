/* Экран поражения */
window.SG = window.SG || {};

SG.GameOverScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function GameOverScene() { Phaser.Scene.call(this, { key: 'GameOver' }); },

  create: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H;
    var st = SG.state;

    this.add.rectangle(0, 0, W, H, 0x171223, 0.82).setOrigin(0).setDepth(0);

    var lines = [
      'ТАСКИ ПОБЕДИЛИ',
      'МЕНЕДЖЕРЫ ЗАТЯНУЛИ НА СОЗВОН',
      'ТОРТ ОСТЫЛ',
      '{WIFE} УЖЕ ЗВОНИЛА',
      '{DAUGHTER} НЕ ЛОЖИТСЯ СПАТЬ'
    ];
    SG.txt(this, W / 2, 74, 'НЕ ДОШЁЛ', 40, '#e04b4b').setDepth(1);
    SG.txt(this, W / 2, 110, lines[Math.floor(Math.random() * lines.length)], 15, '#c9c3dd',
      { strokeThickness: 3 }).setDepth(1);

    SG.txt(this, W / 2, 158, 'СЧЁТ  ' + st.score, 24, '#f5c542').setDepth(1);
    SG.txt(this, W / 2, 186, 'пройдено ' + st.meters + ' м   ·   уложено ' + st.kills, 13, '#c9c3dd',
      { strokeThickness: 3 }).setDepth(1);
    SG.txt(this, W / 2, 210, 'лучший счёт: ' + st.best, 13, '#8b86a4', { strokeThickness: 3 }).setDepth(1);

    var hint = SG.txt(this, W / 2, H - 62, 'ТАП — ЕЩЁ РАЗ', 20, '#f2e9d8').setDepth(1);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 620, yoyo: true, repeat: -1 });
    SG.txt(this, W / 2, H - 34, 'дома всё ещё ждут', 12, '#8b86a4', { light: true, strokeThickness: 3 }).setDepth(1);

    var self = this;
    this.input.once('pointerdown', function () { self.again(); });
    this.input.keyboard.once('keydown-SPACE', function () { self.again(); });
    this.input.keyboard.once('keydown-ENTER', function () { self.again(); });
  },

  again: function () {
    SG.Audio.sfx('select');
    this.scene.start('Game');
  }
});
