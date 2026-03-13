// ==UserScript==
// @name         Дозоры — Горячие главиши рефлекса
// @namespace    http://dozory.ru/
// @version      2.1
// @description  Быстрое переключение рефлекса с помощью горящих клавиш.
// @author       White Witcher (featuring Claude AI)
// @include      http://game.dozory.ru/cgi-bin/main.cgi*
// @include      http://game.dozory.ru/*
// @include      http://dozory.ru/*
// @include      http://game.dozory.ru/footer.html*
// @include      http://*.dozory.ru/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
 
  var IS_ACTION = window.name === 'action';
  var IS_STRING = window.name === 'string' || (window.location && window.location.href.indexOf('ajax.html') !== -1);
  var IS_AJAX   = window.location && window.location.href.indexOf('ajax.html') !== -1;
  if (!IS_ACTION && !IS_STRING) return;
 
  var STORAGE_SETS = 'doz_reflex_sets';   // { name: id, ... }
  var STORAGE_KEYS = 'doz_reflex_keys';   // { key: name, ... }
  var RESERVED = ['F2'];
  // Добавлены клавиши из скрипта заклинаний чтобы не было конфликтов
  (function() {
    try {
      var spellKeys = JSON.parse(localStorage.getItem('doz_hotkeys_v2') || '{}');
      Object.keys(spellKeys).forEach(function(k){ if (RESERVED.indexOf(k) === -1) RESERVED.push(k); });
    } catch(e) {}
  })();
 
  function loadSets() {
    try { return JSON.parse(localStorage.getItem(STORAGE_SETS) || '{}'); } catch(e) { return {}; }
  }
  function saveSets(s) {
    try { localStorage.setItem(STORAGE_SETS, JSON.stringify(s)); } catch(e) {}
  }
  function loadKeys() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS) || '{}'); } catch(e) { return {}; }
  }
  function saveKeys(k) {
    try { localStorage.setItem(STORAGE_KEYS, JSON.stringify(k)); } catch(e) {}
  }
 
  var knownSets = loadSets(); 
  var keyBinds  = loadKeys(); 
 
  function scanSetsFromDOM() {
    var found = {};

    var all = document.querySelectorAll('[onclick*="apply_magic_set"]');
    all.forEach(function(el) {
      var m = (el.getAttribute('onclick') || '').match(/apply_magic_set\((\d+)\)/);
      if (!m) return;
      var id   = parseInt(m[1]);

      var name = (el.textContent || el.innerText || '').trim();

      if (!name) {
        var div = el.querySelector('div');
        if (div) name = div.textContent.trim();
      }
      if (name && id) found[name] = id;
    });
    return found;
  }
 
  function updateSets() {
    var found = scanSetsFromDOM();
    if (Object.keys(found).length > 0) {

      Object.keys(found).forEach(function(name) { knownSets[name] = found[name]; });
      saveSets(knownSets);
    }
  }
 
  function applySet(name) {
    var id = knownSets[name];
    if (!id) { showToast('⚠ Комплект «' + name + '» не найден — откройте Магию→Рефлекс'); return; }
 
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/cgi-bin/magic_reflex.cgi', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
      showToast('✓ Рефлекс: ' + name);
      if (IS_AJAX) {

        setTimeout(function() { window.location.reload(); }, 800);
      } else if (window.location.href.indexOf('magic') !== -1 ||
                 window.location.href.indexOf('rm=go') !== -1) {
        window.location.href = '/cgi-bin/main.cgi';
      } else {
        window.location.reload();
      }
    };
    xhr.onerror = function() { showToast('⚠ Ошибка смены рефлекса'); };
    xhr.send('rm=set_magic_set&set_id=' + id);
  }
 
  function showToast(msg) {
    injectStyles();
    var t = document.getElementById('doz-ref-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'doz-ref-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._tmr);
    t._tmr = setTimeout(function(){ t.style.opacity='0'; }, 2500);
  }
 
  function injectStyles() {
    if (document.getElementById('doz-ref-style')) return;
    var st = document.createElement('style');
    st.id = 'doz-ref-style';
    st.textContent = [

      '#doz-ref-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:99998; display:none; }',
      '#doz-ref-panel {',
      '  position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);',
      '  z-index:99999; background:#1a1e2e; border:2px solid #4a3a7a;',
      '  border-radius:8px; padding:14px 16px 12px; min-width:340px;',
      '  font:12px Arial,sans-serif; color:#ccd;',
      '  box-shadow:0 6px 30px rgba(0,0,0,.8); display:none;',
      '}',
      '#doz-ref-panel h3 { margin:0 0 4px; font-size:13px; color:#bb99ee; border-bottom:1px solid #3a2a6a; padding-bottom:6px; }',
      '#doz-ref-hint { font:10px Arial; color:#556; margin-bottom:10px; line-height:1.5; }',
 
      '.doz-ref-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }',
      '.doz-ref-key {',
      '  width:72px; padding:3px 5px; flex-shrink:0;',
      '  background:#0e1220; border:1px solid #4a3a7a; border-radius:3px;',
      '  color:#ccaaff; font:bold 11px Arial; cursor:pointer; text-align:center; user-select:none;',
      '}',
      '.doz-ref-key.listening { border-color:#ffaa00; color:#ffaa00; animation:doz-ref-blink .5s infinite; }',
      '.doz-ref-key.reserved  { border-color:#cc4444 !important; color:#cc4444 !important; }',
      '.doz-ref-key.duplicate { border-color:#ff8800 !important; color:#ff8800 !important; }',
      '@keyframes doz-ref-blink { 0%,100%{opacity:1} 50%{opacity:.3} }',
 
      '.doz-ref-sel {',
      '  flex:1; padding:3px 5px;',
      '  background:#0e1220; border:1px solid #4a3a7a; border-radius:3px;',
      '  color:#dde; font:11px Arial;',
      '}',
      '.doz-ref-sel:focus { border-color:#8a6aee; outline:none; }',
 
      '.doz-ref-del { cursor:pointer; color:#cc4444; font-size:15px; padding:0 3px; flex-shrink:0; }',
      '.doz-ref-del:hover { color:#ff6666; }',
 
      '.doz-ref-error {',
      '  position:absolute; top:100%; left:0; z-index:1;',
      '  background:#2a1010; border:1px solid #cc4444; border-radius:3px;',
      '  color:#ff8888; font:10px Arial; padding:3px 7px;',
      '  white-space:nowrap; margin-top:2px; pointer-events:none;',
      '}',
 
      '#doz-ref-add { margin-top:6px; padding:3px 12px; background:#2a1a4a; border:1px solid #4a3090; border-radius:3px; color:#bb99ee; cursor:pointer; font:11px Arial; }',
      '#doz-ref-add:hover { background:#3a2a5a; }',
      '#doz-ref-hint2 { font:10px Arial; color:#446; margin-top:8px; padding:6px 8px; background:#12101e; border-radius:4px; border:1px solid #2a2050; }',
      '#doz-ref-footer { display:flex; justify-content:space-between; margin-top:10px; border-top:1px solid #2a1a5a; padding-top:10px; }',
      '#doz-ref-save { padding:4px 18px; background:linear-gradient(to bottom,#2a2a5a,#1a1a3a); border:1px solid #4a4a9a; border-radius:3px; color:#aaaaff; cursor:pointer; font:bold 11px Arial; }',
      '#doz-ref-save:hover { background:linear-gradient(to bottom,#3a3a6a,#2a2a4a); }',
      '#doz-ref-close { padding:4px 14px; background:#2a2a3a; border:1px solid #444; border-radius:3px; color:#888; cursor:pointer; font:11px Arial; }',
 
      
      '#doz-ref-toast {',
      '  position:fixed; bottom:104px; left:50%; transform:translateX(-50%);',
      '  z-index:99999; padding:5px 14px; background:rgba(15,10,35,.95);',
      '  border:1px solid #4a3a7a; border-radius:4px; color:#ccaaff; font:11px Arial;',
      '  transition:opacity .4s; opacity:0; pointer-events:none; white-space:nowrap;',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }
 
  var overlay, panel, rowsEl;
  var listeningEl = null;
 
  function buildUI() {
    if (document.getElementById('doz-ref-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'doz-ref-overlay';
    overlay.addEventListener('click', closePanel);
 
    panel = document.createElement('div');
    panel.id = 'doz-ref-panel';
    panel.addEventListener('click', function(e){ e.stopPropagation(); });
    panel.innerHTML = [
      '<h3>✦ Хоткеи рефлекса</h3>',
      '<div id="doz-ref-hint">Назначьте клавиши для быстрого переключения комплектов магии.</div>',
      '<div id="doz-ref-rows"></div>',
      '<button id="doz-ref-add">+ Добавить</button>',
      '<div id="doz-ref-hint2">',
        'Комплекты считываются автоматически когда вы открываете <b>Магия → Рефлекс</b>.<br>',
        'Известные: <span id="doz-ref-known">—</span>',
      '</div>',
      '<div id="doz-ref-footer">',
        '<button id="doz-ref-close">Закрыть</button>',
        '<button id="doz-ref-save">✓ Сохранить</button>',
      '</div>'
    ].join('');
 
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
 
    rowsEl = panel.querySelector('#doz-ref-rows');
    panel.querySelector('#doz-ref-add').addEventListener('click', function(){ addRow('', ''); });
    panel.querySelector('#doz-ref-save').addEventListener('click', saveCurrent);
    panel.querySelector('#doz-ref-close').addEventListener('click', closePanel);
  }
 
   function openSettingsPanel() {
    var knownEl = panel.querySelector('#doz-ref-known');
    var names = Object.keys(knownSets);
    if (knownEl) knownEl.textContent = names.length ? names.join(', ') : '— откройте Магия→Рефлекс';
    renderRows();
    overlay.style.display = 'block'; panel.style.display = 'block';
  }
  function closePanel() {
    if (listeningEl) { listeningEl.classList.remove('listening'); listeningEl = null; }
    overlay.style.display = 'none'; panel.style.display = 'none';
  }
 
  function renderRows() {
    rowsEl.innerHTML = '';
    var keys = Object.keys(keyBinds);
    if (keys.length === 0) { addRow('', ''); }
    else { keys.forEach(function(k){ addRow(k, keyBinds[k]); }); }
  }
 
  function getOtherKeys(exceptEl) {
    var keys = [];
    rowsEl.querySelectorAll('.doz-ref-key').forEach(function(el){
      if (el !== exceptEl && el.dataset.key) keys.push(el.dataset.key);
    });
    return keys;
  }
 
  function addRow(key, name) {
    var row = document.createElement('div');
    row.className = 'doz-ref-row';
    row.style.position = 'relative';
 
    var keyEl = document.createElement('div');
    keyEl.className = 'doz-ref-key';
    keyEl.textContent = key || 'Клавиша';
    keyEl.dataset.key = key;
 
    var sel = document.createElement('select');
    sel.className = 'doz-ref-sel';
    var emptyOpt = document.createElement('option');
    emptyOpt.value = ''; emptyOpt.textContent = '— выберите комплект —';
    sel.appendChild(emptyOpt);
    Object.keys(knownSets).forEach(function(n) {
      var opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      if (n === name) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.value = name;
 
    var del = document.createElement('span');
    del.className = 'doz-ref-del'; del.textContent = '✕';
    del.addEventListener('click', function(){ row.parentNode.removeChild(row); });
 
    keyEl.addEventListener('click', function(e) {
      e.stopPropagation();
      if (listeningEl && listeningEl !== keyEl) {
        listeningEl.classList.remove('listening');
        listeningEl.textContent = listeningEl.dataset.key || 'Клавиша';
      }
      var oldErr = row.querySelector('.doz-ref-error');
      if (oldErr) oldErr.parentNode.removeChild(oldErr);
      listeningEl = keyEl;
      keyEl.classList.add('listening'); keyEl.textContent = '...';
    });
 
    row.appendChild(keyEl); row.appendChild(sel); row.appendChild(del);
    rowsEl.appendChild(row);
  }
 
  document.addEventListener('keyup', function(e) {
    if (!listeningEl) return;
    e.preventDefault(); e.stopPropagation();
  }, true);
 
  document.addEventListener('keydown', function(e) {
    if (!listeningEl) return;
    e.preventDefault(); e.stopPropagation();
    var key = e.key;
    var row = listeningEl;
    while (row && !row.classList.contains('doz-ref-row')) row = row.parentElement;
 
    function showErr(msg) {
      if (!row) return;
      var old = row.querySelector('.doz-ref-error');
      if (old) old.parentNode.removeChild(old);
      var err = document.createElement('div');
      err.className = 'doz-ref-error'; err.textContent = msg;
      row.appendChild(err);
      setTimeout(function(){ if(err.parentNode) err.parentNode.removeChild(err); }, 2000);
    }
    function resetKey(el, cls) {
      el.classList.remove('listening'); el.classList.add(cls);
      el.textContent = el.dataset.key || 'Клавиша';
      var captured = el;
      setTimeout(function(){
        if (listeningEl === captured) listeningEl = null;
        setTimeout(function(){ captured.classList.remove(cls); captured.textContent = captured.dataset.key || 'Клавиша'; }, 1850);
      }, 150);
    }
 
    if (key === 'Escape') {
      listeningEl.classList.remove('listening');
      listeningEl.textContent = listeningEl.dataset.key || 'Клавиша';
      listeningEl = null; return;
    }
    if (RESERVED.indexOf(key) !== -1) {
      showErr('⛔ ' + key + ' зарезервирован'); resetKey(listeningEl, 'reserved'); return;
    }
    if (getOtherKeys(listeningEl).indexOf(key) !== -1) {
      showErr('⚠ ' + key + ' уже занята'); resetKey(listeningEl, 'duplicate'); return;
    }
    listeningEl.dataset.key = key;
    listeningEl.textContent = key;
    listeningEl.classList.remove('listening'); listeningEl = null;
  }, true);
 
  function saveCurrent() {
    var nb = {}, seen = {};
    rowsEl.querySelectorAll('.doz-ref-row').forEach(function(row){
      var key  = row.querySelector('.doz-ref-key').dataset.key || '';
      var name = row.querySelector('.doz-ref-sel').value.trim();
      if (!key || !name || RESERVED.indexOf(key) !== -1 || seen[key]) return;
      seen[key] = true; nb[key] = name;
    });
    keyBinds = nb; saveKeys(keyBinds);
    closePanel(); showToast('✓ Хоткеи рефлекса сохранены');
  }
 
 
  function isInCombat() {
    try {
      var af = window.top && window.top.frames && window.top.frames['action'];
      var t = af ? (af.document.body && af.document.body.textContent || '') :
                   (document.body && document.body.textContent || '');
      return t.indexOf('Союзники') !== -1 && t.indexOf('Противники') !== -1;
    } catch(e) { return false; }
  }
 
  function injectUI() {
    if (!IS_STRING) return;
    if (isInCombat()) return;
    if (document.getElementById('doz-ref-btn')) return;
 
    var btn = document.createElement('img');
    btn.id  = 'doz-ref-btn';
    btn.src = 'http://st.dozory.ru/img/magic/reflex_lable.gif';
    btn.title = 'Рефлекс: настройки хоткеев';
    btn.style.cssText = 'cursor:pointer;vertical-align:middle;opacity:.85;border:0;';
    btn.addEventListener('mouseover', function(){ btn.style.opacity='1'; });
    btn.addEventListener('mouseout',  function(){ btn.style.opacity='.85'; });
    btn.addEventListener('click', function(e){
      e.stopPropagation();

      if (IS_AJAX) { openSettingsPanel(); return; }
      try {
        var af = window.top.frames['action'];
        if (af && af.doz_reflex_openSettings) { af.doz_reflex_openSettings(); return; }
      } catch(ex) {}
      openSettingsPanel();
    });
 
    var anchor = document.getElementById('cIcon') ||
                 document.querySelector('img[src*="alien.gif"]');
 
    if (anchor) {
      var anchorTd = anchor;
      while (anchorTd && anchorTd.tagName !== 'TD') anchorTd = anchorTd.parentElement;
      if (anchorTd) {
        var td = document.createElement('td');
        td.id = 'doz-ref-td';
        td.style.cssText = 'padding:0 2px;vertical-align:middle;';
        td.appendChild(btn);
        anchorTd.parentNode.insertBefore(td, anchorTd.nextSibling);
        return;
      }
    }
 
    setTimeout(function() {
      if (!document.getElementById('doz-ref-btn')) injectUI();
    }, 600);
  }
 
  function isPanelOpen() {
    var p = document.getElementById('doz-ref-panel');
    return p && p.style.display === 'block';
  }
 
  function handleKey(e) {
    if (listeningEl) return;
    if (isPanelOpen()) return;
    var tag = (e.target.tagName||'').toUpperCase();
    if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
    var key = e.key;
    if (RESERVED.indexOf(key) !== -1) return;
    if (keyBinds[key]) {
      e.preventDefault();
      if (IS_STRING) {
        try {
          var af = window.top.frames['action'];
          if (af && af.doz_reflex_apply) { af.doz_reflex_apply(keyBinds[key]); return; }
        } catch(e2) {}
      }
      applySet(keyBinds[key]);
    }
  }
 
  document.addEventListener('keydown', handleKey, true);
  setTimeout(function(){
    ['competitors','combats','energy','dusk','chat_main'].forEach(function(n){
      try {
        var fw = window.top.frames[n];
        if (!fw||!fw.document) return;
        fw.document.addEventListener('keydown', handleKey, true);
      } catch(e){}
    });
  }, 1500);
 
  function start() {
    if (IS_ACTION || IS_AJAX) {
      updateSets();
      injectStyles();
      buildUI();
      window.doz_reflex_openSettings = openSettingsPanel;
      window.doz_reflex_apply = applySet;
    }
    if (IS_STRING) {
      injectUI();
      window.showDozReflexToast = function(msg) { showToast(msg); };
    }
  }
 
  window.addEventListener('load', function(){

    setTimeout(start, IS_STRING ? 1500 : 300);
  });
  if (document.readyState === 'complete') setTimeout(start, IS_STRING ? 1500 : 300);
 
  // Скрывает кнопку во время боя
  if (IS_STRING || IS_AJAX) {
    setInterval(function() {
      var btn = document.getElementById('doz-ref-btn');
      var inCombat = isInCombat();
      if (!btn) { if (!inCombat) injectUI(); return; }
      btn.style.display = inCombat ? 'none' : '';
    }, 1000);
  }
 
})();
