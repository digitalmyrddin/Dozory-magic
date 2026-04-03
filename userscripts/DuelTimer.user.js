// ==UserScript==
// @name         Дозоры — Таймер дуэлей
// @namespace    http://dozory.ru/
// @version      4.0
// @description  Запоминает проведённые дуэли и показывает таймер до следующей возможности получить опыт.
// @author       White Witcher & Claude
// @include      http://game.dozory.ru/cgi-bin/main.cgi*
// @include      http://game.dozory.ru/cgi-bin/cm_prepare.cgi*
// @include      http://game.dozory.ru/competitors.html*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  var STORAGE_KEY  = 'doz_duel_log';
  var NAME_CACHE   = 'doz_name_cache';
  var MY_ID_KEY    = 'doz_my_id';
  var COOLDOWN_MS  = (24 * 60 + 10) * 60 * 1000;
  var CACHE_TTL    = 48 * 60 * 60 * 1000; 
  var loc  = window.location.href;
  var IS_ACTION      = window.name === 'action';
  var IS_STRING      = window.name === 'string';
  var IS_COMPETITORS = window.name === 'competitors' || loc.indexOf('competitors.html') !== -1;
  var IS_PREPARE     = loc.indexOf('cm_prepare.cgi') !== -1;

  function loadLog() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveLog(log) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); } catch(e) {}
  }
  function cleanOld(log) {
    var now = Date.now();
    Object.keys(log).forEach(function(id) {
      if (now - log[id].time > CACHE_TTL) delete log[id];
    });
    return log;
  }
  function formatTimeLeft(ms) {
    if (ms <= 0) return null;
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function loadNameCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(NAME_CACHE) || '{}');
      var now = Date.now();
      var changed = false;
      Object.keys(raw).forEach(function(id) {
        if (raw[id].t && now - raw[id].t > CACHE_TTL) { delete raw[id]; changed = true; }
      });
      if (changed) localStorage.setItem(NAME_CACHE, JSON.stringify(raw));
      return raw;
    } catch(e) { return {}; }
  }
  function saveNameToCache(id, name) {
    try {
      var raw = loadNameCache();
      raw[id] = { n: name, t: Date.now() };
      localStorage.setItem(NAME_CACHE, JSON.stringify(raw));
    } catch(e) {}
  }
  function getNameFromCache(id) {
    var raw = loadNameCache();
    if (!raw[id]) return null;
    return raw[id].n || raw[id];
  }

  if (IS_PREPARE) {

    var sessionMatch = loc.match(/[?&]session=([^_&]+)_([^&]+)/);
    if (!sessionMatch) return;

    var idA = sessionMatch[1];
    var idB = sessionMatch[2];

    function getMyId() {
      return localStorage.getItem(MY_ID_KEY) || null;
    }

    function getOppId(myId) {
      var sMyId = String(myId || '').trim();

      if (sMyId) {
        if (idA === sMyId) return idB;
        if (idB === sMyId) return idA;
      }

      return (loc.indexOf('rm=check') !== -1) ? idA : idB;
    }

    function getOppName(oppId) {

      var cached = getNameFromCache(oppId);
      if (cached) return cached;


      var elements = document.querySelectorAll('b, span[style*="font-weight"], td');
      var parts = [];

      for (var i = 0; i < elements.length; i++) {
        var txt = elements[i].textContent.trim();

        if (!txt || txt.length < 2 || txt.length > 50 || /^\d+$/.test(txt)) continue;
        if (txt.indexOf('Вы вызвали') !== -1 || txt.indexOf('Вам предлагают') !== -1) continue;

        var clean = txt.replace(/\s*(вм|ин|абс|ор|свет|темн|сумм)\d*/gi, '').trim();
        
        if (clean && clean.length > 2 && !/^\d+$/.test(clean)) {

          if (elements[i].tagName === 'B' || elements[i].style.fontWeight === 'bold' || elements[i].style.fontWeight > 500) {
             return clean; 
          }
          parts.push(clean);
        }
      }

      return parts[0] || null;
    }
    function recordDuel(oppId) {
      var name = getOppName(oppId) || ('ID ' + oppId);
      var log = cleanOld(loadLog());
      var existing = log[oppId];
      if (existing && Date.now() - existing.time < 5 * 60 * 1000) return;
      log[oppId] = { name: name, time: Date.now() };
      saveLog(log);
    }
    function waitForAccepted(oppId) {
      if ((document.body.textContent || '').indexOf('Поздравляем') !== -1) {
        recordDuel(oppId); return;
      }
      var recorded = false;
      new MutationObserver(function() {
        if (recorded) return;
        if ((document.body.textContent || '').indexOf('Поздравляем') !== -1) {
          recorded = true;
          recordDuel(oppId);
        }
      }).observe(document.body || document.documentElement, {
        childList: true, subtree: true, characterData: true
      });
    }
  window.addEventListener('load', function() {
    var myId = getMyId();
    var oppId = getOppId(myId);

    var nameNow = getOppName(oppId);
    if (nameNow) saveNameToCache(oppId, nameNow);

    setTimeout(function() {
        var retryName = getOppName(oppId);
        if (retryName) {
            saveNameToCache(oppId, retryName);
          
            var log = loadLog();
            if (log[oppId] && log[oppId].name.indexOf('ID ') === 0) {
                log[oppId].name = retryName;
                saveLog(log);
            }
        }
    }, 400);

    waitForAccepted(oppId);
});
    return;
  }
  if (!IS_ACTION && !IS_STRING && !IS_COMPETITORS) return;

  function decorateVisibleTooltips() {
    document.querySelectorAll('div.tooltip').forEach(function(tip) {
      if (tip.style.display === 'none' || !tip.style.display) {
        tip.querySelectorAll('.doz-duel-badge').forEach(function(b) {
          if (b.parentNode) b.parentNode.removeChild(b);
        });
        return;
      }

      var tipText = tip.textContent || '';
      var headerMatch = tipText.match(/^([^\n(]{1,40})\s*\(ID:\s*(\d+)\)/);
      if (headerMatch) saveNameToCache(headerMatch[2], headerMatch[1].trim());

      tip.querySelectorAll('a').forEach(function(link) {
        var oc = link.getAttribute('onclick') || link.getAttribute('href') || '';
        var m = oc.match(/doAction\(6,(\d+)\)/);
        if (!m) return;
        if (link.querySelector('.doz-duel-badge')) return;
        var targetId = String(m[1]);
        var badge = document.createElement('span');
        badge.className = 'doz-duel-badge';
        badge.style.cssText = 'margin-left:6px;font-size:10px;font-weight:bold;vertical-align:middle;';
        var e = loadLog()[targetId];
        if (!e) {
          badge.textContent = '● новый'; badge.style.color = '#8888bb';
        } else {
          var left = (e.time + COOLDOWN_MS) - Date.now();
          if (left > 0) {
            badge.textContent = '⏳ ' + formatTimeLeft(left);
            badge.style.color = '#cc6644';
            badge.title = 'Опыт через ' + formatTimeLeft(left);
          } else {
            badge.textContent = '✓ опыт'; badge.style.color = '#44aa66';
          }
        }
        link.appendChild(badge);
      });
    });
  }
  if (IS_COMPETITORS) {
    setInterval(decorateVisibleTooltips, 500);
  }

  if (IS_ACTION) {
    window.doz_duel_openPanel = function() {
      var panel = document.getElementById('doz-duel-panel');
      if (!panel) { buildPanel(); panel = document.getElementById('doz-duel-panel'); }
      if (panel.style.display === 'none' || !panel.style.display) {
        renderPanel(panel); panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    };
    function buildPanel() {
      injectStyles();
      var p = document.createElement('div');
      p.id = 'doz-duel-panel';
      document.body.appendChild(p);
    }
    function renderPanel(panel) {
      var log = cleanOld(loadLog()); saveLog(log);
      var now = Date.now();
      var ids = Object.keys(log).sort(function(a,b){ return log[b].time - log[a].time; });
      var html = '<div class="doz-duel-header"><b>⚔️ Дуэли | Таймеры опыта</b>' +
                 '<span class="doz-duel-close">✕</span></div>';
      if (ids.length === 0) {
        html += '<div style="padding:12px;color:#556;text-align:center;">Дуэлей пока не было</div>';
      } else {
        ids.forEach(function(id) {
          var e = log[id];
          var left = (e.time + COOLDOWN_MS) - now;
          var ready = left <= 0;
          var color = ready ? '#44aa66' : '#cc6644';
          var status = ready ? '✓ доступен' : '⏳ ' + formatTimeLeft(left);
          var d = new Date(e.time);
          var timeStr = d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
          var profileUrl = 'http://profiles.dozory.ru/cgi-bin/profiles.cgi?id=' + id;
       html += '<div class="doz-duel-row">' +
                  '<a class="doz-duel-name" href="http://profiles.dozory.ru/cgi-bin/profiles.cgi?id=' + id + '" target="_blank">' + escHtml(e.name) + '</a>' +
                  '<span class="doz-duel-time">' + timeStr + '</span>' +
                  '<span style="color:' + color + ';font-weight:bold;margin-right:5px;">' + status + '</span>' +
                  '<span class="doz-duel-edit" data-editid="' + id + '" title="Редактировать" style="cursor:pointer;margin-right:6px;opacity:0.4;font-size:12px;">✎</span>' +
                  '<span class="doz-duel-del" data-delid="' + id + '" title="Удалить" style="cursor:pointer;opacity:0.4;font-size:12px;">❌︎</span>' +
                  '</div>';
        });
      }
      html += '<div class="doz-duel-footer">' +
              '<div class="doz-duel-hint">Добавить вручную:</div>' +
              '<div style="display:flex;gap:4px;margin-bottom:4px;">' +
              '<input id="doz-duel-add-id" type="text" placeholder="ID игрока" class="doz-duel-input" style="width:80px;">' +
              '<input id="doz-duel-add-name" type="text" placeholder="Ник" class="doz-duel-input" style="flex:1;">' +
              '</div>' +
              '<div style="display:flex;gap:4px;margin-bottom:6px;">' +
              '<select id="doz-duel-add-day" class="doz-duel-input">' +
              '<option value="today">Сегодня</option><option value="yesterday">Вчера</option>' +
              '</select>' +
              '<input id="doz-duel-add-time" type="text" placeholder="ЧЧ:ММ" class="doz-duel-input" style="width:55px;">' +
              '<button id="doz-duel-add-btn" class="doz-duel-btn" style="margin-left:auto;">+ Добавить</button>' +
              '</div>' +
              '<div style="text-align:right;">' +
              '<span id="doz-duel-clear-btn" style="cursor:pointer;color:#446;font-size:10px;">очистить историю</span>' +
              '</div></div>';
      panel.innerHTML = html;
      panel.querySelector('.doz-duel-close').addEventListener('click', function() {
        panel.style.display = 'none';
      });
      panel.querySelectorAll('[data-delid]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var log2 = loadLog(); delete log2[btn.getAttribute('data-delid')]; saveLog(log2);
          renderPanel(panel);
        });
      });
    panel.querySelector('#doz-duel-add-btn').onclick = function() {
        var btn = this;
        var id   = (panel.querySelector('#doz-duel-add-id').value || '').trim();
        var name = (panel.querySelector('#doz-duel-add-name').value || '').trim();
        
        if (!id || !name || !/^\d+$/.test(id)) return;
        
        var timeStr = (panel.querySelector('#doz-duel-add-time').value || '').trim();
        var day     = panel.querySelector('#doz-duel-add-day').value;
        var ts = Date.now();
        var tm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        
        if (tm) {
          var now2 = new Date();
          var d2 = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(),
                            parseInt(tm[1]), parseInt(tm[2]), 0, 0);
          if (day === 'yesterday') d2.setDate(d2.getDate() - 1);
          ts = d2.getTime();
        } else if (day === 'yesterday') {
          ts = Date.now() - 24 * 60 * 60 * 1000;
        }

        var log3 = loadLog();
        var oldId = btn.getAttribute('data-old-id');

        if (oldId && oldId !== id) {
          delete log3[oldId];
        }

        log3[id] = { name: name, time: ts };
        
        btn.removeAttribute('data-old-id');
        btn.textContent = '+ Добавить';
        btn.classList.remove('doz-duel-btn-edit-mode');

        saveLog(log3);
        renderPanel(panel);
      };

      panel.querySelector('#doz-duel-clear-btn').onclick = function() {
        if (confirm('Очистить историю дуэлей?')) {
          localStorage.removeItem(STORAGE_KEY);
          renderPanel(panel);
        }
      };

      panel.querySelectorAll('[data-editid]').forEach(function(btn) {
        btn.onclick = function(e) {
          e.stopPropagation();
          var editId = btn.getAttribute('data-editid');
          var entry = loadLog()[editId];
          if (entry) {
            panel.querySelector('#doz-duel-add-id').value = editId;
            panel.querySelector('#doz-duel-add-name').value = entry.name;
            var d = new Date(entry.time);
            panel.querySelector('#doz-duel-add-time').value = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

            var sBtn = panel.querySelector('#doz-duel-add-btn');
            if (sBtn) {
              sBtn.textContent = '💾 Сохранить';
              sBtn.setAttribute('data-old-id', editId); 
              sBtn.classList.add('doz-duel-btn-edit-mode');
            }
          }
        };
      });
    }
    function injectStyles() {
      if (document.getElementById('doz-duel-style')) return;
      var st = document.createElement('style');
      st.id = 'doz-duel-style';
      st.textContent = [
        '#doz-duel-panel {',
        '  position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);',
        '  z-index:99999; background:#1a1e2e; border:2px solid #4a3a7a;',
        '  border-radius:8px; padding:0; min-width:320px; max-width:400px;',
        '  font:12px Arial,sans-serif; color:#ccd;',
        '  box-shadow:0 6px 30px rgba(0,0,0,.8); display:none;',
        '}',
        '.doz-duel-header {',
        '  padding:8px 12px; border-bottom:1px solid #3a2a6a;',
        '  border-radius:6px 6px 0 0; display:flex; justify-content:space-between; align-items:center;',
        '}',
        '.doz-duel-header b { color:#bb99ee; font-size:13px; }',
        '.doz-duel-close { cursor:pointer; color:#554466; font-size:14px; }',
        '.doz-duel-close:hover { color:#bb99ee; }',
        '.doz-duel-row {',
        '  display:flex; align-items:center; gap:8px;',
        '  padding:6px 12px; border-bottom:1px solid #252a3a;',
        '}',
        '.doz-duel-name { flex:1; color:#ccaaff; text-decoration:none; font-weight:bold; font-size:11px; }',
        '.doz-duel-name:hover { color:#fff; text-decoration:underline; }',
        '.doz-duel-name:visited { color:#ccaaff; }',
        '.doz-duel-time { color:#446; font-size:10px; white-space:nowrap; }',
        '.doz-duel-del { cursor:pointer; color:#443355; font-size:12px; padding:0 2px; }',
        '.doz-duel-del:hover { color:#cc4444; }',
        '.doz-duel-footer { padding:8px 12px; border-top:1px solid #2a2050; background:#12101e; border-radius:0 0 6px 6px; }',
        '.doz-duel-hint { font:10px Arial; color:#446; margin-bottom:6px; }',
        '.doz-duel-input {',
        '  padding:3px 5px; background:#0e1220; border:1px solid #4a3a7a;',
        '  border-radius:3px; color:#dde; font:11px Arial;',
        '}',
        '.doz-duel-input:focus { border-color:#8a6aee; outline:none; }',
        '.doz-duel-btn {',
        '  padding:3px 12px; background:#2a1a4a; border:1px solid #4a3090;',
        '  border-radius:3px; color:#bb99ee; cursor:pointer; font:11px Arial;',
        '}',
        '.doz-duel-btn:hover { background:#3a2a5a; }',
        '.doz-duel-edit { cursor:pointer; margin-right:8px; opacity:0.5; transition: opacity 0.2s, color 0.2s; font-size:14px; }',
        '.doz-duel-edit:hover { opacity:1; color:#bb99ee; }',
        '.doz-duel-btn { transition: background 0.3s, transform 0.1s; }',
        '.doz-duel-btn:active { transform: scale(0.95); }',
        '.doz-duel-btn-edit-mode { background: #4a3a7a !important; box-shadow: 0 0 10px #6a5a9a; border-color: #bb99ee !important; }'
      ].join('\n');
      document.head.appendChild(st);
    }
    window.addEventListener('load', function() {
      setTimeout(function() { injectStyles(); buildPanel(); }, 300);
    });
    if (document.readyState === 'complete') setTimeout(function() { injectStyles(); buildPanel(); }, 300);
  }
  if (IS_COMPETITORS) {
function saveMyId() {
      var myEmo = document.getElementById('my_emo');
      if (myEmo) {
        var m = (myEmo.getAttribute('onmouseover') || '').match(/person_id\s*:\s*(\d+)/);
        if (m) {
          var newId = m[1];
          if (localStorage.getItem(MY_ID_KEY) !== newId) {
            localStorage.setItem(MY_ID_KEY, newId);
          }
        }
      }
    }

    var obs = new MutationObserver(function() {
      if (document.querySelector('img[src*="org.gif"], img[src*="org_a.gif"]') && !document.getElementById('doz-duel-compbtn')) {
        injectCompetitorsBtn();
      }
      saveMyId();
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });

    setInterval(saveMyId, 2000);

    saveMyId();
    injectCompetitorsBtn();
    function injectCompetitorsBtn() {
      if (document.getElementById('doz-duel-compbtn')) return;
      var orgBtn = document.querySelector('img[src*="org.gif"], img[src*="org_a.gif"]');
      if (!orgBtn) return;
      var sz = 21;
      var btn = document.createElement('div');
      btn.id = 'doz-duel-compbtn';
      btn.title = 'Таймер дуэлей';
      btn.style.cssText = [
        'display:inline-flex', 'align-items:center', 'justify-content:center',
        'width:' + sz + 'px', 'height:' + sz + 'px', 'cursor:pointer',
        'border-radius:3px', 'background:linear-gradient(to bottom,#5a5a7a,#40407d)',
        'border:1px solid #33334a',
        'box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 2px rgba(0,0,0,.5)',
        'box-sizing:border-box', 'overflow:hidden',
      ].join(';');
      var icon = document.createElement('img');
      icon.src = 'http://st.dozory.ru/img/emo/i_e_duel.gif';
      icon.style.cssText = 'border:0;display:block;max-width:' + (sz-4) + 'px;max-height:' + (sz-4) + 'px;';
      btn.appendChild(icon);
      function openPanel() {
        try {
          var af = window.top && window.top.frames && window.top.frames['action'];
          if (af && af.doz_duel_openPanel) af.doz_duel_openPanel();
        } catch(ex) {}
      }
      btn.addEventListener('mouseover', function(){ btn.style.background='linear-gradient(to bottom,#7a7a9a,#4a4a6a)'; });
      btn.addEventListener('mouseout',  function(){ btn.style.background='linear-gradient(to bottom,#5a5a7a,#2a2a4a)'; });
      btn.addEventListener('click', function(e){ e.stopPropagation(); openPanel(); });
      icon.addEventListener('click', function(e){ e.stopPropagation(); openPanel(); });
      var td = orgBtn.parentElement;
      if (td && td.tagName === 'TD') {
        var newTd = td.cloneNode(false);
        newTd.appendChild(btn);
        td.parentNode.insertBefore(newTd, td.nextSibling);
      }
    }
    new MutationObserver(function() {
      if (document.querySelector('img[src*="org.gif"], img[src*="org_a.gif"]') && !document.getElementById('doz-duel-compbtn'))
        injectCompetitorsBtn();
      if (document.querySelector('a[href*="profiles.cgi?id="]')) saveMyId();
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', function() {
      setTimeout(function() { injectCompetitorsBtn(); saveMyId(); }, 200);
    });
    if (document.readyState === 'complete') setTimeout(function() { injectCompetitorsBtn(); saveMyId(); }, 200);
  }
  if (IS_STRING) {
    function injectStringBtn() {
      if (document.getElementById('doz-duel-footerbtn')) return;
      var btn = document.createElement('img');
      btn.id = 'doz-duel-footerbtn';
      btn.src = 'http://st.dozory.ru/img/emo/i_e_duel.gif';
      btn.title = 'Таймер дуэлей';
      btn.style.cssText = 'cursor:pointer;vertical-align:middle;opacity:.85;border:0;';
      btn.addEventListener('mouseover', function(){ btn.style.opacity='1'; });
      btn.addEventListener('mouseout',  function(){ btn.style.opacity='.85'; });
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          var af = window.top.frames['action'];
          if (af && af.doz_duel_openPanel) af.doz_duel_openPanel();
        } catch(ex) {}
      });
      var anchor = document.getElementById('doz-ref-td') ||
                   document.getElementById('cIcon') ||
                   document.querySelector('img[src*="alien.gif"]');
      if (anchor) {
        var anchorTd = anchor;
        while (anchorTd && anchorTd.tagName !== 'TD') anchorTd = anchorTd.parentElement;
        if (anchorTd) {
          var td = document.createElement('td');
          td.style.cssText = 'padding:0 2px;vertical-align:middle;';
          td.appendChild(btn);
          var after = document.getElementById('doz-ref-td') || anchorTd;
          after.parentNode.insertBefore(td, after.nextSibling);
          return;
        }
      }
      setTimeout(function() {
        if (!document.getElementById('doz-duel-footerbtn')) injectStringBtn();
      }, 600);
    }
    window.addEventListener('load', function() { setTimeout(injectStringBtn, 1800); });
    if (document.readyState === 'complete') setTimeout(injectStringBtn, 1800);
  }
})();
