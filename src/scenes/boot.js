/* Загрузка.
 *
 * Если положить картинки в assets/sprites/ и перечислить их ключи в
 * assets/sprites/manifest.json — они заменят нарисованный код-арт.
 */
window.SG = window.SG || {};

SG.BootScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },

  preload: function () {
    // Манифеста может не быть — это нормально, молча идём дальше.
    this.load.on('loaderror', function () {});
    this.load.json('sprite_manifest', 'assets/sprites/manifest.json');

    var W = SG.VIEW.W, H = SG.VIEW.H;
    var bar = this.add.rectangle(W / 2, H / 2, 220, 6, 0x3a3556).setOrigin(0.5);
    var fill = this.add.rectangle(W / 2 - 110, H / 2, 0, 6, 0xf5c542).setOrigin(0, 0.5);
    this.add.text(W / 2, H / 2 - 26, 'ЗАГРУЗКА...', {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#8b86a4'
    }).setOrigin(0.5);
    this.load.on('progress', function (v) { fill.width = 220 * v; });
    this.barRefs = [bar, fill];
  },

  create: function () {
    var self = this;
    var man = this.cache.json.get('sprite_manifest');
    var list = (man && Array.isArray(man.sprites)) ? man.sprites : [];

    function finish() {
      SG.Art.build(self);
      self.scene.start('Menu');
    }

    if (!list.length) { finish(); return; }

    list.forEach(function (key) {
      if (SG.Art.KEYS.indexOf(key) === -1) return;   // неизвестный ключ — пропускаем
      self.load.image(key, 'assets/sprites/' + key + '.png');
    });
    this.load.once('complete', finish);
    this.load.start();
  }
});
