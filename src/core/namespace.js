/*
 * DR. MANHATTAN: THE WATCHMAKER'S SON
 * Global namespace.
 *
 * Every source file is a plain (non-module) script that attaches itself to
 * window.DM. That keeps the game runnable straight from file:// — just open
 * index.html — on any OS, with no server and no build step. Script load order
 * is declared once, in index.html.
 */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});

  DM.VERSION = '0.1.0';

  // Logical resolution. The engine letterboxes this to any window size.
  DM.W = 1280;
  DM.H = 720;

  // Developer mode: add ?dev or #dev to the URL. Unlocks every chapter and
  // enables the debug overlay (` key) and stage skipping (] key).
  DM.DEV = /[?&#]dev\b/i.test(location.search + location.hash);

  DM.FONTS = {
    display: "'Oswald', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif",
    type: "'Special Elite', 'Courier New', Courier, monospace",
    hand: "'Patrick Hand', 'Trebuchet MS', 'Segoe UI', sans-serif",
  };

  // Shared palette. Chapter maps add their own colours on top of these.
  DM.C = {
    blue: '#5fd4ff',
    blueDeep: '#1b7fd0',
    blueGlow: '#7fe3ff',
    white: '#eefbff',
    paper: '#f1e7cc',
    ink: '#16120f',
    yellow: '#f2c418',
    blood: '#c4302b',
    red: '#ff5a4a',
    orange: '#ff9a3c',
    green: '#7bd88f',
    uiBg: 'rgba(6, 12, 22, 0.78)',
    uiEdge: 'rgba(95, 212, 255, 0.45)',
    dim: '#7f93a6',
  };
})();
