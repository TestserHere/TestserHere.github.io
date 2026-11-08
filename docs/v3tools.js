/* Shared helpers for Toolkit and Class Toolkit */

window.V3Tools = (function () {
  'use strict';

  // The home page shows its own title and Done button when an app opens inside it.
  document.documentElement.classList.toggle('embedded', window.top !== window.self);

  const $ = (id) => document.getElementById(id);

  /* Storage can throw in private windows, so every access is guarded. */
  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* not remembered */ }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setupTabs(storageKey, onShow) {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

    function show(name, focus) {
      tabs.forEach((tab) => {
        const active = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        $('panel-' + tab.dataset.tab).hidden = !active;
        if (active && focus) tab.focus();
      });
      write(storageKey, name);
      if (onShow) onShow(name);
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => show(tab.dataset.tab));
      tab.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        show(tabs[(index + step + tabs.length) % tabs.length].dataset.tab, true);
      });
    });

    const saved = read(storageKey, null);
    show(tabs.some((tab) => tab.dataset.tab === saved) ? saved : tabs[0].dataset.tab);
    return { show };
  }

  /* options.read() returns { value, min, max }; options.write(value) stores the change. */
  function setupStepper(root, options) {
    const output = root.querySelector('output');
    const [down, up] = root.querySelectorAll('button');

    function refresh() {
      const { value, min, max } = options.read();
      output.textContent = value;
      down.disabled = value <= min;
      up.disabled = value >= max;
    }

    function change(delta) {
      const { value, min, max } = options.read();
      options.write(Math.min(max, Math.max(min, value + delta)));
      refresh();
    }

    down.addEventListener('click', () => change(-1));
    up.addEventListener('click', () => change(1));
    refresh();
    return refresh;
  }

  function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + seconds : minutes + ':' + seconds;
  }

  return { $, read, write, el, setupTabs, setupStepper, formatDuration };
})();
