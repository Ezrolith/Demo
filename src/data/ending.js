/*
 * The ending, as data. Scenes.Ending tallies the saved chapter completions
 * into a `run` and shows, in order, every page whose when(run) holds:
 *
 *   pages: [{ text: 'string' | (run) => 'string', when?: (run) => bool }]
 *
 *   run = { killed, spared, memories, memoryTotal, time, tone, flags }
 *     tone   'unknown'  nobody was spared or unmade (a Chapter Select run): a neutral page
 *            'gentle'   nobody unmade, somebody spared
 *            'mixed'    some of each, no more unmade than spared
 *            'detached' more unmade than spared
 *     flags  every chapter's persisted story flags (Save.data.completed[id].flags),
 *            merged in chapter order: heldWatch (Prologue), officersSafe and
 *            molochArrested / molochEscaped / molochGone (Chapter II), laurie
 *            (Chapter IV), witness 'heard' | 'free' | 'silenced' (Chapter V).
 *
 * Chapters declare how many memories they hide (`memories: n` in their
 * registration); the total is the sum. All writing here is original.
 */
(function () {
  'use strict';
  const DM = window.DM;

  const WORDS = ['no one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const num = (n) => WORDS[n] || String(n);
  const people = (n) => (n === 1 ? 'one person' : `${num(n)} people`);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const tone = (t) => (run) => run.tone === t;
  const flag = (k, v) => (run) => (v === undefined ? !!run.flags[k] : run.flags[k] === v);

  const EndingData = {
    toneOf(killed, spared) {
      if (killed + spared === 0) return 'unknown';
      if (killed === 0) return 'gentle';
      return killed > spared ? 'detached' : 'mixed';
    },

    // The sum of the memories every chapter declares.
    memoryTotal() {
      let n = 0;
      for (const ch of (DM.Chapters && DM.Chapters.list) || []) {
        const m = ch.memories;
        n += Array.isArray(m) ? m.length : Number.isFinite(m) ? m : 0;
      }
      return n;
    },

    // Everything the ending needs from a save.
    run(save) {
      const done = (save && save.completed) || {};
      let killed = 0, spared = 0, memories = 0, time = 0;
      const flags = {};
      const order = ((DM.Chapters && DM.Chapters.list) || []).map((c) => c.id);
      for (const id of Object.keys(done)) if (!order.includes(id)) order.push(id);
      for (const id of order) {
        const c = done[id];
        if (!c) continue;
        killed += c.disintegrated || 0;
        spared += c.spared || 0;
        memories += c.memories || 0;
        time += c.time || 0;
        if (c.flags) Object.assign(flags, c.flags);
      }
      return { killed, spared, memories, time, memoryTotal: this.memoryTotal(), tone: this.toneOf(killed, spared), flags };
    },

    pages: [
      { text: 'Midnight. The clock in my mind stops, and does not start again.' },
      { text: 'Adrian asks me whether he did the right thing. Whether it all worked out, in the end.' },
      { text: 'I tell him there is no end. There is only the next moment, and the one after it, and all of them at once.' },

      // ---- what the player did, in the order it happened ----
      {
        when: flag('heldWatch'),
        text: "In my last seconds as a man I held Janey's watch. I had mended it that morning. It was the last thing my hands ever did; everything since, I have made without them.",
      },
      {
        when: (run) => run.flags.officersSafe === 3,
        text: 'Three police officers walked off Pier 9 on their own feet. One of them named his son after me. I have watched the boy grow up, from every side at once.',
      },
      {
        when: (run) => run.flags.pressesDown === 2,
        text: 'At Pier 9 I stopped two printing presses. For the first time that night, the warehouse was quiet. Their last counterfeit notes fluttered to the floor, and nobody had to die for it.',
      },
      {
        when: flag('molochArrested'),
        text: 'Pier 9, 1966: I set a getaway car down as gently as a cup on a saucer, and a frightened man climbed out with his hands up. He stood trial. He grew old. Some things can be put back together.',
      },
      {
        when: flag('molochEscaped'),
        text: 'Pier 9, 1966: a getaway car reached the street before I reached it. I could have stopped it. I was busy noticing that I could have.',
      },
      {
        when: flag('molochGone'),
        text: 'Pier 9, 1966: I unmade a getaway car with a man still inside it. The newspapers called it justice. I called it nothing at all, and that should have frightened me.',
      },
      {
        when: flag('laurie'),
        text: 'On Mars, Laurie made me look at one human life for long enough to see how unlikely it was. I am still looking.',
      },
      {
        when: (run) => run.memoryTotal > 0 && run.memories >= run.memoryTotal,
        text: 'Every memory I scattered across time, I found again. None of them were lost. They were only waiting for me to arrive.',
      },
      {
        when: flag('witness', 'heard'),
        text: 'In the snow outside Karnak, a masked man demanded that the truth be told. I stood in front of him and listened, and then I stepped aside. What he did with it, I chose not to see.',
      },
      {
        when: flag('witness', 'free'),
        text: 'In the snow outside Karnak, a masked man set out to tell the world. I let him go without a word. Whether the truth arrives, or freezes on the way, I have chosen not to see.',
      },
      {
        when: flag('witness', 'silenced'),
        text: 'In the snow outside Karnak, a masked man would not keep the secret that was keeping the world alive. I unmade him. The secret holds. There is a shape in the snow where he stood.',
      },

      // ---- how the player treated people ----
      {
        when: tone('unknown'),
        text: 'I look back across the years and find no one I set down, and no one I unmade. Perhaps I only watched. It is too late to tell, and too early.',
      },
      {
        when: tone('gentle'),
        text: (run) => `I set ${people(run.spared)} down gently, when it would have been easier not to. Not one of them came apart at my touch.`,
      },
      { when: tone('gentle'), text: 'For once, the numbers do not describe a loss. Somewhere there are people living the years I left them. I find that I want to stay and see what they do with them.' },
      {
        when: tone('mixed'),
        text: (run) => `I set ${people(run.spared)} down gently. ${cap(people(run.killed))} I unmade. I hold both numbers at once, the way I hold everything.`,
      },
      { when: tone('mixed'), text: 'I cannot tell which of them I was. Perhaps that was what being human felt like. I will go somewhere quieter, and think about it for a few thousand years.' },
      {
        when: tone('detached'),
        text: (run) => `${cap(people(run.killed))} came apart at my touch. I remember each of them; I remember them still being alive.`,
      },
      { when: tone('detached'), text: 'Beyond this galaxy there are worlds without witnesses. I turn towards them. Even here, at the edge of everything, leaving is easier than answering.' },

      {
        text: (run) => (run.flags.heldWatch
          ? "Somewhere, Janey's watch is still ticking. I can see every moment it will ever measure."
          : 'Somewhere, a watch is ticking. I can see every moment it will ever measure.'),
      },
    ],

    // The pages this run has earned, as strings.
    build(run) {
      const out = [];
      for (const p of this.pages) {
        if (p.when && !p.when(run)) continue;
        const t = typeof p.text === 'function' ? p.text(run) : p.text;
        if (t) out.push(t);
      }
      return out;
    },
  };

  DM.EndingData = EndingData;
})();
