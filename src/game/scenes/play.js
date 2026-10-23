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
      this.memo = {}; // ctx.memo / ctx.once: remembered across retries of this chapter
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
          if (m.year != null && !this.ctx.foundMemories.includes(m.year)) this.ctx.foundMemories.push(m.year);
          this.hud.caption(`${m.year}. ${m.text}`, { dur: 6 + m.text.length * 0.03 });
        }),
        // Alt-tab, a notification or a hidden tab pauses the fight (Settings can turn this off).
        DM.Events.on('app:blur', () => this.focusLost()),
      ];
      this.begin(params.chapter, params.stage || 0, params.carry || null);
    }

    focusLost() {
      const s = Save.settings;
      if ((s && s.focusPause === false) || this.failed || !this.ctx || this.ctx.done) return;
      if (!Engine.stack.includes(this)) return;
      // Mid-fade (map change, retry): pause as soon as the new scene is up.
      if (Engine.fading) {
        clearTimeout(this.blurTimer);
        this.blurTimer = setTimeout(() => this.focusLost(), 120);
        return;
      }
      if (Engine.top() === this) Engine.push(new Scenes.Pause(this));
    }

    exit() {
      clearTimeout(this.blurTimer);
      for (const off of this.offs || []) off();
      if (this.ctx) this.ctx.dispose();
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(18000);
    }

    // Start (or restart) the chapter at `stage`. `carry` is the checkpoint
    // snapshot to resume with; `retry` is true for REASSEMBLE / restart.
    begin(chapterId, stage, carry, retry) {
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
      this.ctx.memo = this.memo;
      this.ctx.applyCarry(carry);
      this.ctx.start(stage);
      this.ctx.step(0);
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(18000);
      DM.Audio.music.play(ch.music);
      // Checkpoint stages record themselves (stageLoop); a fresh start records the
      // chapter start, which only moves Continue if it is not behind it.
      if (!stage) Save.checkpointAt(ch.id, 0, null);
      DM.Events.emit('play:begin', { scene: this, chapter: ch.id, stage, retry: !!retry });
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
      // Hit arcs are timed on the old world's clock; a new world restarts it.
      p.hurtDirs = [];
      p.hurtFlash = null;
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

    // Back to the last checkpoint with the stats it was reached with, so the
    // failed attempt's kills and spares are discarded but earlier ones are kept.
    retry() {
      const stage = this.ctx.checkpoint || 0;
      const carry = this.ctx.checkpointCarry;
      Engine.fadeTo(() => {
        while (Engine.top() !== this && Engine.stack.length > 1) Engine.pop();
        this.begin(this.chapter.id, stage, carry, true);
      });
    }

    completeChapter() {
      const ch = this.chapter;
      const st = this.ctx.stats;
      const next = DM.Chapters.next(ch.id);
      const d = Save.data;
      // Story choices a chapter declares in `persistFlags` travel to the ending.
      d.completed[ch.id] = { time: st.time, disintegrated: st.disintegrated, spared: st.spared, memories: st.memories, flags: this.ctx.persistedFlags() };
      d.reached = Math.max(d.reached, ch.index + 1);
      d.totals.disintegrated += st.disintegrated;
      d.totals.spared += st.spared;
      d.totals.memories += st.memories;
      Save.chapterDone(ch.id);
      Engine.push(new Scenes.ChapterComplete(this, st, next));
    }

    // The world (with its light layer and emissive pass), the weather, Temporal
    // Sight, combat feedback, the low-coherence edge, then the pre-composited
    // vignette and grain, and the HUD and dialogue above it all.
    render(ctx) {
      const w = this.world;
      w.render(ctx);
      // During the lockdown the light layer's beacons carry the alarm's red.
      if (w.tint && !(w.lighting && w.alarm)) {
        ctx.fillStyle = w.tint;
        ctx.fillRect(0, 0, DM.W, DM.H);
      }
      if (DM.Weather) DM.Weather.render(ctx, w, w.atmosphere);
      this.renderTimesight(ctx);
      if (DM.Feedback && DM.Feedback.render) DM.Feedback.render(ctx, this);
      const p = this.player;
      if (p.form === 'manhattan' && p.coherence < 35 && !p.down) {
        // Jon's edges come apart in blue light (steady with REDUCED flashing).
        const pulse = DM.SettingsSchema && DM.SettingsSchema.reducedFlashing() ? 0.85 : 0.7 + Math.sin(this.hud.t * 6) * 0.3;
        ctx.save();
        ctx.globalAlpha = (0.35 - p.coherence / 100) * 1.6 * pulse;
        ctx.globalCompositeOperation = 'lighter';
        Gfx.vignette(ctx, 1, '#2a8ad8');
        ctx.restore();
      }
      Gfx.postFx(ctx);
      const n = Engine.notice;
      if (n && !n.shown) {
        n.shown = true;
        this.hud.toast(n.text, '#bff1ff');
      }
      this.hud.render(ctx);
      this.dialog.render(ctx);
      if (this.debug) this.renderDebug(ctx);
    }

    // Temporal Sight: the world fades to an old photograph while Jon, his
    // duplicates, danger (enemy fire, hazards, telegraphs) and memories are
    // drawn again over it in full colour, with fading amber ghosts of where
    // enemies just were, and the clock ring around Jon.
    renderTimesight(ctx) {
      const w = this.world;
      // Sight's own fade (world.sightK): scripted slow motion is not Sight.
      const k = w.sightK || 0;
      if (k < 0.02) return;
      const p = this.player;
      ctx.save();
      ctx.globalAlpha = 0.85 * k;
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, DM.W, DM.H);
      ctx.globalAlpha = 0.35 * k;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#d9b46a';
      ctx.fillRect(0, 0, DM.W, DM.H);
      ctx.restore();

      ctx.save();
      w.camera.apply(ctx);
      if (w.ghosts) {
        ctx.fillStyle = '#f2b440';
        for (const [e, h] of w.ghosts) {
          if (e.dead) continue;
          for (let i = 0; i < h.length - 3; i += 3) {
            ctx.globalAlpha = (0.05 + 0.22 * (i / h.length)) * k; // older = fainter
            Gfx.circle(ctx, h[i], h[i + 1], e.r * 1.05);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      for (const e of w._keep || []) if (!e.dead) e.render(ctx, w);
      w.renderEmissive(ctx, w._vis || []);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = k;
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
      const st = Engine.stats;
      const lines = [
        `fps ${Math.round(Engine.fps)}  entities ${w.entities.length}  particles ${w.particles.list.length}`,
        `update ${st.updMs.toFixed(2)} ms  render ${st.renderMs.toFixed(2)} ms  frame gap ${st.gapMs.toFixed(1)} ms  quality ${Engine.qualityTier()} x${Engine.dpr.toFixed(2)}`,
        `map ${w.mapId || '-'}  lights ${w.lighting && DM.Lighting ? DM.Lighting.stats.lights : 0}  weather ${DM.Weather ? DM.Weather.stats.particles : 0}`,
        `chapter ${this.chapter.id}  stage ${this.ctx.stageIndex} (${this.chapter.stages[this.ctx.stageIndex] && this.chapter.stages[this.ctx.stageIndex].id})  checkpoint ${this.ctx.checkpoint}`,
        `player ${Math.round(p.x)},${Math.round(p.y)}  form ${p.form}  energy ${Math.round(p.energy)}  coherence ${Math.round(p.coherence)}`,
        `] skip stage   \` toggle debug`,
      ];
      const h = lines.length * 20 + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, DM.H - 10 - h, 760, h);
      lines.forEach((l, i) => Gfx.text(ctx, l, 20, DM.H - h + 12 + i * 20, { size: 13, color: '#9fe8ff', font: DM.FONTS.type }));
    }
  }

  Scenes.Play = Play;
})();
