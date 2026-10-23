/*
 * Ending: the clock reaches midnight. The closing narration changes with how
 * Jon treated people along the way (lives spared vs. disintegrated) — the
 * first hook for branching endings.
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

  function tally() {
    let killed = 0, spared = 0, memories = 0, time = 0;
    for (const id in DM.Save.data.completed) {
      const c = DM.Save.data.completed[id];
      killed += c.disintegrated || 0;
      spared += c.spared || 0;
      memories += c.memories || 0;
      time += c.time || 0;
    }
    return { killed, spared, memories, time };
  }

  class Ending {
    constructor() {
      this.t = 0;
      this.cursor = 'pointer';
      this.page = 0;
      this.pageT = 0;
      const s = (this.stats = tally());
      const detached = s.killed > Math.max(4, s.spared * 1.5);
      this.pages = [
        'Midnight. The clock in my mind stops, and does not start again.',
        'Adrian asks me whether he did the right thing. Whether it all worked out, in the end.',
        'I tell him there is no end. There is only the next moment, and the one after it, and all of them at once.',
        detached
          ? `${s.killed} people came apart at my touch. I remember each of them; I remember them still being alive. I am leaving this galaxy for one less complicated.`
          : `I chose to set ${s.spared} people down gently, when it would have been easier not to. Perhaps I am not finished with human beings. Perhaps I will make some of my own.`,
        'Somewhere, a watch is ticking. I can see every moment it will ever measure.',
      ];
    }
    enter() {
      DM.Audio.music.play(this.stats.killed > Math.max(4, this.stats.spared * 1.5) ? 'ending_cold' : 'ending'); // the same rule as the text
    }
    get onCredits() {
      return this.page >= this.pages.length;
    }
    update(dt) {
      this.t += dt;
      this.pageT += dt;
      const auto = !this.onCredits && this.pageT > 4.2 + this.pages[this.page].length * 0.045;
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
        Gfx.paragraph(ctx, text, DM.W / 2, 400, 760, 34, { size: 24, font: F.type, color: '#e8f6ff', align: 'center', chars: this.pageT * 45 });
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
        ['MEMORIES RECOVERED', `${s.memories} / 6`],
      ];
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
