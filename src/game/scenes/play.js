/*
 * Play scene: runs one chapter. Owns the world, player, HUD, dialogue and the
 * chapter script context. Handles pause, failure (decoherence), retry from
 * checkpoint, stats and chapter completion.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const Save = DM.Save;
  const Scenes = (DM.Scenes = DM.Scenes || {});

  class Play {
    constructor() {
      this.debug = false;
    }

    // A targeting reticle only once Jon has powers to aim.
    get cursor() {
      return this.player && this.player.form === 'human' ? 'pointer' : 'reticle';
    }

    enter(params) {
      this.offs = [
        DM.Events.on('enemy:down', (e) => {
          if (!e.human || !this.ctx) return;
          if (e.lethal) this.ctx.stats.disintegrated++;
          else this.ctx.stats.spared++;
        }),
        DM.Events.on('memory:found', (m) => {
          if (!this.ctx) return;
          this.ctx.stats.memories++;
          this.hud.caption(`${m.year}. ${m.text}`, { dur: 6 + m.text.length * 0.03 });
        }),
      ];
      this.begin(params.chapter, params.stage || 0);
    }

    exit() {
      for (const off of this.offs || []) off();
      if (this.ctx) this.ctx.dispose();
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(18000);
    }

    begin(chapterId, stage) {
      if (this.ctx) this.ctx.dispose();
      const ch = DM.Chapters.get(chapterId);
      this.chapter = ch;
      this.hud = new DM.HUD(this);
      this.dialog = new DM.Dialog();
      this.player = new DM.Player(0, 0);
      this.player.setForm(ch.form || 'manhattan');
      for (const id of DM.Chapters.powersBefore(ch.index)) this.player.unlock(id);
      this.world = new DM.World({ w: DM.W, h: DM.H });
      this.failed = false;
      this.failT = 0;
      this.ctx = new DM.ChapterContext(this, ch);
      this.ctx.start(stage);
      this.ctx.step(0);
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(18000);
      DM.Audio.music.play(ch.music);
      Save.data.checkpoint = { chapter: ch.id, stage: this.ctx.checkpoint || stage };
      Save.write();
    }

    setWorld(world) {
      const p = this.player;
      for (const st of Object.values(p.powers)) {
        st.target = null;
        st.hover = null;
        st.active = false;
        st.pending = [];
      }
      this.world = world;
      world.player = p;
      p.world = world;
      p.dead = false;
      const s = world.spawn || { x: world.w / 2, y: world.h / 2 };
      p.x = s.x;
      p.y = s.y;
      p.vx = p.vy = 0;
      if (s.facing != null) p.facing = s.facing;
      world.add(p);
      world.camera.snap(p.x, p.y);
      DM.Audio.stopHums();
    }

    update(dt) {
      if (Input.pressed('pause') && !this.failed && !Engine.fading) {
        Input.consume('pause');
        Input.consume('back');
        Engine.push(new Scenes.Pause(this));
        return;
      }
      if (Input.pressed('mute')) this.hud.toast(DM.Audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON', '#bff1ff');
      if (DM.DEV) {
        if (Input.pressed('skip')) this.ctx.skipStage();
        if (Input.pressed('debug')) this.debug = !this.debug;
      }

      this.dialog.update(dt);
      const p = this.player;
      p.locked = this.ctx.locked || this.dialog.active;
      const w = this.world;
      w.mouse = w.camera.toWorld(Input.mouse.x, Input.mouse.y);
      w.ceasefire = p.locked || this.failed; // cutscenes, dialogue and decoherence are safe
      if (p.locked || p.form === 'human') {
        w.slowmo = false;
        w.timesight = false;
      }
      w.update(dt);
      this.ctx.step(dt);
      if (this.world !== w) return; // map changed this frame

      const cam = w.camera;
      const tgt = this.ctx.camTarget;
      if (tgt) cam.follow(tgt.x, tgt.y, dt, 3);
      else {
        const look = p.form === 'manhattan' && !p.locked ? 0.18 : 0;
        cam.follow(p.x + (w.mouse.x - p.x) * look, p.y + (w.mouse.y - p.y) * look, dt, 6);
      }
      this.hud.update(dt);

      if (p.down && !this.failed) {
        this.failed = true;
        this.failT = 1.8;
        Save.data.totals.decoherences++;
        Save.write();
        // Coming apart: a beat of freeze, then the world crawls while Jon's
        // atoms hang in the air (DM.Feedback drains the colour meanwhile).
        w.ceasefire = true;
        if (w.hitstop) w.hitstop(0.15);
        w.slowmoT = 1.2;
        w.slowmoTarget = 0.15;
        w.particles.burst(p.x, p.y, 120, { color: ['#7fe3ff', '#5fd4ff', '#ffffff'], speed: [40, 360], life: [0.9, 2.2], size: [1.5, 3.5], drag: 0.3 });
        p.hidden = true;
        DM.Audio.play('disintegrate');
      }
      if (this.failed) {
        this.failT -= dt;
        if (this.failT <= 0 && Engine.top() === this) Engine.push(new Scenes.GameOver(this));
      }
    }

    retry() {
      const stage = this.ctx.checkpoint || 0;
      Engine.fadeTo(() => {
        while (Engine.top() !== this && Engine.stack.length > 1) Engine.pop();
        this.begin(this.chapter.id, stage);
      });
    }

    completeChapter() {
      const ch = this.chapter;
      const st = this.ctx.stats;
      const next = DM.Chapters.next(ch.id);
      const d = Save.data;
      d.completed[ch.id] = { time: st.time, disintegrated: st.disintegrated, spared: st.spared, memories: st.memories };
      d.reached = Math.max(d.reached, ch.index + 1);
      d.totals.disintegrated += st.disintegrated;
      d.totals.spared += st.spared;
      d.totals.memories += st.memories;
      d.checkpoint = next ? { chapter: next.id, stage: 0 } : null;
      Save.write();
      Engine.push(new Scenes.ChapterComplete(this, st, next));
    }

    render(ctx) {
      const w = this.world;
      w.render(ctx);
      if (w.tint) {
        ctx.fillStyle = w.tint;
        ctx.fillRect(0, 0, DM.W, DM.H);
      }
      this.renderTimesight(ctx);
      if (DM.Feedback) DM.Feedback.render(ctx, this);
      const p = this.player;
      if (p.form === 'manhattan' && p.coherence < 35 && !p.down) {
        ctx.save();
        ctx.globalAlpha = (0.35 - p.coherence / 100) * 2 * (0.7 + Math.sin(this.hud.t * 6) * 0.3);
        ctx.globalCompositeOperation = 'lighter';
        Gfx.vignette(ctx, 1);
        ctx.restore();
      }
      Gfx.vignette(ctx, 0.55);
      this.hud.render(ctx);
      this.dialog.render(ctx);
      Gfx.grain(ctx, 0.035);
      if (this.debug) this.renderDebug(ctx);
    }

    renderTimesight(ctx) {
      const w = this.world;
      // Sight's own share of the slowdown (scripted slow motion is not Sight).
      const k = U.clamp((1 - (w.sightScale == null ? w.timeScale : w.sightScale)) / 0.72, 0, 1);
      if (k < 0.02) return;
      const p = this.player;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(242,196,24,0.07)';
      ctx.fillRect(0, 0, DM.W, DM.H);
      const s = w.camera.toScreen(p.x, p.y);
      const R = 150 * w.camera.zoom * p.scale;
      ctx.strokeStyle = 'rgba(242,196,24,0.5)';
      ctx.lineWidth = 1.5;
      Gfx.circle(ctx, s.x, s.y, R);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const l = i % 5 ? 5 : 12;
        Gfx.line(ctx, s.x + Math.cos(a) * R, s.y + Math.sin(a) * R, s.x + Math.cos(a) * (R - l), s.y + Math.sin(a) * (R - l));
      }
      const ht = this.hud.t;
      ctx.lineWidth = 2;
      Gfx.line(ctx, s.x, s.y, s.x + Math.cos(ht * 0.8 - 1.57) * R * 0.85, s.y + Math.sin(ht * 0.8 - 1.57) * R * 0.85);
      Gfx.line(ctx, s.x, s.y, s.x + Math.cos(-ht * 0.1 - 1.57) * R * 0.5, s.y + Math.sin(-ht * 0.1 - 1.57) * R * 0.5);
      ctx.restore();
      Gfx.text(ctx, 'TEMPORAL SIGHT', DM.W / 2, 150, { size: 13, color: 'rgba(242,196,24,0.8)', align: 'center', spacing: 6, alpha: k });
    }

    renderDebug(ctx) {
      const w = this.world, p = this.player;
      const lines = [
        `fps ${Math.round(Engine.fps)}  entities ${w.entities.length}  particles ${w.particles.list.length}`,
        `chapter ${this.chapter.id}  stage ${this.ctx.stageIndex} (${this.chapter.stages[this.ctx.stageIndex] && this.chapter.stages[this.ctx.stageIndex].id})  checkpoint ${this.ctx.checkpoint}`,
        `player ${Math.round(p.x)},${Math.round(p.y)}  form ${p.form}  energy ${Math.round(p.energy)}  coherence ${Math.round(p.coherence)}`,
        `] skip stage   \` toggle debug`,
      ];
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, DM.H - 100, 560, 90);
      lines.forEach((l, i) => Gfx.text(ctx, l, 20, DM.H - 78 + i * 20, { size: 13, color: '#9fe8ff', font: DM.FONTS.type }));
    }
  }

  Scenes.Play = Play;
})();
