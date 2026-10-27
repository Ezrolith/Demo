/* A ninety-second coda built on the existing ending and dialogue scenes. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const E = DM.Engine;
  const G = DM.Gfx;
  const I = DM.Input;

  const stories = {
    return: {
      title: 'A PLACE AT THE TABLE',
      pages: [
        'The last fragment settles. Nothing has been repaired by the sound it makes. ' +
          'The glass only gives the silence an edge.',
        'I remember a kitchen window in winter. Somebody has left a lamp on, ' +
          'although the person they expect is already late.',
        'Across every pane there is a hand that could have closed, and did not. I ' +
          'cannot make those choices inevitable. I can remember them.',
        'Distance has made the Earth small enough to hold in one glance. That was ' +
          'never the same as understanding the people on it.',
        'I could arrange another world without anyone asking for room. A world with ' +
          'no wrong turns would also have no arrivals.',
        'I will return to Earth. I will not promise to mend every hour. I can stand ' +
          'beside somebody while the next one begins.',
      ],
      dialogue: [
        ['janey', 'You used to wait until the kettle clicked. You never asked it to hurry.'],
        ['manhattan', 'There are things I can do in an instant. Being present is not one of them.'],
      ],
    },
    observe: {
      title: 'THE UNFINISHED HOUR',
      pages: [
        'The palace is assembled, but the view through it remains broken into ' +
          'moments. A completed shape is not a completed life.',
        'I remember a station platform. Nobody there knows which conversation they ' +
          'will carry home, or which silence will stay.',
        'The ledger contains gestures of care and gestures that cannot be taken ' +
          'back. Neither column explains the other away.',
        'I have mistaken the ability to see a consequence for permission to choose ' +
          'it. The glass offers no such permission.',
        'There is a blue point beyond the desert. I can reach it before this shadow ' +
          'moves. I do not have to decide what it means first.',
        'I will go as far as the Earth’s horizon, and listen. Before I return to ' +
          'anyone’s life, I will let them decide whether to open the door.',
      ],
      dialogue: [
        ['janey', 'Sometimes you came back with an answer before I had finished the question.'],
        ['manhattan', 'Then this time I can wait for the question.'],
      ],
    },
    depart: {
      title: 'WHAT DISTANCE CANNOT DO',
      pages: [
        'The final fragment finds its place. It reflects my face without correcting anything behind it.',
        'I remember dust settling where a person stood. There is no angle of the ' +
          'glass from which that absence becomes a different choice.',
        'I can count what I unmade. Counting is not a kindness, but refusing to ' +
          'count would be another way of leaving them behind.',
        'The Earth turns beyond the red sky. Its smallness has never made the lives upon it small.',
        'I will not return to call my power protection. Not while I still confuse a ' +
          'quiet room with a room in which nobody can object.',
        'I will leave Earth for now, carrying the names I know and the weight of the ' +
          'names I do not. Distance will not make me innocent.',
      ],
      dialogue: [
        [
          'janey',
          'When you said everything was already decided, I wondered who was left to speak.',
        ],
        [
          'manhattan',
          'Someone remains responsible for the moment I am in. I remain here long enough to know that it is me.',
        ],
      ],
    },
  };

  class PalaceEpilogue extends DM.Scenes.Ending {
    constructor(hub = null) {
      super();
      this.hub = hub;
      this.variant = GP.epilogueVariant();
      this.story = stories[this.variant];
      this.pages = this.story.pages;
      this.ledger = GP.ledger();
      this.stats = {
        killed: this.ledger.unmade,
        spared: this.ledger.spared,
        memories: this.ledger.memories,
        time: this.ledger.time,
      };
      this.nominalDuration = 90;
      this.totalDuration = 90 * DM.SettingsSchema.readTime();
      this.segmentDuration = this.totalDuration / 6;
      this.segments = this.pages.map((text, index) => ({
        text,
        duration: this.segmentDuration,
        index,
      }));
      this.dialog = new DM.Dialog();
      this.t = 0;
      this.page = -1;
      this.pageT = 0;
      this.complete = false;
      this.forceReveal = false;
    }
    enter() {
      if (!GP.epilogueReady()) {
        this.denied = true;
        GP.open();
        return;
      }
      I.clearAll();
      DM.Audio.stopHums();
      DM.Audio.music.play('glass_palace', { intensity: 0 });
      this.selectPage(0);
    }
    selectPage(index) {
      this.page = index;
      this.pageT = 0;
      this.forceReveal = false;
      this.dialog.close();
      if (index === 1) this.dialog.open([this.story.dialogue[0]]);
      if (index === 3) this.dialog.open([this.story.dialogue[1]]);
    }
    leave() {
      I.clearAll();
      if (this.hub && E.stack.includes(this.hub)) E.pop();
      else GP.open();
    }
    update(dt) {
      if (I.pressed('back')) {
        I.consume('back');
        this.leave();
        return;
      }
      if (this.complete) {
        this.menu.update(dt);
        return;
      }
      this.t += dt;
      const page = Math.min(5, Math.floor(this.t / this.segmentDuration));
      if (page !== this.page) this.selectPage(page);
      this.pageT = this.t - this.page * this.segmentDuration;
      this.dialog.update(dt);
      if (I.pressed('confirm')) this.forceReveal = true;
      if (this.t >= this.totalDuration) {
        this.complete = true;
        this.page = this.pages.length;
        this.dialog.close();
        GP.markEpilogueSeen(this.variant);
        I.clearAll();
        this.menu = new DM.UI.Menu(
          [
            { label: 'RETURN TO THE PALACE', action: () => this.leave() },
            { label: 'RETURN TO THE TITLE', action: () => E.set(new DM.Scenes.Title()) },
          ],
          { x: 640, y: 540, w: 620, align: 'center', itemH: 44, size: 20 },
        );
      }
    }
    render(g) {
      if (!this.complete) {
        const actual = this.pageT;
        if (this.forceReveal) this.pageT = 1000;
        super.render(g);
        this.pageT = actual;
        g.fillStyle = '#05070c';
        g.fillRect(0, DM.H - 56, DM.W, 56);
        G.text(g, 'THE GLASS PALACE · ' + this.story.title, 640, 53, {
          size: 16,
          align: 'center',
          spacing: 3,
          color: '#b8dfe8',
        });
        G.text(g, 'A QUIET MOMENT · SPACE REVEALS TEXT · ESC RETURNS', 640, DM.H - 24, {
          size: 13,
          align: 'center',
          color: '#9cb5c1',
          spacing: 1,
        });
        this.dialog.render(g);
        return;
      }
      g.fillStyle = '#05070c';
      g.fillRect(0, 0, DM.W, DM.H);
      G.glow(g, 640, 245, 280, '#8bbecb', 0.18);
      G.clock(g, 640, 220, 90, 0);
      G.text(g, this.story.title, 640, 365, {
        size: 34,
        align: 'center',
        spacing: 4,
        color: '#deece8',
      });
      G.paragraph(g, this.pages.at(-1), 640, 400, 890, 30, {
        size: 21,
        align: 'center',
        font: DM.FONTS.type,
        color: '#c3d5d6',
      });
      this.menu.render(g);
    }
  }
  GP.epilogueStories = stories;
  GP.Epilogue = PalaceEpilogue;
  GP.openEpilogue = (hub) => {
    if (!GP.epilogueReady()) return false;
    E.push(new PalaceEpilogue(hub || E.top()));
    return true;
  };
  DM.Scenes.GlassPalaceEpilogue = PalaceEpilogue;
})();
