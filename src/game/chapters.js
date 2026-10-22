/*
 * Chapter registry.
 *
 * A chapter is data + scripts (see src/data/chapters/*.js):
 *   id, numeral, title, date, place, clock (minutes to midnight), color,
 *   music, form ('human' | 'awareness' | 'manhattan'),
 *   epigraph { text, by }, intro [narration lines],
 *   maps { name(ctx) -> World },            // world builders; set world.spawn
 *   stages [{ id, map, checkpoint, grants, run*(ctx), restore(ctx) }]
 *
 * Chapters play in registration order. Powers carry forward: a chapter starts
 * with every power granted by the stages of all earlier chapters.
 */
(function () {
  'use strict';
  const DM = window.DM;

  const Chapters = { list: [], byId: {} };

  Chapters.register = (def) => {
    def.index = Chapters.list.length;
    def.stages = def.stages || [];
    Chapters.list.push(def);
    Chapters.byId[def.id] = def;
    return def;
  };
  Chapters.get = (id) => Chapters.byId[id];
  Chapters.next = (id) => {
    const c = Chapters.byId[id];
    return c ? Chapters.list[c.index + 1] || null : null;
  };
  Chapters.powersBefore = (index) => {
    const set = new Set();
    for (let i = 0; i < index; i++) for (const st of Chapters.list[i].stages) for (const g of st.grants || []) set.add(g);
    return [...set];
  };

  DM.Chapters = Chapters;
})();
