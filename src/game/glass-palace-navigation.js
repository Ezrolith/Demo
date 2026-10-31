/* Palace-local wayfinding. Selecting a pane never moves Jon or starts a level. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const G = DM.Gfx;
  const I = DM.Input;
  const E = DM.Engine;
  const BLUE = '#b9ecff';
  const GOLD = '#e2c287';
  const FILTERS = ['all', 'unfinished', 'checkpoints'];
  const FILTER_LABELS = { all: 'ALL MOMENTS', unfinished: 'MISSING FRAGMENTS', checkpoints: 'CHECKPOINTS' };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function freePoint(world, x, y, radius) {
    if (world.isFree(x, y, radius)) return true;
    if (x < radius || y < radius || x > world.w - radius || y > world.h - radius) return false;
    // Collision resolution can leave Jon exactly tangent to a wall. Zero-depth
    // contact is a valid starting position, not a reason to discard his guide.
    return world.walls.every((wall) => {
      if (wall.noCollide) return true;
      const hit = DM.U.circleRect(x, y, radius, wall);
      return !hit || hit.depth <= 0.001;
    });
  }

  function freeSegment(world, a, b, radius) {
    const samples = Math.max(1, Math.ceil(distance(a, b) / 8));
    for (let n = 0; n <= samples; n++) {
      const t = n / samples;
      if (!freePoint(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius)) return false;
    }
    return true;
  }

  // A small, event-driven grid search includes wall clearance and diagonal corners.
  // Render and ordinary walking never rebuild the grid.
  GP.planPalaceRoute = (world, start, goal, radius) => {
    if (!world || !freePoint(world, start.x, start.y, radius) || !freePoint(world, goal.x, goal.y, radius)) return [];
    if (freeSegment(world, start, goal, radius)) return [{ x: start.x, y: start.y }, { x: goal.x, y: goal.y }];
    const step = 60;
    const nodes = [];
    const grid = new Map();
    for (let y = step; y < world.h; y += step) {
      for (let x = step; x < world.w; x += step) {
        if (!world.isFree(x, y, radius)) continue;
        const node = { x, y, parent: null, cost: Infinity, score: Infinity };
        nodes.push(node);
        grid.set(x + ':' + y, node);
      }
    }
    const open = new Set();
    const closed = new Set();
    for (const node of nodes) {
      if (distance(start, node) > step * 2 || !freeSegment(world, start, node, radius)) continue;
      node.cost = distance(start, node);
      node.score = node.cost + distance(node, goal);
      open.add(node);
    }
    let end = null;
    while (open.size) {
      let current = null;
      for (const node of open) if (!current || node.score < current.score) current = node;
      open.delete(current);
      if (distance(current, goal) <= step * 2 && freeSegment(world, current, goal, radius)) {
        end = current;
        break;
      }
      closed.add(current);
      for (let dy = -step; dy <= step; dy += step) {
        for (let dx = -step; dx <= step; dx += step) {
          if (!dx && !dy) continue;
          const next = grid.get(current.x + dx + ':' + (current.y + dy));
          if (!next || closed.has(next) || !freeSegment(world, current, next, radius)) continue;
          const cost = current.cost + Math.hypot(dx, dy);
          if (cost >= next.cost) continue;
          next.parent = current;
          next.cost = cost;
          next.score = cost + distance(next, goal);
          open.add(next);
        }
      }
    }
    if (!end) return [];
    const path = [{ x: goal.x, y: goal.y }];
    for (let node = end; node; node = node.parent) path.push({ x: node.x, y: node.y });
    path.push({ x: start.x, y: start.y });
    path.reverse();
    const route = [path[0]];
    for (let index = 0; index < path.length - 1;) {
      let next = path.length - 1;
      while (next > index + 1 && !freeSegment(world, path[index], path[next], radius)) next--;
      route.push(path[next]);
      index = next;
    }
    return route;
  };

  class WalkingGuide extends DM.Entity {
    constructor(hub) {
      super({
        x: hub.world.w / 2,
        y: hub.world.h / 2,
        r: Math.hypot(hub.world.w, hub.world.h) / 2,
        static: true,
        body: false,
        solid: false,
        layer: 0,
        disintegratable: false,
      });
      this.hub = hub;
    }
    render(g) {
      const hub = this.hub;
      if (!hub.navigationTargetId || !hub.navigationRoute.length) return;
      const points = [hub.player, ...hub.navigationRoute.slice(1)];
      g.save();
      g.strokeStyle = 'rgba(211,239,245,0.6)';
      g.lineWidth = 2;
      g.setLineDash([4, 12]);
      g.beginPath();
      points.forEach((point, index) => {
        if (index) g.lineTo(point.x, point.y);
        else g.moveTo(point.x, point.y);
      });
      g.stroke();
      g.setLineDash([]);
      const goal = points.at(-1);
      g.strokeStyle = GOLD;
      g.beginPath();
      g.arc(goal.x, goal.y, 24, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  class AtlasPanel {
    constructor(hub) {
      this.hub = hub;
      this.opaque = false;
      this.cursor = 'pointer';
      this.filter = 'all';
      this.page = 0;
      this.pageSize = 5;
    }
    enter() {
      I.clearAll();
      this.refresh();
    }
    close() {
      I.clearAll();
      E.pop();
    }
    refresh() {
      this.destinations = this.hub.destinations();
      this.entries = this.destinations.filter((entry) => {
        if (this.filter === 'unfinished') return entry.kind === 'moment' && entry.earned < entry.total;
        if (this.filter === 'checkpoints') return entry.kind === 'moment' && !!entry.checkpoint;
        return true;
      });
      this.pageCount = Math.max(1, Math.ceil(this.entries.length / this.pageSize));
      this.page = DM.U.clamp(this.page, 0, this.pageCount - 1);
      const items = [{
        label: 'SHOW',
        value: () => FILTER_LABELS[this.filter],
        adjust: (direction) => {
          this.filter = FILTERS[(FILTERS.indexOf(this.filter) + direction + FILTERS.length) % FILTERS.length];
          this.page = 0;
          this.refresh();
        },
      }];
      for (const entry of this.entries.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize)) {
        items.push({
          label: entry.title.toUpperCase(),
          destinationId: entry.id,
          value: () => entry.kind === 'moment'
            ? (entry.checkpoint ? 'RESUME · ' : '') + entry.earned + ' / ' + entry.total
            : 'READ',
          action: () => {
            if (this.hub.setDestination(entry.id)) this.close();
          },
        });
      }
      if (!this.entries.length) items.push({ label: 'NO MOMENTS MATCH THIS VIEW', disabled: true });
      if (this.pageCount > 1) {
        items.push({
          label: 'PAGE',
          value: () => (this.page + 1) + ' / ' + this.pageCount,
          adjust: (direction) => {
            this.page = (this.page + direction + this.pageCount) % this.pageCount;
            this.refresh();
            this.menu.sel = this.menu.items.findIndex((item) => item.label === 'PAGE');
          },
        });
      }
      items.push({
        label: 'CLEAR WALKING GUIDE',
        disabled: !this.hub.navigationTargetId,
        action: () => {
          this.hub.clearDestination();
          this.close();
        },
      });
      items.push({ label: 'RETURN TO THE PALACE', action: () => this.close() });
      this.menu = new DM.UI.Menu(items, {
        x: 112, y: 196, w: 660, itemH: 42, size: 18, valueW: 210, onBack: () => this.close(),
      });
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      G.panel(g, 72, 68, 1136, 584, { fill: 'rgba(2,7,14,0.96)', accent: BLUE });
      G.text(g, 'MOMENT ATLAS', 112, 126, { size: 34, color: BLUE, spacing: 3, weight: 700 });
      G.text(g, 'Choose a destination, then follow the glass trail. You remain in control.', 112, 162, {
        size: 15, color: '#b1c4ce',
      });
      this.menu.render(g);
      const x = 858;
      const y = 236;
      const width = 300;
      const height = 258;
      const sx = width / this.hub.world.w;
      const sy = height / this.hub.world.h;
      const selectedId = this.menu.items[this.menu.sel]?.destinationId || this.hub.navigationTargetId;
      g.fillStyle = '#241f25';
      g.fillRect(x, y, width, height);
      g.strokeStyle = 'rgba(185,231,245,0.5)';
      g.strokeRect(x + 110 * sx, y + 180 * sy, 1880 * sx, 1470 * sy);
      for (const entry of this.destinations) {
        const selected = entry.id === selectedId;
        g.fillStyle = selected ? GOLD : entry.kind === 'moment' ? '#99cada' : '#b0d6b3';
        g.beginPath();
        g.arc(x + entry.x * sx, y + entry.y * sy, selected ? 6 : 3.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x + this.hub.player.x * sx, y + this.hub.player.y * sy, 4, 0, Math.PI * 2);
      g.fill();
      G.text(g, 'WHITE · YOU    GOLD · DESTINATION', x + width / 2, 522, {
        size: 13, align: 'center', color: '#bed4df',
      });
      G.text(g, 'Arrows / WASD · Choose', x + width / 2, 554, {
        size: 14, align: 'center', color: '#bed4df',
      });
      G.text(g, 'Left / Right · Filter or page', x + width / 2, 578, {
        size: 14, align: 'center', color: '#bed4df',
      });
      G.text(g, 'Enter · Guide     Esc · Return', x + width / 2, 602, {
        size: 14, align: 'center', color: '#bed4df',
      });
    }
  }

  Object.assign(GP, { AtlasPanel, WalkingGuide });
})();
