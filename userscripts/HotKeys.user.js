// ==UserScript==
// @name         Дозоры — Горячие клавиши заклинаний
// @namespace    http://dozory.ru/
// @version      2.1
// @description  Горячие клавиши для заклинаний в быту.
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

  if (window.name !== 'action') return;

  var RESERVED_KEYS = ['F2'];
  // Резерв клавиши из скрипта рефлекса чтобы не было конфликтов
  (function() {
    try {
      var reflexKeys = JSON.parse(localStorage.getItem('doz_reflex_keys') || '{}');
      Object.keys(reflexKeys).forEach(function(k){ if (RESERVED_KEYS.indexOf(k) === -1) RESERVED_KEYS.push(k); });
    } catch(e) {}
  })();
  var STORAGE_KEY   = 'doz_hotkeys_v2';

  function loadBindings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveBindings(b) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch(e) {}
  }
  var bindings = loadBindings();

  function getAllSpells() {
    var spells = [];
    ['acts_br','acts_mg','acts_ar','acts_am'].forEach(function(pool) {
      try {
        var arr = window[pool];
        if (!Array.isArray(arr)) return;
        arr.forEach(function(a) { if (a && a[0]) spells.push({ name: a[0], data: a }); });
      } catch(e) {}
    });
    return spells;
  }

  function castSpell(spellName) {
    var spells = getAllSpells();
    var found  = null;
    var lc = spellName.toLowerCase().trim();
    for (var i = 0; i < spells.length; i++) {
      if (spells[i].name.toLowerCase().trim() === lc) { found = spells[i]; break; }
    }
    if (!found) { showToast('⚠ «' + spellName + '» не найдено'); return; }

    try {
      var a = found.data;
      var castType = a[7];
      var target;
      if (castType === 128) {
        target = window.__lact
               || (window.parent.action && window.parent.action.__lact)
               || '';
      } else {
        target = (window.person && window.person.person_id)
               || (window.parent.action && window.parent.action.person
                   ? window.parent.action.person.person_id : '')
               || '';
      }

      window.parent.acts_sel = [];
      window.parent.acts_sel.push(['', '', target, '', a[3] || a[4] || '']);
      if (typeof window.sendActions === 'function') {
        window.sendActions(0);
        showToast('✓ ' + spellName);
      }
    } catch(e) { showToast('⚠ ' + e.message); }
  }

  function showToast(msg) {
    var t = document.getElementById('doz-hk-toast');
    if (!t) { t = document.createElement('div'); t.id='doz-hk-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._tmr);
    t._tmr = setTimeout(function(){ t.style.opacity='0'; }, 1800);
  }

  function injectStyles() {
    if (document.getElementById('doz-hk-style')) return;
    var st = document.createElement('style');
    st.id = 'doz-hk-style';
    st.textContent = [
      '#doz-hk-open {',
      '  display:inline-flex; align-items:center; justify-content:center;',
      '  cursor:pointer; user-select:none; vertical-align:middle;',
      '  width:26px; height:22px;',
      '  background:linear-gradient(to bottom,#5a6a9a 0%,#2a3a6a 50%,#1a2a5a 100%);',
      '  border:1px solid #1a2050; border-radius:3px;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 2px rgba(0,0,0,.5);',
      '}',
      '#doz-hk-open:hover { background:linear-gradient(to bottom,#6a7aaa 0%,#3a4a7a 100%); }',
      '#doz-hk-open svg { display:block; }',

      '#doz-hk-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:99998; display:none; }',
      '#doz-hk-panel {',
      '  position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);',
      '  z-index:99999; background:#1a1e2e; border:2px solid #3a4a7a;',
      '  border-radius:8px; padding:14px 16px 12px; min-width:360px; max-width:460px;',
      '  font:12px Arial,sans-serif; color:#ccd;',
      '  box-shadow:0 6px 30px rgba(0,0,0,.8); display:none;',
      '}',
      '#doz-hk-panel h3 { margin:0 0 8px; font-size:13px; color:#99aaee; border-bottom:1px solid #2a3a6a; padding-bottom:6px; }',
      '#doz-hk-hint { font:10px Arial; color:#556; margin-bottom:8px; }',

      '.doz-hk-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; position:relative; }',
      '.doz-hk-key {',
      '  width:72px; padding:3px 5px; flex-shrink:0;',
      '  background:#0e1220; border:1px solid #3a4a7a; border-radius:3px;',
      '  color:#aabbff; font:bold 11px Arial; cursor:pointer; text-align:center; user-select:none;',
      '}',
      '.doz-hk-key.listening  { border-color:#ffaa00; color:#ffaa00; animation:doz-blink .5s infinite; }',
      '.doz-hk-key.reserved   { border-color:#cc4444 !important; color:#cc4444 !important; }',
      '.doz-hk-key.duplicate  { border-color:#ff8800 !important; color:#ff8800 !important; }',
      '@keyframes doz-blink { 0%,100%{opacity:1} 50%{opacity:.3} }',

      '.doz-hk-error {',
      '  position:absolute; top:100%; left:0; z-index:1;',
      '  background:#2a1010; border:1px solid #cc4444; border-radius:3px;',
      '  color:#ff8888; font:10px Arial; padding:3px 7px;',
      '  white-space:nowrap; margin-top:2px; pointer-events:none;',
      '}',

      '.doz-hk-spell-wrap { flex:1; position:relative; }',
      '.doz-hk-spell {',
      '  width:100%; box-sizing:border-box; padding:3px 5px;',
      '  background:#0e1220; border:1px solid #3a4a7a; border-radius:3px;',
      '  color:#dde; font:11px Arial;',
      '}',
      '.doz-hk-spell:focus { border-color:#6a8aee; outline:none; }',

      '.doz-ac-list {',
      '  position:absolute; top:100%; left:0; right:0; z-index:100000;',
      '  background:#0e1220; border:1px solid #3a4a7a; border-top:none;',
      '  border-radius:0 0 4px 4px; max-height:140px; overflow-y:auto; display:none;',
      '}',
      '.doz-ac-item { padding:4px 7px; cursor:pointer; font:11px Arial; color:#ccd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.doz-ac-item:hover, .doz-ac-item.active { background:#2a3a6a; color:#fff; }',

      '.doz-hk-del { cursor:pointer; color:#cc4444; font-size:15px; padding:0 3px; flex-shrink:0; }',
      '.doz-hk-del:hover { color:#ff6666; }',

      '#doz-hk-add { margin-top:6px; padding:3px 12px; background:#2a3a6a; border:1px solid #3a5090; border-radius:3px; color:#99aaee; cursor:pointer; font:11px Arial; }',
      '#doz-hk-add:hover { background:#3a4a7a; }',
      '#doz-hk-footer { display:flex; justify-content:space-between; margin-top:10px; border-top:1px solid #2a3a6a; padding-top:10px; }',
      '#doz-hk-save { padding:4px 18px; background:linear-gradient(to bottom,#2a5a2a,#1a3a1a); border:1px solid #3a7a3a; border-radius:3px; color:#aaffaa; cursor:pointer; font:bold 11px Arial; }',
      '#doz-hk-save:hover { background:linear-gradient(to bottom,#3a6a3a,#2a4a2a); }',
      '#doz-hk-close { padding:4px 14px; background:#2a2a3a; border:1px solid #444; border-radius:3px; color:#888; cursor:pointer; font:11px Arial; }',

      '#doz-hk-toast {',
      '  position:fixed; bottom:80px; left:50%; transform:translateX(-50%);',
      '  z-index:99999; padding:5px 14px; background:rgba(15,18,40,.95);',
      '  border:1px solid #3a4a7a; border-radius:4px; color:#ccd; font:11px Arial;',
      '  transition:opacity .4s; opacity:0; pointer-events:none; white-space:nowrap;',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function setupAutocomplete(input) {
    var wrap = input.parentElement;
    var list = document.createElement('div');
    list.className = 'doz-ac-list';
    wrap.appendChild(list);
    var activeIdx = -1;

    function getNames() { return getAllSpells().map(function(s){ return s.name; }); }

    function render(filter) {
      var names = getNames();
      var lc = (filter || '').toLowerCase().trim();
      var matched = lc ? names.filter(function(n){ return n.toLowerCase().indexOf(lc) !== -1; }) : names;
      list.innerHTML = ''; activeIdx = -1;
      if (matched.length === 0) { list.style.display='none'; return; }
      matched.slice(0,20).forEach(function(name) {
        var item = document.createElement('div');
        item.className = 'doz-ac-item';
        if (lc) {
          var idx = name.toLowerCase().indexOf(lc);
          item.innerHTML = escH(name.slice(0,idx))
            + '<b style="color:#ffdd88">' + escH(name.slice(idx, idx+lc.length)) + '</b>'
            + escH(name.slice(idx+lc.length));
        } else { item.textContent = name; }
        item.addEventListener('mousedown', function(e){
          e.preventDefault(); input.value = name; list.style.display='none';
        });
        list.appendChild(item);
      });
      list.style.display = 'block';
    }

    function setActive(idx) {
      var items = list.querySelectorAll('.doz-ac-item');
      items.forEach(function(el){ el.classList.remove('active'); });
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('active'); activeIdx = idx;
        items[idx].scrollIntoView({block:'nearest'});
      }
    }

    input.addEventListener('input',  function(){ render(input.value); });
    input.addEventListener('focus',  function(){ render(input.value); });
    input.addEventListener('blur',   function(){ setTimeout(function(){ list.style.display='none'; }, 150); });
    input.addEventListener('keydown', function(e){
      var items = list.querySelectorAll('.doz-ac-item');
      if (list.style.display==='none') return;
      if (e.key==='ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx+1, items.length-1)); }
      else if (e.key==='ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx-1, 0)); }
      else if (e.key==='Enter' && activeIdx>=0) { e.preventDefault(); input.value=items[activeIdx].textContent; list.style.display='none'; }
      else if (e.key==='Escape') { list.style.display='none'; }
    });
  }

  function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var overlay, panel, rowsContainer;
  var listeningEl = null;

  function buildUI() {
    if (document.getElementById('doz-hk-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'doz-hk-overlay';
    overlay.addEventListener('click', closePanel);

    panel = document.createElement('div');
    panel.id = 'doz-hk-panel';
    panel.addEventListener('click', function(e){ e.stopPropagation(); });
    panel.innerHTML = [
      '<h3>⌨ Горячие клавиши заклинаний</h3>',
      '<div id="doz-hk-hint">Нажмите на поле клавиши → кликните клавишу. F2 зарезервирован для плагина Рекаста.</div>',
      '<div id="doz-hk-rows"></div>',
      '<button id="doz-hk-add">+ Добавить</button>',
      '<div id="doz-hk-footer"><button id="doz-hk-close">Закрыть</button><button id="doz-hk-save">✓ Сохранить</button></div>'
    ].join('');

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    rowsContainer = panel.querySelector('#doz-hk-rows');
    panel.querySelector('#doz-hk-add').addEventListener('click', function(){ addRow('',''); });
    panel.querySelector('#doz-hk-save').addEventListener('click', saveCurrent);
    panel.querySelector('#doz-hk-close').addEventListener('click', closePanel);
  }

  function openPanel()  { renderRows(); overlay.style.display='block'; panel.style.display='block'; }
  function closePanel() {
    if (listeningEl) { listeningEl.classList.remove('listening'); listeningEl=null; }
    overlay.style.display='none'; panel.style.display='none';
  }

  function renderRows() {
    rowsContainer.innerHTML = '';
    var keys = Object.keys(bindings);
    if (keys.length===0) { addRow('F3',''); } else { keys.forEach(function(k){ addRow(k, bindings[k]); }); }
  }

  function getOtherKeys(exceptKeyEl) {
    var keys = [];
    rowsContainer.querySelectorAll('.doz-hk-key').forEach(function(el){
      if (el !== exceptKeyEl && el.dataset.key) keys.push(el.dataset.key);
    });
    return keys;
  }

  function addRow(key, spell) {
    var row = document.createElement('div');
    row.className = 'doz-hk-row';

    var keyEl = document.createElement('div');
    keyEl.className = 'doz-hk-key';
    keyEl.textContent = key || 'Клавиша';
    keyEl.dataset.key = key;

    var wrap = document.createElement('div');
    wrap.className = 'doz-hk-spell-wrap';
    var spellEl = document.createElement('input');
    spellEl.type = 'text'; spellEl.className = 'doz-hk-spell';
    spellEl.placeholder = 'Начните вводить название…';
    spellEl.value = spell;
    wrap.appendChild(spellEl);
    setupAutocomplete(spellEl);

    var del = document.createElement('span');
    del.className = 'doz-hk-del'; del.textContent = '✕';
    del.addEventListener('click', function(){ row.parentNode.removeChild(row); });

    keyEl.addEventListener('click', function(e) {
      e.stopPropagation();
      if (listeningEl && listeningEl !== keyEl) {
        listeningEl.classList.remove('listening');
        listeningEl.textContent = listeningEl.dataset.key || 'Клавиша';
      }
      var oldErr = row.querySelector('.doz-hk-error');
      if (oldErr) oldErr.parentNode.removeChild(oldErr);
      listeningEl = keyEl;
      keyEl.classList.add('listening');
      keyEl.textContent = '...';
    });

    row.appendChild(keyEl); row.appendChild(wrap); row.appendChild(del);
    rowsContainer.appendChild(row);
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
    while (row && !row.classList.contains('doz-hk-row')) row = row.parentElement;

    function showErr(msg) {
      if (!row) return;
      var old = row.querySelector('.doz-hk-error');
      if (old) old.parentNode.removeChild(old);
      var err = document.createElement('div');
      err.className = 'doz-hk-error'; err.textContent = msg;
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

    // Зарезервировано
    if (RESERVED_KEYS.indexOf(key) !== -1) {
      showErr('⛔ ' + key + ' зарезервирован для Рекаста');
      resetKey(listeningEl, 'reserved'); return;
    }

    // Дубль
    var others = getOtherKeys(listeningEl);
    if (others.indexOf(key) !== -1) {
      var takenSpell = '';
      rowsContainer.querySelectorAll('.doz-hk-key').forEach(function(el){
        if (el !== listeningEl && el.dataset.key === key) {
          var inp = el.parentElement && el.parentElement.querySelector('.doz-hk-spell');
          if (inp) takenSpell = inp.value;
        }
      });
      showErr('⚠ ' + key + ' уже занята' + (takenSpell ? ': «' + takenSpell + '»' : ''));
      resetKey(listeningEl, 'duplicate'); return;
    }

    // Успех
    listeningEl.dataset.key = key;
    listeningEl.textContent = key;
    listeningEl.classList.remove('listening');
    listeningEl = null;
  }, true);

  function saveCurrent() {
    var nb = {}, seen = {};
    rowsContainer.querySelectorAll('.doz-hk-row').forEach(function(row){
      var key   = row.querySelector('.doz-hk-key').dataset.key || '';
      var spell = row.querySelector('.doz-hk-spell').value.trim();
      if (!key || !spell || RESERVED_KEYS.indexOf(key) !== -1 || seen[key]) return;
      seen[key] = true; nb[key] = spell;
    });
    bindings = nb; saveBindings(bindings);
    closePanel(); showToast('✓ Клавиши сохранены');
  }

  function isInCombat() {
    try {
      var t = document.body && document.body.textContent || '';
      return t.indexOf('Союзники') !== -1 && t.indexOf('Противники') !== -1;
    } catch(e) { return false; }
  }

  function injectUI() {
    if (document.getElementById('doz-hk-open')) return;
    if (isInCombat()) return; // в бою кнопку не показываем
    var applyImg = document.querySelector('img[src*="apply"]');
    if (!applyImg) return;
    var tr = applyImg;
    while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
    if (!tr) return;

    var td = document.createElement('td');
    td.style.paddingLeft = '6px'; td.style.verticalAlign = 'middle';
    var btn = document.createElement('span');
    btn.id = 'doz-hk-open'; btn.title = 'Горячие клавиши заклинаний';
    btn.innerHTML = '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<rect x="0.5" y="0.5" width="15" height="11" rx="1.5" stroke="white" stroke-opacity="0.9"/>'
      + '<rect x="2" y="2" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="5" y="2" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="8" y="2" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="11" y="2" width="3" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="2" y="5" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="5" y="5" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="8" y="5" width="2" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="11" y="5" width="3" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '<rect x="3" y="8" width="10" height="2" rx="0.4" fill="white" fill-opacity="0.9"/>'
      + '</svg>';
    btn.addEventListener('click', openPanel);
    td.appendChild(btn); tr.appendChild(td);
  }

  function isPanelOpen() {
    var p = document.getElementById('doz-hk-panel');
    return p && p.style.display === 'block';
  }

  function handleKey(e) {
    if (listeningEl) return;
    if (isPanelOpen()) return; // пока открыты настройки хоткеи не срабатывают
    var tag = (e.target.tagName||'').toUpperCase();
    if (tag==='INPUT'||tag==='TEXTAREA') return;
    var key = e.key;
    if (RESERVED_KEYS.indexOf(key) !== -1) return;
    if (bindings[key]) { e.preventDefault(); castSpell(bindings[key]); }
  }
  document.addEventListener('keydown', handleKey, true);
  setTimeout(function(){
    ['competitors','combats','energy','dusk','chat_main'].forEach(function(n){
      try { var fw=window.top.frames[n]; if(!fw||!fw.document) return; fw.document.addEventListener('keydown',handleKey,true); } catch(e){}
    });
  }, 1500);

  function start() { injectStyles(); buildUI(); injectUI(); }
  window.addEventListener('load', function(){ setTimeout(start, 200); });
  if (document.readyState==='complete') setTimeout(start, 200);

})();
