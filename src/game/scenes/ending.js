/*
 * Ending: the clock reaches midnight. The pages come from src/data/ending.js
 * (DM.EndingData): a tone earned from how Jon treated people (unknown, gentle,
 * mixed, detached), and payoff pages for the story flags chapters persisted.
 * this.tone and this.run are public, so the music (or anything else) can
 * follow the same verdict as the text.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const F = DM.FONTS;
  const Scenes = (DM.Scenes = DM.Scenes || {});

  class Ending {
    constructor() {
      this.t = 0;
      this.cursor = 'pointer';
      this.page = 0;
      this.pageT = 0;
      const E = DM.EndingData;
      this.run = E.run(DM.Save.data);
      this.tone = this.run.tone;
      this.stats = this.run;
      this.pages = E.build(this.run);
    }
    enter() {
      DM.Audio.music.play(this.tone === 'detached' ? 'ending_cold' : 'ending'); // the same verdict as the text
    }
    get onCredits() {
      return this.page >= this.pages.length;
    }
    update(dt) {
      this.t += dt;
      this.pageT += dt;
      const S = DM.SettingsSchema;
      const auto = !this.onCredits && this.pageT > (4.2 + this.pages[this.page].length * 0.045) * (S ? S.readTime() : 1);
      if (auto || (this.pageT > 0.6 && Input.pressed('confirm'))) {
        Input.consume('confirm');
        if (this.onCredits) {
          if (this.pageT > 1.5) Engine.fadeTo(() => Engine.set(new Scenes.Title()), { out: 1.2, in: 0.8 });
          return;
        }
        this.page++;
        this.pageT = 0;
        DM.Audio.play('tick');
      }
    }
    render(ctx) {
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, DM.W, DM.H);
      const k = Math.min(1, this.page / this.pages.length);
      const minutes = Math.max(0, 1 - k);
      Gfx.glow(ctx, DM.W / 2, 220, 260, '#1b7fd0', 0.25);
      Gfx.clock(ctx, DM.W / 2, 220, 110, minutes, { blood: true });
      if (!this.onCredits) {
        const text = this.pages[this.page];
        const a = Math.min(1, this.pageT * 1.5);
        ctx.save();
        ctx.globalAlpha = a;
        const cps = DM.SettingsSchema ? DM.SettingsSchema.textCPS() : 45;
        Gfx.paragraph(ctx, text, DM.W / 2, 400, 760, 34, { size: 24, font: F.type, color: '#e8f6ff', align: 'center', chars: isFinite(cps) ? this.pageT * cps : Infinity });
        ctx.restore();
        Gfx.text(ctx, 'SPACE / CLICK', DM.W / 2, DM.H - 36, { size: 11, color: 'rgba(200,225,240,0.35)', align: 'center', spacing: 3 });
        return;
      }
      const a = Math.min(1, this.pageT);
      const s = this.stats;
      ctx.save();
      ctx.globalAlpha = a;
      Gfx.text(ctx, 'THE END', DM.W / 2, 410, { size: 64, color: '#ffffff', align: 'center', weight: 700, spacing: 16 });
      Gfx.text(ctx, 'OF THIS MOMENT', DM.W / 2, 446, { size: 16, color: DM.C.blue, align: 'center', spacing: 10 });
      const rows = [
        ['TOTAL TIME', U.fmtTime(s.time)],
        ['DISINTEGRATED', String(s.killed)],
        ['SPARED', String(s.spared)],
      ];
      if (s.memoryTotal > 0) rows.push(['MEMORIES RECOVERED', `${s.memories} / ${s.memoryTotal}`]);
      rows.forEach(([l, v], i) => {
        Gfx.text(ctx, l, DM.W / 2 - 14, 506 + i * 28, { size: 14, color: 'rgba(200,225,240,0.6)', align: 'right', spacing: 3 });
        Gfx.text(ctx, v, DM.W / 2 + 14, 506 + i * 28, { size: 16, color: '#ffffff' });
      });
      Gfx.text(ctx, 'A fan game inspired by Watchmen (Alan Moore, Dave Gibbons & John Higgins). Not affiliated with DC.', DM.W / 2, DM.H - 40, { size: 12, color: 'rgba(200,225,240,0.4)', align: 'center', font: F.type });
      ctx.restore();
    }
  }

  Scenes.Ending = Ending;
})();
