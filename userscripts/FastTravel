// ==UserScript==
// @name         Дозоры — Быстрое перемещение
// @namespace    http://dozory.ru/
// @version      1.2
// @description  Запоминает последний способ перемещения и применяет его ко всем переходам автоматически. ПКМ — выбрать другой транспорт.
// @author       White Witcher (featuring Claude AI) (порт moving.xml by Lockal, ФюрерКувалда)
// @include      http://game.dozory.ru/cgi-bin/main.cgi*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.name !== 'action') return;

  var STORAGE_KEY = 'doz_moving_type';

  function getType() { return localStorage.getItem(STORAGE_KEY) || ''; }
  function setType(t) { localStorage.setItem(STORAGE_KEY, t); }

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    if (href.indexOf('rm=go') === -1) return;
    if (!href.match(/[?&]r=(\d+)/)) return; 

    var m = href.match(/[?&]t=([a-z]+)/);
    var chosenType = m ? m[1] : 'walk';

    var p = el;
    var inWindow = false;
    while (p) {
      if (p.id === 'links' || p.id === 'links2') { inWindow = true; break; }
      p = p.parentElement;
    }
    if (!inWindow) return;

    setType(chosenType);
  }, true);

  function hookCt() {
    if (typeof window.ct !== 'function') return false;
    if (window._doz_ct_hooked) return true;
    window._doz_ct_hooked = true;

    var origCt = window.ct;
    window._doz_origCt = origCt; 
    window.ct = function(regionId, regionName) {
      var type = getType();

      if (!type) {
        return origCt.apply(this, arguments);
      }

      window.location.href = '/cgi-bin/main.cgi?rm=go&t=' + type + '&r=' + regionId;
    };
    return true;
  }

  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName !== 'AREA') return;
    var href = e.target.getAttribute('href') || '';

    var m = href.match(/ct\s*\(\s*(\d+)\s*,\s*'([^']*)'\s*\)/);
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();

    if (typeof window._doz_origCt === 'function') {
      window._doz_origCt(parseInt(m[1]), m[2]);
    }
  }, true);

  function start() {
    if (!hookCt()) {

      var attempts = 0;
      var poll = setInterval(function() {
        if (hookCt() || ++attempts > 30) clearInterval(poll);
      }, 200);
    }
  }

  window.addEventListener('load', function() { setTimeout(start, 100); });
  if (document.readyState === 'complete') setTimeout(start, 100);

})();
