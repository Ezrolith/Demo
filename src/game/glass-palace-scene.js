/* The Glass Palace: a quiet walk through moments, never a campaign chapter. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const G = DM.Gfx;
  const U = DM.U;
  const E = DM.Engine;
  const I = DM.Input;
  const BLUE = '#b9ecff';
  const GOLD = '#e2c287';
  const TAU = Math.PI * 2;
  const maximumFragments = () =>
    typeof GP.maxFragments === 'function' ? GP.maxFragments() : GP.maxFragments || 36;
  const CENTRE = { x: 1050, y: 880 };
  const PANE_POINTS = [
    [420, 350],
    [840, 350],
    [1260, 350],
    [1680, 350],
    [350, 700],
    [1750, 700],
    [350, 1050],
    [1750, 1050],
    [420, 1450],
    [840, 1450],
    [1260, 1450],
    [1680, 1450],
  ];

  const closePanel = () => {
    I.clearAll();
    E.pop();
  };

  function panel(g, title, subtitle) {
    g.fillStyle = 'rgba(2,7,14,0.94)';
    g.fillRect(72, 68, 1136, 584);
    g.strokeStyle = 'rgba(169,225,247,0.65)';
    g.lineWidth = 1;
    g.strokeRect(72.5, 68.5, 1135, 583);
    G.text(g, title, 112, 126, { size: 34, color: BLUE, spacing: 3, weight: 700 });
    if (subtitle) G.text(g, subtitle, 112, 162, { size: 15, color: '#b1c4ce', spacing: 1 });
  }

  function challengeRows(moment) {
    const status = GP.status(moment.id);
    return (
      status.challenges || GP.challengeDefs(moment.id).map((def) => ({ ...def, complete: false }))
    );
  }

  class ChallengesPanel {
    constructor(moment) {
      this.moment = moment;
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      I.clearAll();
      this.status = GP.status(this.moment.id);
      this.rows = challengeRows(this.moment);
      this.menu = new DM.UI.Menu([{ label: 'RETURN TO THE MOMENT', action: closePanel }], {
        x: 640,
        y: 566,
        w: 720,
        align: 'center',
        size: 20,
        onBack: closePanel,
      });
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      const status = this.status;
      panel(
        g,
        'MOMENT CHALLENGES',
        this.moment.title + ' · ' + status.earned + ' / 3 fragments recovered',
      );
      this.rows.forEach((challenge, index) => {
        const y = 214 + index * 108;
        const complete = !!(challenge.complete || challenge.earned);
        G.panel(g, 110, y - 30, 1060, 91, { accent: complete ? '#9cdbbd' : '#8d9ca6' });
        G.text(g, (complete ? '◆ ' : '◇ ') + (challenge.label || challenge.name), 132, y + 1, {
          size: 23,
          color: complete ? '#b3e4ca' : '#e6d9bc',
        });
        G.paragraph(g, challenge.description || '', 132, y + 17, 1008, 22, {
          size: 16,
          font: DM.FONTS.type,
          color: '#b7c9d1',
        });
      });
      this.menu.render(g);
    }
  }

  class MomentPanel {
    constructor(hub, moment) {
      this.hub = hub;
      this.moment = moment;
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      I.clearAll();
      const moment = GP.find(this.moment.id) || this.moment;
      this.moment = moment;
      this.status = GP.status(moment.id);
      this.menu = new DM.UI.Menu(
        [
          { label: 'PLAY THIS MOMENT', action: () => GP.playMoment(moment, false) },
          {
            label: 'RESUME CHECKPOINT',
            disabled: !moment.checkpoint,
            action: () => GP.playMoment(moment, true),
          },
          { label: 'CHALLENGES', action: () => E.push(new ChallengesPanel(moment)) },
          { label: 'RETURN TO THE PALACE', action: closePanel },
        ],
        { x: 640, y: 362, w: 760, align: 'center', size: 22, itemH: 48, onBack: closePanel },
      );
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      const status = this.status;
      const subtitle =
        this.moment.group === 'afterMidnight'
          ? 'Your selected After Midnight hero: ' + this.moment.heroLabel
          : 'A moment may be revisited. What happened is still recorded.';
      panel(g, this.moment.title.toUpperCase(), subtitle);
      G.text(g, status.earned + ' / 3 MOMENTS', 640, 233, {
        size: 39,
        align: 'center',
        color: GOLD,
        spacing: 4,
      });
      G.text(
        g,
        this.moment.checkpoint ? 'A checkpoint is waiting.' : 'No checkpoint is currently stored.',
        640,
        277,
        {
          size: 17,
          align: 'center',
          color: '#b6cbd7',
        },
      );
      G.text(
        g,
        'PLAY starts this level normally. RESUME keeps its existing checkpoint and character.',
        640,
        319,
        {
          size: 15,
          align: 'center',
          color: '#98b1c0',
        },
      );
      this.menu.render(g);
    }
  }

  class LedgerPanel {
    constructor() {
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      I.clearAll();
      this.ledger = GP.ledger();
      this.reflection = GP.reflection(this.ledger);
      this.menu = new DM.UI.Menu([{ label: 'RETURN TO THE PALACE', action: closePanel }], {
        x: 640,
        y: 566,
        w: 740,
        align: 'center',
        size: 21,
        onBack: closePanel,
      });
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      const ledger = this.ledger;
      panel(g, 'THE GLASS LEDGER', 'One view across three existing histories.');
      G.text(g, 'SPARED', 400, 237, { size: 20, color: '#a9dcbf', align: 'center', spacing: 4 });
      G.text(g, String(ledger.spared), 400, 305, { size: 64, color: '#c5efdc', align: 'center' });
      G.text(g, 'UNMADE', 880, 237, { size: 20, color: '#d5aaa2', align: 'center', spacing: 4 });
      G.text(g, String(ledger.unmade ?? ledger.disintegrated ?? 0), 880, 305, {
        size: 64,
        color: '#efc0b2',
        align: 'center',
      });
      G.paragraph(g, this.reflection, 640, 355, 930, 29, {
        size: 23,
        font: DM.FONTS.type,
        color: '#e5e5d8',
        align: 'center',
      });
      G.paragraph(g, ledger.note || '', 640, 456, 930, 23, {
        size: 16,
        font: DM.FONTS.type,
        color: '#9eb9c7',
        align: 'center',
      });
      this.menu.render(g);
    }
  }

  class LeavePanel {
    constructor(hub) {
      this.hub = hub;
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      I.clearAll();
      this.menu = new DM.UI.Menu(
        [
          { label: 'KEEP WALKING', action: closePanel },
          {
            label: 'MOMENT ATLAS',
            action: () => {
              closePanel();
              this.hub.openAtlas();
            },
          },
          {
            label: 'BACK UP / RESTORE PALACE',
            action: () => {
              closePanel();
              E.push(new GP.BackupScreen(this.hub));
            },
          },
          {
            label: 'RETURN TO THE MAIN GAME',
            action: () => E.fadeTo(() => E.set(new DM.Scenes.Title())),
          },
        ],
        { x: 640, y: 274, w: 760, align: 'center', size: 23, itemH: 53, onBack: closePanel },
      );
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      panel(g, 'ALL MOMENTS REMAIN', 'Leaving the palace does not change any chapter checkpoint.');
      this.menu.render(g);
    }
  }

  class PalaceWalker extends DM.Player {
    constructor(x, y) {
      super(x, y);
      this.setForm('manhattan');
      this.powerDefs = [];
      this.powers = {};
      this.targetable = false;
    }
    get canUsePowers() {
      return false;
    }
    get speedMax() {
      return 205;
    }
    damage() {
      return false;
    }
  }

  // Map builders are used only for their own art/entities. No stage generator,
  // checkpoint, challenge configuration or progression method is executed.
  class MomentPreview {
    constructor(moment) {
      this.moment = moment;
      this.canvas = document.createElement('canvas');
      this.canvas.width = 220;
      this.canvas.height = 124;
      this.g = this.canvas.getContext('2d');
      this.renders = 0;
      this.error = null;
      this.sourceMap = null;
      this.context = null;
    }
    build() {
      try {
        const chapter =
          this.moment.chapter || DM.Chapters.get(this.moment.chapterId || this.moment.id);
        if (!chapter) throw new Error('Moment chapter is unavailable.');
        const player = chapter.afterMidnight
          ? DM.AfterMidnight.createPlayer(this.moment.hero || 'niteowl')
          : new DM.Player(0, 0);
        if (!chapter.afterMidnight) player.setForm(chapter.form || 'manhattan');
        player.powerDefs = [];
        player.powers = {};
        player.locked = true;
        player.targetable = false;
        const scene = { chapter, player, world: null, memo: {} };
        scene.dialog = new DM.Dialog();
        scene.hud = new DM.HUD(scene);
        const context = new DM.ChapterContext(scene, chapter);
        this.context = context;
        scene.ctx = context;
        const keys = Object.keys(chapter.maps || {});
        const map = chapter.id === 'mars' && chapter.maps.mars ? 'mars' : keys[0];
        if (!map) throw new Error('Moment map is unavailable.');
        context.stageIndex = Math.max(
          0,
          chapter.stages.findIndex((stage) => stage.map === map),
        );
        const world = chapter.maps[map](context);
        context._building = null;
        scene.world = world;
        world.player = scene.player;
        scene.player.world = world;
        scene.player.x = world.spawn?.x || world.w / 2;
        scene.player.y = world.spawn?.y || world.h / 2;
        world.add(scene.player);
        world.mapId = map;
        world.ceasefire = true;
        world.camera.zoom = world.camera.targetZoom =
          Math.min(DM.W / world.w, DM.H / world.h) * 0.94;
        world.camera.snap(world.w / 2, world.h / 2);
        for (const entity of world.entities) {
          if (entity instanceof DM.Special.Palace) entity.rise = this.moment.completed ? 1 : 0.2;
        }
        this.world = world;
        this.context = context;
        this.sourceMap = map;
        this.sourceBuilder = chapter.maps[map];
      } catch (error) {
        this.error = String(error.stack || error);
        this.context?.dispose();
        this.context = null;
      }
    }
    refresh(time) {
      if (!this.world && !this.error) this.build();
      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (!this.world) {
        g.fillStyle = '#122532';
        g.fillRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      // Only cosmetic clocks advance. Enemy AI, collisions and interactions do not.
      this.world.time = this.world.realTime = time;
      for (const entity of this.world.entities) entity.age = time;
      g.save();
      g.scale(this.canvas.width / DM.W, this.canvas.height / DM.H);
      this.world.render(g);
      g.restore();
      this.renders++;
    }
    dispose() {
      this.context?.dispose();
      if (this.world) this.world.floorCanvas = null;
      this.world = null;
      this.context = null;
      this.canvas.width = this.canvas.height = 1;
    }
  }

  class MomentPane extends DM.Entity {
    constructor(hub, moment, index) {
      const point = PANE_POINTS[index] || PANE_POINTS[index % PANE_POINTS.length];
      super({
        x: point[0],
        y: point[1],
        r: 130,
        static: true,
        body: false,
        solid: false,
        layer: 1,
      });
      this.hub = hub;
      this.moment = moment;
      this.status = hub.statusSnapshots[moment.id];
      this.preview = new MomentPreview(moment);
      this.disintegratable = false;
      this.interact = {
        label: 'E · ' + moment.title.toUpperCase(),
        range: 145,
        onInteract: () => E.push(new MomentPanel(hub, moment)),
      };
    }
    render(g, world) {
      const status = this.status;
      const selected = world.player.interactTarget === this;
      g.save();
      g.translate(this.x, this.y);
      g.fillStyle = 'rgba(2,14,28,0.88)';
      g.fillRect(-122, -84, 244, 177);
      g.strokeStyle = selected ? '#e6f7ff' : 'rgba(153,218,247,0.72)';
      g.lineWidth = selected ? 3 : 1.5;
      g.strokeRect(-122, -84, 244, 177);
      g.fillStyle = 'rgba(169,222,245,0.12)';
      g.fillRect(-128, -90, 12, 189);
      g.fillRect(116, -90, 12, 189);
      if (this.preview.renders) g.drawImage(this.preview.canvas, -110, -72, 220, 124);
      G.text(g, this.moment.title.toUpperCase(), 0, 73, {
        size: 15,
        align: 'center',
        color: '#e7eedf',
        spacing: 1,
      });
      G.text(g, status.earned + ' / 3 MOMENTS', 0, 111, {
        size: 14,
        align: 'center',
        color: status.earned === 3 ? '#bce8ce' : GOLD,
      });
      if (selected)
        G.text(g, 'E · PLAY / RESUME / CHALLENGES', 0, -105, {
          size: 15,
          align: 'center',
          color: '#e8f7ff',
        });
      g.restore();
    }
  }

  class GlassPiece extends DM.Entity {
    constructor(index) {
      const ring = Math.floor(index / 12);
      const angle = ((index % 12) * TAU) / 12 - Math.PI / 2 + ring * 0.13;
      const radius = 88 + ring * 68;
      super({
        x: CENTRE.x + Math.cos(angle) * radius,
        y: CENTRE.y + Math.sin(angle) * radius * 0.72,
        r: 32,
        static: true,
        body: false,
        solid: false,
        layer: 0,
        disintegratable: false,
      });
      this.fragmentIndex = index;
      this.height = 42 + ring * 24 + (index % 3) * 13;
      this.angle = angle;
    }
    render(g) {
      const h = this.height;
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.angle * 0.18);
      g.fillStyle = 'rgba(126,199,234,0.26)';
      g.strokeStyle = 'rgba(216,246,255,0.88)';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(-22, 7);
      g.lineTo(0, -h);
      g.lineTo(24, 5);
      g.lineTo(0, 25);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(232,252,255,0.5)';
      G.line(g, 0, -h, 0, 25);
      G.line(g, -22, 7, 24, 5);
      g.restore();
    }
  }

  class LedgerSlab extends DM.Entity {
    constructor(hub) {
      super({
        x: 1050,
        y: 1130,
        r: 150,
        static: true,
        body: false,
        solid: false,
        disintegratable: false,
      });
      this.hub = hub;
      this.interact = {
        label: 'E · READ THE COMBINED LEDGER',
        range: 140,
        onInteract: () => E.push(new LedgerPanel()),
      };
    }
    render(g, world) {
      const ledger = this.hub.ledgerSnapshot;
      g.fillStyle = 'rgba(21,61,79,0.8)';
      G.rr(g, this.x - 220, this.y - 45, 440, 102, 12);
      g.fill();
      g.strokeStyle = 'rgba(179,234,255,0.84)';
      g.lineWidth = 2;
      g.stroke();
      G.text(g, 'THE GLASS LEDGER', this.x, this.y - 12, {
        size: 20,
        color: '#dff5fb',
        align: 'center',
        spacing: 3,
      });
      G.text(
        g,
        ledger.spared + ' SPARED     ' + (ledger.unmade ?? ledger.disintegrated ?? 0) + ' UNMADE',
        this.x,
        this.y + 23,
        {
          size: 22,
          color: GOLD,
          align: 'center',
        },
      );
      if (world.player.interactTarget === this)
        G.text(g, 'E · READ', this.x, this.y + 85, {
          size: 16,
          color: BLUE,
          align: 'center',
        });
    }
  }

  class EarthMoment extends DM.Entity {
    constructor(hub) {
      super({
        x: 1510,
        y: 1160,
        r: 75,
        static: true,
        body: false,
        solid: false,
        disintegratable: false,
      });
      this.hub = hub;
      this.interact = {
        label: 'E · THE QUESTION OF EARTH',
        range: 125,
        onInteract: () => {
          if (GP.openEpilogue) GP.openEpilogue(hub);
          else if (DM.Scenes.GlassPalaceEpilogue) E.push(new DM.Scenes.GlassPalaceEpilogue(hub));
        },
      };
    }
    render(g, world) {
      G.glow(g, this.x, this.y, 90, '#96c6e9', 0.19);
      G.clock(g, this.x, this.y, 43, 0, { blood: false });
      G.text(g, 'EARTH', this.x, this.y + 70, {
        size: 20,
        align: 'center',
        color: '#d5eaf2',
        spacing: 4,
      });
      if (world.player.interactTarget === this)
        G.text(g, 'E · EPILOGUE', this.x, this.y + 99, {
          size: 15,
          align: 'center',
          color: GOLD,
        });
    }
  }

  function bakeMarsHall(g, width, height) {
    const random = U.seeded(1986);
    const ground = g.createRadialGradient(CENTRE.x, CENTRE.y, 100, CENTRE.x, CENTRE.y, 1450);
    ground.addColorStop(0, '#a95030');
    ground.addColorStop(1, '#652817');
    g.fillStyle = ground;
    g.fillRect(0, 0, width, height);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = i % 2 ? 'rgba(58,18,8,0.11)' : 'rgba(255,191,143,0.07)';
      g.fillRect(random() * width, random() * height, 3, 2);
    }
    const sky = g.createLinearGradient(0, 0, 0, 225);
    sky.addColorStop(0, '#20131f');
    sky.addColorStop(1, '#8e3c2b');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, 225);
    for (let i = 0; i < 65; i++) {
      g.fillStyle = 'rgba(225,218,212,0.45)';
      g.fillRect(random() * width, random() * 155, 1, 1);
    }
    g.strokeStyle = 'rgba(218,159,119,0.17)';
    g.lineWidth = 3;
    for (let i = 0; i < 13; i++) {
      const y = 240 + i * 108;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(600, y - 65, 1400, y + 48, width, y - 22);
      g.stroke();
    }
    g.fillStyle = 'rgba(90,168,196,0.09)';
    G.ellipse(g, CENTRE.x, CENTRE.y, 490, 350);
    g.fill();
    g.strokeStyle = 'rgba(185,231,245,0.22)';
    g.lineWidth = 2;
    for (const radius of [340, 410, 490]) {
      G.ellipse(g, CENTRE.x, CENTRE.y, radius, radius * 0.72);
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const angle = (i * TAU) / 24;
      G.line(
        g,
        CENTRE.x + Math.cos(angle) * 410,
        CENTRE.y + Math.sin(angle) * 295,
        CENTRE.x + Math.cos(angle) * 490,
        CENTRE.y + Math.sin(angle) * 353,
      );
    }
  }

  class GlassPalace {
    constructor() {
      this.isGlassPalace = true;
      this.cursor = 'pointer';
      this.t = 0;
      this.previewT = 0;
      this.previewCursor = 0;
      this.chapter = { id: 'glass_palace', music: 'glass_palace', stages: [{ id: 'hall' }] };
      this.ctx = { mapName: 'gp_palace', stageIndex: 0, locked: false };
      this.hud = { captions: [] };
      this.navigationTargetId = null;
      this.navigationRoute = [];
      this.navigationTimer = 0;
    }
    enter() {
      GP.load();
      I.clearAll();
      this.rebuild();
      DM.Audio.stopHums();
      DM.Audio.setTimeScale(1);
      DM.Audio.music.play('glass_palace');
      DM.Audio.ambience('gp_palace');
    }
    refreshSnapshots(moments = GP.moments()) {
      this.momentSnapshots = moments;
      this.paneSignature = moments
        .filter((moment) => moment.unlocked)
        .map((moment) => [moment.id, moment.hero || '', !!moment.completed].join(':'))
        .join('|');
      this.ledgerSnapshot = GP.ledger();
      this.reflectionSnapshot = GP.reflection(this.ledgerSnapshot);
      this.maximumFragmentsSnapshot = maximumFragments();
      this.epilogueReadySnapshot = GP.epilogueReady();
      this.statusSnapshots = Object.fromEntries(
        moments.map((moment) => [moment.id, GP.status(moment.id)]),
      );
      for (const pane of this.panes || []) {
        const current = moments.find((moment) => moment.id === pane.moment.id);
        if (current) {
          pane.moment = current;
          pane.status = this.statusSnapshots[current.id];
        }
      }
    }
    rebuild(moments = GP.moments()) {
      for (const pane of this.panes || []) pane.preview.dispose();
      this.refreshSnapshots(moments);
      const maximum = this.maximumFragmentsSnapshot;
      const count = U.clamp(Math.floor(GP.fragmentCount()), 0, maximum);
      this.structureCount = count;
      const old = this.player && { x: this.player.x, y: this.player.y };
      const world = (this.world = new DM.World({ w: 2100, h: 1800, bg: '#652817', zoom: 0.9 }));
      world.mapId = 'gp_palace';
      world.ceasefire = true;
      world.spawn = { x: 1050, y: 1310, facing: -Math.PI / 2 };
      world.bake(bakeMarsHall);
      world.room(110, 180, 1880, 1470, {
        kind: 'glass',
        t: 16,
        doors: [{ side: 'bottom', at: 790, w: 280 }],
      });
      this.player = new PalaceWalker(old?.x || world.spawn.x, old?.y || world.spawn.y);
      this.player.facing = -Math.PI / 2;
      world.player = this.player;
      world.add(this.player);
      this.structure = world.add(new DM.Special.Palace(CENTRE.x, CENTRE.y));
      this.structure.rise = count / maximum;
      this.structure.slots = Array.from({ length: maximum }, (_, index) => {
        const angle = (index * TAU) / maximum;
        return {
          x: CENTRE.x + Math.cos(angle) * 230,
          y: CENTRE.y + Math.sin(angle) * 230,
          big: false,
          filled: index < count,
        };
      });
      this.structurePieces = Array.from({ length: count }, (_, index) =>
        world.add(new GlassPiece(index)),
      );
      this.panes = [];
      this.momentSnapshots.forEach((moment, index) => {
        if (!moment.unlocked) return;
        const pane = world.add(new MomentPane(this, moment, index));
        this.panes.push(pane);
        world.wall(pane.x - 127, pane.y - 91, 254, 12, 'glass');
      });
      this.slab = world.add(new LedgerSlab(this));
      this.epilogueTerminal = this.epilogueReadySnapshot ? world.add(new EarthMoment(this)) : null;
      world.add(new GP.WalkingGuide(this));
      if (!world.isFree(this.player.x, this.player.y, this.player.r)) {
        this.player.x = world.spawn.x;
        this.player.y = world.spawn.y;
      }
      world.camera.snap(this.player.x, this.player.y - 180);
      this.previewCursor = 0;
      this.previewT = 0;
      if (this.navigationTargetId) this.setDestination(this.navigationTargetId);
    }
    resume() {
      const moments = GP.moments();
      const signature = moments
        .filter((moment) => moment.unlocked)
        .map((moment) => [moment.id, moment.hero || '', !!moment.completed].join(':'))
        .join('|');
      const changed =
        this.structureCount !== GP.fragmentCount() ||
        signature !== this.paneSignature ||
        this.epilogueReadySnapshot !== GP.epilogueReady() ||
        this.maximumFragmentsSnapshot !== maximumFragments();
      if (changed) this.rebuild(moments);
      else this.refreshSnapshots(moments);
      if (this.navigationTargetId) this.setDestination(this.navigationTargetId);
      I.clearAll();
    }
    destinations() {
      const entries = this.panes.map((pane) => {
        const status = this.statusSnapshots[pane.moment.id];
        return {
          id: pane.moment.id,
          kind: 'moment',
          title: pane.moment.title,
          x: pane.x,
          y: pane.y + 100,
          earned: status.earned,
          total: status.total,
          checkpoint: !!pane.moment.checkpoint,
        };
      });
      entries.push({ id: 'ledger', kind: 'ledger', title: 'The glass ledger', x: 1050, y: 1230 });
      if (this.epilogueTerminal) {
        entries.push({ id: 'earth', kind: 'earth', title: 'The question of Earth', x: 1510, y: 1260 });
      }
      return entries;
    }
    navigationTarget() {
      return this.destinations().find((entry) => entry.id === this.navigationTargetId) || null;
    }
    setDestination(id) {
      const target = this.destinations().find((entry) => entry.id === id);
      if (!target) {
        this.clearDestination();
        return false;
      }
      const route = GP.planPalaceRoute(this.world, this.player, target, this.player.r);
      if (!route.length) {
        this.clearDestination();
        return false;
      }
      this.navigationTargetId = id;
      this.navigationRoute = route;
      this.navigationTimer = 0.5;
      this.navigationFrom = { x: this.player.x, y: this.player.y };
      return true;
    }
    clearDestination() {
      this.navigationTargetId = null;
      this.navigationRoute = [];
      this.navigationFrom = null;
    }
    openAtlas() {
      E.push(new GP.AtlasPanel(this));
    }
    updateNavigation(dt) {
      if (!this.navigationTargetId) return;
      const target = this.navigationTarget();
      if (!target) return this.clearDestination();
      if (U.dist(this.player.x, this.player.y, target.x, target.y) < 55) {
        const entity = this.player.interactTarget;
        const arrived = target.kind === 'moment' ? entity?.moment?.id === target.id
          : target.kind === 'ledger' ? entity === this.slab : entity === this.epilogueTerminal;
        if (arrived) return this.clearDestination();
      }
      this.navigationTimer -= dt;
      if (this.navigationTimer > 0) return;
      this.navigationTimer = 0.5;
      if (this.navigationFrom && U.dist(
        this.player.x, this.player.y, this.navigationFrom.x, this.navigationFrom.y,
      ) < 36) return;
      this.setDestination(target.id);
    }
    exit() {
      for (const pane of this.panes || []) pane.preview.dispose();
      DM.Audio.ambience(null);
    }
    update(dt) {
      this.t += dt;
      const atlasButton = { x: 1020, y: 63, w: 235, h: 33 };
      const mouse = I.mouse;
      const atlasClick = I.clicked() && mouse.x >= atlasButton.x && mouse.x <= atlasButton.x + atlasButton.w &&
        mouse.y >= atlasButton.y && mouse.y <= atlasButton.y + atlasButton.h;
      if (I.pressed('hint') || atlasClick) {
        I.consume('hint');
        I.consume('confirm');
        this.openAtlas();
        return;
      }
      if (I.pressed('back') || I.pressed('pause')) {
        I.consume('back');
        I.consume('pause');
        E.push(new LeavePanel(this));
        return;
      }
      const world = this.world;
      world.mouse = world.camera.toWorld(I.mouse.x, I.mouse.y);
      world.ceasefire = true;
      world.update(dt);
      this.updateNavigation(dt);
      world.camera.follow(this.player.x, this.player.y - 180, dt, 5);
      this.previewT -= dt;
      if (this.previewT <= 0 && this.panes.length) {
        const near = this.panes.filter(
          (pane) => U.dist(pane.x, pane.y, this.player.x, this.player.y) < 1000,
        );
        const pool = near.length ? near : this.panes;
        pool[this.previewCursor++ % pool.length].preview.refresh(this.t);
        this.previewT = 0.15;
      }
    }
    render(g) {
      this.world.render(g);
      G.postFx(g, this.t);
      G.panel(g, 25, 18, 782, 78, { fill: 'rgba(4,12,21,0.88)', accent: '#9bd5ed' });
      G.text(g, 'THE GLASS PALACE', 45, 54, {
        size: 32,
        spacing: 5,
        weight: 700,
        color: '#e2f5fb',
      });
      G.text(g, 'Every moment remains. Choose which one to enter.', 45, 80, {
        size: 15,
        color: '#b1ccd9',
      });
      G.text(
        g,
        this.structureCount + ' / ' + this.maximumFragmentsSnapshot + ' GLASS FRAGMENTS',
        1245,
        49,
        {
          size: 19,
          align: 'right',
          color: GOLD,
          spacing: 2,
        },
      );
      G.panel(g, 1020, 63, 235, 33, { fill: 'rgba(4,12,21,0.9)', accent: BLUE });
      G.text(g, 'H · MOMENT ATLAS', 1137, 85, {
        size: 15, align: 'center', color: '#e2f5fb', spacing: 1,
      });
      this.renderNavigation(g);
      const warning =
        GP.warning ||
        (GP.available === false ? 'Palace progress is session only. Keep this window open.' : '');
      if (warning) {
        G.panel(g, 100, 600, 1080, 49, { fill: 'rgba(17,13,17,0.95)', accent: '#d8aa76' });
        G.paragraph(g, warning, 640, 612, 1036, 20, {
          size: 15,
          font: DM.FONTS.type,
          align: 'center',
          color: '#f0c998',
        });
      }
      const target = this.player.interactTarget;
      const hint = target
        ? target.interact.label
        : 'WASD / ARROWS · WALK     E · READ / ENTER     H · ATLAS     ESC · LEAVE';
      G.panel(g, 205, DM.H - 57, 870, 36, { fill: 'rgba(3,10,19,0.9)', accent: '#84b9d0' });
      G.text(g, hint, 640, DM.H - 33, { size: 15, align: 'center', color: '#e4eadc', spacing: 1 });
    }
    renderNavigation(g) {
      if (!this.navigationTargetId) return;
      const target = this.navigationTarget();
      if (!target) return;
      G.panel(g, 240, 545, 800, 43, { fill: 'rgba(3,10,19,0.94)', accent: GOLD });
      G.text(g, 'FOLLOW THE GLASS · ' + target.title.toUpperCase(), 640, 573, {
        size: 16, align: 'center', color: '#f0dfbd', spacing: 1,
      });
      const point = this.world.camera.toScreen(target.x, target.y);
      if (point.x >= 55 && point.x <= DM.W - 55 && point.y >= 120 && point.y <= 510) return;
      const dx = point.x - DM.W / 2;
      const dy = point.y - DM.H / 2;
      const scale = Math.min(540 / Math.max(1, Math.abs(dx)), 165 / Math.max(1, Math.abs(dy)), 1);
      g.save();
      g.translate(DM.W / 2 + dx * scale, DM.H / 2 + dy * scale);
      g.rotate(Math.atan2(dy, dx));
      g.fillStyle = GOLD;
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(-8, -8);
      g.lineTo(-4, 0);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  Object.assign(GP, {
    MomentPreview,
    MomentPane,
    GlassPiece,
    PalaceWalker,
    MomentPanel,
    ChallengesPanel,
    LedgerPanel,
    LeavePanel,
    MomentMenu: MomentPanel,
  });
  DM.Scenes.GlassPalace = GlassPalace;
})();
