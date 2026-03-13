// ==UserScript==
// @name         Дозоры — Рекаст
// @namespace    http://dozory.ru/
// @version      2.1
// @description  Кнопка «Рекаст» - повтор последний действий «Применить» или попытки нападения. Быстрая клавиша - F2.
// @author       White Witcher (featuring Claude AI)
// @include      http://game.dozory.ru/cgi-bin/main.cgi*
// @include      http://game.dozory.ru/*
// @include      http://dozory.ru/*
// @include      http://*.dozory.ru/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var HOTKEY = 'F2';

  if (window.name !== 'action') return;

  function getActsSel()      { try { return window.parent.acts_sel; }             catch(e) { return undefined; } }
  function getSnapshot()     { try { return window.parent._dozSnapshot || null; } catch(e) { return null; } }
  function setSnapshot(a)    { try { window.parent._dozSnapshot = a; }            catch(e) {} }
  function getDoActionSnap() { try { return window.parent._dozDoAction || null; } catch(e) { return null; } }
  function setDoActionSnap(s){ try { window.parent._dozDoAction = s; }            catch(e) {} }

  function getAllActCodes() {
    var codes = {};
    ['acts_br','acts_mg','acts_ar','acts_am'].forEach(function(pool) {
      try {
        var arr = window[pool];
        if (!Array.isArray(arr)) return;
        arr.forEach(function(a) {
          if (!a) return;
          if (a[3]) codes[a[3]] = true;
          if (a[4]) codes[a[4]] = true;
        });
      } catch(e) {}
    });
    return codes;
  }

  function isSnapshotValid(snap) {
    if (!snap || !snap.acts || snap.acts.length === 0) return false;
    var available = getAllActCodes();
   
    if (Object.keys(available).length === 0) return true;

    for (var i = 0; i < snap.acts.length; i++) {
      var a = snap.acts[i];
      if (!a) continue;
      var actCode = a[4]; // acts_sel хранит act_code в [4]
      if (actCode && available[actCode]) return true;
    }
    return false;
  }

  function hookSendActions() {
    if (typeof window.sendActions !== 'function') return;
    if (window._dozHooked) return;
    window._dozHooked = true;
    var orig = window.sendActions;
    window.sendActions = function(mode) {
      if (mode === 0) {
        try {
          var sel = getActsSel();
          if (sel && sel.length > 0) {
            setSnapshot({ acts: sel.map(function(a){ return a ? a.slice() : a; }) });
            setDoActionSnap(null);
            updateBtn();
          }
        } catch(e) {}
      }
      return orig.apply(this, arguments);
    };
  }

  function hookDoActionIn(win) {
    try {
      if (!win || typeof win.doAction !== 'function') return;
      if (win._dozDoActionHooked) return;
      win._dozDoActionHooked = true;
      var orig = win.doAction;
      win.doAction = function(actionType, targetId) {
        try {
          setDoActionSnap({ actionType: actionType, targetId: targetId });
          setSnapshot(null);
          updateBtn();
        } catch(e) {}
        return orig.apply(this, arguments);
      };
    } catch(e) {}
  }

  function hookDoActionAll() {
    hookDoActionIn(window);
    ['competitors','dusk','action','chat_main'].forEach(function(n) {
      try { hookDoActionIn(window.top.frames[n]); } catch(e) {}
    });
    try { hookDoActionIn(window.parent); } catch(e) {}
  }

  hookSendActions();
  hookDoActionAll();

  function recast() {
    var daSnap = getDoActionSnap();
    var snap   = getSnapshot();

    if (daSnap) {
      flashBtn();
      try {
        var fn = null;
        ['competitors','dusk','action'].forEach(function(n) {
          try { if (!fn && typeof window.top.frames[n].doAction === 'function') fn = window.top.frames[n].doAction; } catch(e) {}
        });
        if (!fn && typeof window.doAction === 'function') fn = window.doAction;
        if (!fn && typeof window.parent.doAction === 'function') fn = window.parent.doAction;
        if (fn) fn(daSnap.actionType, daSnap.targetId);
      } catch(e) {}
      return;
    }

    if (snap && snap.acts && snap.acts.length > 0) {
      if (!isSnapshotValid(snap)) {

        setSnapshot(null);
        updateBtn();
        return;
      }
      flashBtn();
      try {
        window.parent.acts_sel = snap.acts.map(function(a){ return a ? a.slice() : a; });
        window.sendActions(0);
      } catch(e) {}
    }
  }

  var btnEl   = null;
  var badgeEl = null;

  function isInCombat() {
    try {
      var t = document.body && document.body.textContent || '';
      return t.indexOf('Союзники') !== -1 && t.indexOf('Противники') !== -1;
    } catch(e) { return false; }
  }

  function injectBtn() {
    var old = document.getElementById('doz-rec-td');
    if (old) old.parentNode.removeChild(old);
    if (!document.body) return;
    if (isInCombat()) return; 

    if (!document.getElementById('doz-rec-style')) {
      var st = document.createElement('style');
      st.id = 'doz-rec-style';
      st.textContent = [
        '#doz-rec-btn {',
        '  display:inline-block; cursor:pointer; user-select:none;',
        '  vertical-align:middle; position:relative;',
        '  padding:3px 10px 3px 8px;',
        '  font:bold 8pt Arial,sans-serif; color:#e8e8ff;',
        '  background:linear-gradient(to bottom,#5a6a9a 0%,#2a3a6a 50%,#1a2a5a 100%);',
        '  border:1px solid #1a2050; border-radius:3px;',
        '  box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 2px rgba(0,0,0,.5);',
        '  text-shadow:0 -1px 0 rgba(0,0,0,.6);',
        '  white-space:nowrap;',
        '}',
        '#doz-rec-btn::before { content:"»» "; color:#8899cc; }',
        '#doz-rec-btn:hover { background:linear-gradient(to bottom,#6a7aaa 0%,#3a4a7a 50%,#2a3a6a 100%); }',
        '#doz-rec-btn:active { background:linear-gradient(to bottom,#1a2a5a 0%,#2a3a6a 100%); box-shadow:inset 0 2px 3px rgba(0,0,0,.4); }',
        '#doz-rec-btn.flash { background:linear-gradient(to bottom,#8a9aca 0%,#4a5a9a 100%); }',
        '#doz-rec-btn.noact { opacity:.35; cursor:default; background:linear-gradient(to bottom,#555 0%,#333 100%); }',
        '#doz-rec-badge {',
        '  position:absolute; top:-5px; right:-6px;',
        '  color:#fff; font:bold 8px Arial; border-radius:6px;',
        '  padding:0 3px; line-height:12px; border-width:1px; border-style:solid;',
        '  display:none;',
        '}',
        '#doz-rec-badge.spell  { background:#cc0000; border-color:#ff5555; }',
        '#doz-rec-badge.attack { background:#cc6600; border-color:#ff9933; }'
      ].join('\n');
      document.head.appendChild(st);
    }

    var applyImg = document.querySelector('img[src*="apply"]');
    if (!applyImg) return;
    var tr = applyImg;
    while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
    if (!tr) return;

    var td = document.createElement('td');
    td.id = 'doz-rec-td';
    td.style.paddingLeft = '6px';
    td.style.verticalAlign = 'middle';

    btnEl = document.createElement('span');
    btnEl.id = 'doz-rec-btn';
    btnEl.className = 'noact';
    btnEl.textContent = 'Рекаст';

    badgeEl = document.createElement('span');
    badgeEl.id = 'doz-rec-badge';
    btnEl.appendChild(badgeEl);
    td.appendChild(btnEl);
    tr.appendChild(td);

    btnEl.addEventListener('click', recast);
    updateBtn();
    setInterval(updateBtn, 800);
  }

  function updateBtn() {
    if (!btnEl) return;
    var daSnap = getDoActionSnap();
    var snap   = getSnapshot();

    if (daSnap) {
      btnEl.className = '';
      btnEl.title = 'Рекаст: повторить атаку [' + HOTKEY + ']';
      if (badgeEl) { badgeEl.textContent = '⚔'; badgeEl.className = 'attack'; badgeEl.style.display = 'inline-block'; }
    } else if (snap && snap.acts && snap.acts.length > 0) {
      if (!isSnapshotValid(snap)) {
        btnEl.className = 'noact';
        btnEl.title = 'Рекаст: действия недоступны в этой локации [' + HOTKEY + ']';
        if (badgeEl) badgeEl.style.display = 'none';
      } else {
        btnEl.className = '';
        var n = snap.acts.length;
        btnEl.title = 'Рекаст: повторить ' + n + ' действ. [' + HOTKEY + ']';
        if (badgeEl) { badgeEl.textContent = n; badgeEl.className = 'spell'; badgeEl.style.display = 'inline-block'; }
      }
    } else {
      btnEl.className = 'noact';
      btnEl.title = 'Рекаст: сначала нажмите «Применить» или «Напасть» [' + HOTKEY + ']';
      if (badgeEl) badgeEl.style.display = 'none';
    }
  }

  function flashBtn() {
    if (!btnEl) return;
    btnEl.classList.add('flash');
    setTimeout(function(){ if(btnEl) btnEl.classList.remove('flash'); }, 200);
  }

  // ─── Старт ────────────────────────────────────────────────────────────────
  window.addEventListener('load', function() {

    try {
      var href = window.location.href;
      if (href.indexOf('rm=go') !== -1 || href.indexOf('rm=empty') !== -1) {
        setSnapshot(null);
      }
    } catch(e) {}

    setTimeout(function() { hookSendActions(); hookDoActionAll(); injectBtn(); }, 200);
  });
  if (document.readyState === 'complete') {
    setTimeout(function() { hookSendActions(); hookDoActionAll(); injectBtn(); }, 200);
  }

  document.addEventListener('keydown', function(e) {
    var tag = (e.target.tagName||'').toUpperCase();
    if (tag==='INPUT'||tag==='TEXTAREA') return;
    if ((e.key||'')===HOTKEY){ e.preventDefault(); recast(); }
  }, true);

  setTimeout(function(){
    ['competitors','combats','energy','dusk','chat_main'].forEach(function(n){
      try {
        var fw = window.top.frames[n];
        if (!fw||!fw.document) return;
        fw.document.addEventListener('keydown', function(e){
          if ((e.key||'')===HOTKEY){ e.preventDefault(); recast(); }
        }, true);
      } catch(e){}
    });
  }, 1500);

})();
