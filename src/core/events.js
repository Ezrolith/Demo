/* Tiny publish/subscribe bus. Used for stats, achievements-to-come and decoupled reactions. */
(function () {
  'use strict';
  const listeners = new Map();

  window.DM.Events = {
    // Returns an unsubscribe function.
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name) && listeners.get(name).delete(fn);
    },
    emit(name, data) {
      const set = listeners.get(name);
      if (set) for (const fn of [...set]) fn(data);
    },
    clear(name) {
      if (name) listeners.delete(name);
      else listeners.clear();
    },
  };
})();
