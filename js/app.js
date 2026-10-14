(function () {
  'use strict';

  window.addEventListener('error', function (e) {
    var b = document.getElementById('err');
    if (b) { b.hidden = false; b.querySelector('span').textContent = e.message || ''; }
  });

  var SG = window.SG, API = window.SG_API, PRODUCTS = SG.PRODUCTS, LEVELS = SG.LEVELS;

  function $(s) { return document.querySelector(s); }
  function h(tag, props) {
    var el = document.createElement(tag);
    for (var k in (props || {})) {
      var v = props[k];
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (kid) {
        if (kid == null || kid === false) return;
        el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      });
    }
    return el;
  }

  var todayISO = function () { return SG.iso(new Date()); };
  var fmt = SG.fmtDate;
  var rand4 = function () { return Math.random().toString(36).slice(2, 6).toUpperCase(); };

  var state = API.loadLocal() || SG.demoState(todayISO());
  if (!Array.isArray(state.photos)) state.photos = [];
  if (!Array.isArray(state.journeys)) state.journeys = [];
  if (!state.claimed) state.claimed = {};

  var activeChartMetric = 0;
  var selectedPointIdx = null;
  var setupAddingExtra = false;

  // Ensure demo mode automatically converts to personal mode if user uploads a photo or claims a perk
  function ensurePersonalMode() {
    if (state.mode === 'demo') {
      state.mode = 'mine';
      toast('Switched from Demo to your personal saved journey!');
    }
  }

  function updateSyncBadge(online) {
    var badge = $('#syncBadge');
    if (!badge) return;
    if (online) {
      badge.textContent = 'Synced';
      badge.classList.add('online');
    } else {
      badge.textContent = state.mode === 'demo' ? 'Demo' : 'Local';
      badge.classList.remove('online');
    }
  }

  function persist() {
    return API.pushServerState(state, function (localOk, serverOk) {
      updateSyncBadge(serverOk);
    });
  }

  // ---------- Multi-Product Journey Switcher ----------
  function saveCurrentIntoJourneys() {
    if (!Array.isArray(state.journeys)) state.journeys = [];
    var snap = {
      productId: state.productId,
      start: state.start,
      checkins: state.checkins || [],
      logs: state.logs || [],
      photos: state.photos || [],
      reminder: state.reminder || ''
    };
    var idx = state.journeys.findIndex(function (j) { return j.productId === state.productId; });
    if (idx > -1) state.journeys[idx] = snap;
    else state.journeys.push(snap);
  }

  function switchProductJourney(prodId) {
    saveCurrentIntoJourneys();
    var target = state.journeys.find(function (j) { return j.productId === prodId; });
    if (!target) return;
    state.productId = target.productId;
    state.start = target.start;
    state.checkins = target.checkins || [];
    state.logs = target.logs || [];
    state.photos = target.photos || [];
    state.reminder = target.reminder || '';
    dailyDraft = null; dailyEditing = false; selectedPointIdx = null;
    persist();
    renderAll();
    toast('Switched to ' + PRODUCTS[prodId].name);
  }

  function productSwitcherBar() {
    saveCurrentIntoJourneys();
    var bar = h('div', { class: 'product-switcher', role: ' region', 'aria-label': 'Active product journeys' });
    state.journeys.forEach(function (j) {
      var prod = PRODUCTS[j.productId];
      if (!prod) return;
      var active = j.productId === state.productId;
      bar.append(h('button', {
        type: 'button',
        class: 'prod-pill' + (active ? ' active' : ''),
        text: prod.name,
        onclick: function () { if (!active) switchProductJourney(j.productId); }
      }));
    });
    bar.append(h('button', {
      type: 'button',
      class: 'prod-pill add',
      text: '+ Track another product',
      onclick: function () { setupAddingExtra = true; switchTab('setup'); }
    }));
    return bar;
  }

  // ---------- Theme Toggle ----------
  function initTheme() {
    var saved = API.getTheme();
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    $('#themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var isDark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      API.setTheme(next);
      toast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
    });
  }

  var tt;
  function toast(msg) {
    var t = $('#toast'); t.querySelector('span').textContent = msg; t.hidden = false;
    clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 2800);
  }

  function switchTab(n) {
    document.querySelectorAll('[data-view]').forEach(function (s) {
      var off = s.id !== 'v-' + n;
      s.hidden = off;
      s.style.display = off ? 'none' : '';
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === n));
    });
    if (n === 'setup') renderSetup();
    if (n === 'help') renderHelp();
    if (n === 'helpmenu') renderHelpMenu();
    if (n === 'perks') renderPerks();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });
  $('#helpBtn').addEventListener('click', function () { switchTab('helpmenu'); });

  // ---------- Support state ----------
  var helpType = 'advisor', helpText = '', helpRef = null, helpAttach = true, helpFrom = 'journey';
  function openSupport(type, from) { helpType = type; helpRef = null; helpFrom = from || 'journey'; switchTab('help'); }

  // ---------- Clarified Daily Log & Catchy Streak ----------
  var dailyDraft = null, dailyEditing = false, dailyFor = null;
  // Clear, self-explanatory lifestyle & weather factors with icons
  var LIFESTYLE_FACTORS = [
    { id: '☀️ Heavy sun / outdoors', label: '☀️ Heavy sun / outdoors' },
    { id: '💧 Drank 2L+ water', label: '💧 Drank 2L+ water' },
    { id: '😴 Poor sleep or stress', label: '😴 Poor sleep or stress' },
    { id: '🏋️ Sweaty workout', label: '🏋️ Sweaty workout' },
    { id: '🥗 Ate clean / healthy', label: '🥗 Ate clean / healthy' },
    { id: '🧴 Used another new product', label: '🧴 Used another new product' }
  ];
  var SKIN = { ok: 'Skin comfortable', mild: 'Mild irritation', strong: 'Strong irritation' };
  function logFor(date) { return state.logs.filter(function (l) { return l.date === date; })[0]; }

  function catchyStreakBanner(st) {
    var nextGoal = st.days < 3 ? 3 : st.days < 7 ? 7 : st.days < 14 ? 14 : 30;
    var left = Math.max(0, nextGoal - st.days);
    return h('div', { class: 'streak-catchy' },
      h('strong', { text: '🔥 Build your Glow Streak — unlock Mystery Drops!' }),
      h('span', { text: 'Log daily! Who knows what secret discounts, flash freebies, or bonus perks you will unlock at 3, 7, and 14 days? ' + (left > 0 ? ('Only ' + left + (left === 1 ? ' more day' : ' more days') + ' until your next Mystery Drop!') : 'You have unlocked a Mystery Drop in Perks!') })
    );
  }

  function dailyCard() {
    var today = todayISO(), yday = SG.addDays(today, -1), st = SG.perks(state, today).streak;
    var demo = state.mode === 'demo';
    var note = st.pendingBackfill
      ? 'You missed yesterday. Fill it in now to save your streak!'
      : (st.broken ? 'Your streak restarted. Log today to kick off a fresh streak!' : 'Log every day to grow your streak. Missed yesterday? You can always backfill it the next day.');
    var card = h('div', { class: 'card' },
      h('div', { class: 'streakline' }, h('span', { class: 'big', text: String(st.days) }), h('span', { class: 'hint', text: 'day glow streak' })),
      catchyStreakBanner(st),
      h('p', { class: 'small', text: note }));

    if (demo) {
      card.append(
        h('p', { text: 'Start your own journey to log today, or tap below to start logging on this product right now.' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', text: 'Start my own journey', onclick: function () { setupAddingExtra = false; switchTab('setup'); } }),
          h('button', { class: 'btn', type: 'button', text: 'Unlock logging here', onclick: function () { ensurePersonalMode(); persist(); renderAll(); } })
        )
      );
      return card;
    }

    var canYday = yday >= state.start;
    var which = dailyFor || (st.pendingBackfill ? 'yesterday' : 'today');
    if (which === 'yesterday' && !canYday) which = 'today';
    var date = which === 'yesterday' ? yday : today;
    if (canYday) {
      var sw = h('div', { class: 'chips', role: 'group', 'aria-label': 'Which day are you logging' });
      [['today', 'Today (' + fmt(today) + ')'], ['yesterday', 'Yesterday (' + fmt(yday) + ')']].forEach(function (o) {
        sw.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(which === o[0]), text: o[1], onclick: function () {
          dailyFor = o[0]; dailyDraft = null; dailyEditing = false; renderJourney();
        } }));
      });
      card.append(sw);
    }
    var label = which === 'today' ? 'today' : 'yesterday';
    var ex = logFor(date);
    if (ex && !dailyEditing) {
      card.append(h('div', { class: 'status tone-good' },
        h('span', { class: 'pill', text: '✓ Logged ' + label }),
        h('p', { text: (ex.used ? 'Used product' : 'Skipped product') + ' · ' + SKIN[ex.skin] + (ex.tags.length ? ' · Factors: ' + ex.tags.join(', ') : '') + (ex.note ? ' · "' + ex.note + '"' : '') })),
        h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', text: 'Edit ' + label + '\'s log', onclick: function () { dailyEditing = true; dailyDraft = null; renderJourney(); } })));
      return card;
    }

    if (!dailyDraft) dailyDraft = ex ? { used: ex.used, skin: ex.skin, tags: ex.tags.slice(), note: ex.note || '' } : { used: null, skin: null, tags: [], note: '' };
    card.append(h('h2', { text: which === 'today' ? 'Quick daily log (10 sec)' : 'Backfill yesterday\'s log' }));
    var save = h('button', { class: 'btn primary', type: 'button', disabled: true, text: which === 'today' ? 'Save today\'s log & grow streak' : 'Save yesterday\'s log' });
    var sync = function () { save.disabled = dailyDraft.used === null || dailyDraft.skin === null; };
    var warn = h('div', { class: 'status tone-bad', hidden: true },
      h('p', { text: 'Strong irritation: pause the product and get medical advice. You can also report it to the brand.' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', text: 'Report a skin issue', onclick: function () { openSupport('reaction'); } })));

    var single = function (lab, opts, key) {
      var row = h('div', { class: 'chips', role: 'group', 'aria-label': lab });
      opts.forEach(function (o) {
        var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(dailyDraft[key] === o[0]), text: o[1] });
        b.addEventListener('click', function () {
          if (!dailyDraft) return;
          dailyDraft[key] = o[0];
          [].forEach.call(row.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          warn.hidden = dailyDraft.skin !== 'strong';
          sync();
        });
        row.append(b);
      });
      return h('div', { class: 'field' }, h('div', { class: 'flabel', text: lab }), row);
    };

    var when = which === 'today' ? 'today' : 'yesterday';
    card.append(single('1. Did you apply/take your product ' + when + '?', [[true, '✅ Yes, I used it'], [false, '⏭️ No, skipped it']], 'used'));
    card.append(single('2. How did your skin/scalp feel ' + when + '?', [['ok', '😊 Comfortable & normal'], ['mild', '😐 Mild dryness / itch'], ['strong', '⚠️ Strong irritation']], 'skin'));
    card.append(warn);

    // Fixed & Clarified Section 3: Daily Lifestyle & Weather Check
    var trow = h('div', { class: 'chips', role: 'group', 'aria-label': 'Daily lifestyle and weather factors' });
    LIFESTYLE_FACTORS.forEach(function (item) {
      var t = item.id;
      var b = h('button', { type: 'button', class: 'chip tag', 'aria-pressed': String(dailyDraft.tags.indexOf(t) > -1), text: item.label });
      b.addEventListener('click', function () {
        if (!dailyDraft) return;
        var i = dailyDraft.tags.indexOf(t);
        if (i > -1) dailyDraft.tags.splice(i, 1); else dailyDraft.tags.push(t);
        b.setAttribute('aria-pressed', String(i === -1));
      });
      trow.append(b);
    });
    card.append(h('div', { class: 'field' },
      h('div', { class: 'flabel', text: '3. Daily lifestyle & weather check (optional)' }),
      h('div', { class: 'hint', text: 'Why we ask: Sun, stress, or water intake can affect your skin. Tap any that happened ' + when + ' to track patterns:' }),
      trow
    ));

    var noteIn = h('input', { type: 'text', id: 'dNote', maxlength: 120, placeholder: 'E.g., Applied after evening shower, felt soothing...', oninput: function (e) { if (dailyDraft) dailyDraft.note = e.target.value; } });
    noteIn.value = dailyDraft.note;
    card.append(h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'dNote', text: '4. Quick personal note (optional)' }), noteIn));

    save.addEventListener('click', function () {
      if (!dailyDraft || dailyDraft.used === null || dailyDraft.skin === null) return;
      var rec = { date: date, used: dailyDraft.used, skin: dailyDraft.skin, tags: dailyDraft.tags.slice(), note: dailyDraft.note.trim() };
      state.logs = state.logs.filter(function (l) { return l.date !== date; }).concat(rec);
      state.logs.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
      state.logs = state.logs.slice(-400);
      saveCurrentIntoJourneys();
      var ok = persist(); dailyDraft = null; dailyEditing = false; dailyFor = null;
      var n = SG.perks(state, today).streak.days;
      renderAll(); toast(ok ? '🔥 Logged! Streak: ' + n + (n === 1 ? ' day' : ' days') : 'Could not save in this browser');
    });
    sync(); warn.hidden = dailyDraft.skin !== 'strong';
    card.append(h('div', { class: 'actions' }, save));
    return card;
  }

  function reminderCard() {
    var cur = state.reminder || '';
    var sel = h('select', { id: 'remSelect', onchange: function (e) {
      ensurePersonalMode();
      state.reminder = e.target.value;
      saveCurrentIntoJourneys();
      persist();
      toast(state.reminder ? 'Routine reminder set for ' + state.reminder : 'Reminder turned off');
      renderJourney();
    } },
      h('option', { value: '', text: 'Off — No routine reminder set' }),
      h('option', { value: 'Morning (8:00 AM)', text: '🌅 Morning Routine (8:00 AM)' }),
      h('option', { value: 'Afternoon (2:00 PM)', text: '☀️ Afternoon Routine (2:00 PM)' }),
      h('option', { value: 'Night (9:30 PM)', text: '🌙 Night Routine (9:30 PM)' })
    );
    sel.value = cur;
    return h('div', { class: 'card' },
      h('div', { class: 'mrow' },
        h('h3', { text: '⏰ Daily routine slot' }),
        cur ? h('span', { class: 'mval pos', text: cur }) : h('span', { class: 'mval', text: 'Not set' })
      ),
      h('p', { class: 'small', text: 'Using your product at the exact same time every day makes results appear faster.' }),
      sel
    );
  }

  function dailyHistory() {
    var today = todayISO(), cells = h('div', { class: 'cells', role: 'img' }), used = 0, logged = 0, irr = 0;
    for (var i = 13; i >= 0; i--) {
      var d = SG.addDays(today, -i), l = logFor(d);
      if (l) { logged++; if (l.used) used++; if (l.skin !== 'ok') irr++; }
      cells.append(h('i', { class: l ? (l.used ? 'on' : 'off') : '', title: fmt(d) + (l ? (l.used ? ': used' : ': skipped') : ': no log') }));
    }
    cells.setAttribute('aria-label', 'Last 14 days: used on ' + used + ', logged on ' + logged);
    return h('div', { class: 'card' }, h('h2', { text: 'Last 14 days' }), cells,
      h('p', { class: 'small', text: 'Filled = used it, tinted = skipped, empty = no log.' }),
      h('p', { text: 'Used on ' + used + ' of the last 14 days, logged on ' + logged + '. Skin irritation noted on ' + irr + (irr === 1 ? ' day.' : ' days.') }));
  }

  // ---------- Journey ----------
  function ribbon(a) {
    var p = a.p, total = p.W * 1.25;
    var pct = function (x) { return Math.max(0, Math.min(100, x / total * 100)); };
    var w1 = p.e / total * 100, w2 = (p.W - p.e) / total * 100, w3 = 100 - w1 - w2;
    var bar = h('div', { class: 'bar' },
      h('span', { class: 'seg s1', style: 'width:' + w1 + '%' }),
      h('span', { class: 'seg s2', style: 'width:' + w2 + '%' }),
      h('span', { class: 'seg s3', style: 'width:' + w3 + '%' }));
    a.cks.forEach(function (c) {
      bar.append(h('i', { class: 'tick', style: 'left:' + pct(SG.daysBetween(state.start, c.date) / 7) + '%' }));
    });
    bar.append(h('span', { class: 'you', style: 'left:' + pct(a.day / 7) + '%' }, h('b', { text: 'You' })));
    var labels = h('div', { class: 'seglabels' },
      h('div', { style: 'width:' + w1 + '%' }, h('b', { text: 'Settling in' }), 'Wk 0–' + p.e),
      h('div', { style: 'width:' + w2 + '%' }, h('b', { text: 'Early signs' }), 'Wk ' + p.e + '–' + p.W),
      h('div', { style: 'width:' + w3 + '%' }, h('b', { text: 'Fair verdict' }), 'Wk ' + p.W + '+'));
    return h('div', { class: 'ribbon' }, bar, labels);
  }

  function metaLine(a) {
    if (a.cons === null) return 'No weekly check-ins yet.';
    return 'Used on about ' + Math.round(a.cons * 7) + ' of 7 days recently · ' + a.cks.length + (a.cks.length === 1 ? ' check-in' : ' check-ins') + ' so far.';
  }

  function nextPanel(a) {
    var t = a.verdict.tone, title = a.verdict.title, items = [];
    var go = function (tab) { return function () { switchTab(tab); }; };
    if (t === 'wait') {
      items.push({ head: 'Set your day-one baseline', body: 'Upload a Day-1 photo in good light and do your first check-in. Your first fair look is ' + fmt(a.firstLookDate) + '.', btns: [['Do a check-in', go('checkin'), true], ['Upload photo', go('progress'), false]] });
    } else if (t === 'good') {
      items.push({ head: 'Keep it going', body: 'Stick to most days, log each day and check in weekly. Check your Perks tab for Mystery Streak Drops!', btns: [['See my perks & drops', go('perks'), true]] });
    } else if (t === 'neutral') {
      items.push({ head: 'Make the next weeks count', body: 'Use it at the same time each day, and upload a photo in the Progress tab to compare side by side.', btns: [['Do a check-in', go('checkin'), true], ['Upload photo', go('progress'), false]] });
    } else if (t === 'warn' && title !== 'Little change so far') {
      items.push({ head: 'Fix the routine first', body: 'Gaps make results slower and harder to read. Aim for most days for four weeks, then check in again.', btns: [['Do a check-in', go('checkin'), true]] });
    } else if (t === 'warn') {
      items.push({ head: 'Option 1: give it four more weeks', body: 'If your use was regular, small changes can still be on the way. Check in weekly and look again.', btns: [] });
      items.push({ head: 'Option 2: talk to an advisor', body: 'Send your progress summary to a Be Bodywise advisor so you do not have to explain it again.', btns: [['Talk to an advisor', function () { openSupport('advisor'); }, true]] });
      items.push({ head: 'Option 3: tell the brand', body: 'Say what you noticed and what the product should explain or change.', btns: [['Share feedback', function () { openSupport('feedback'); }]] });
    } else if (t === 'bad') {
      items.push({ head: 'Pause and get help', body: 'Stop using the product and ask a pharmacist or doctor. You can also report this to the brand.', btns: [['Report a skin issue', function () { openSupport('reaction'); }, true], ['Talk to an advisor', function () { openSupport('advisor'); }]] });
    }
    return h('div', { class: 'card' }, h('h2', { text: 'What to do next' }), items.map(function (it) {
      return h('div', { class: 'next' }, h('h3', { text: it.head }), h('p', { text: it.body }),
        it.btns.length ? h('div', { class: 'actions' }, it.btns.map(function (b) { return h('button', { class: 'btn' + (b[2] ? ' primary' : ''), type: 'button', text: b[0], onclick: b[1] }); })) : null);
    }));
  }

  var armed = false;
  function renderJourney() {
    var r = $('#v-journey'); r.replaceChildren();
    var a = SG.analyse(state, todayISO()), p = a.p, demo = state.mode === 'demo';
    r.append(productSwitcherBar());

    if (demo) {
      r.append(h('div', { class: 'banner' },
        h('p', {}, h('strong', { text: 'Example journey. ' }), 'This follows a customer using the ' + p.name + ', now in week ' + a.week + '. You can explore all tabs, upload photos, or start your own fresh product journey.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', onclick: function () { setupAddingExtra = false; switchTab('setup'); }, text: 'Start my own journey' }),
          h('button', { class: 'btn', type: 'button', onclick: function () { switchTab('progress'); }, text: '📸 Try photo upload' })
        )));
    }
    r.append(h('div', { class: 'hero' },
      h('div', { class: 'eyebrow', text: p.name + ' · started ' + fmt(state.start) }),
      h('div', { class: 'daynum' },
        h('span', { class: 'num', text: 'Day ' + a.day }),
        h('span', { class: 'sub', text: 'A fair verdict is possible from about day ' + (p.W * 7) + ', around ' + fmt(a.verdictDate) + '.' })),
      ribbon(a)));
    var v = a.verdict;
    r.append(h('div', { class: 'status tone-' + v.tone },
      h('span', { class: 'pill', text: v.tag }),
      h('h2', { text: v.title }),
      h('p', { text: v.body }),
      h('p', { class: 'meta', text: metaLine(a) })));
    if (a.alert) {
      r.append(h('div', { class: 'status tone-bad' },
        h('h2', { text: 'You rated something much worse' }),
        h('p', { text: 'If this is irritation or discomfort, pause the product and ask a pharmacist or doctor.' }),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', text: 'Report a skin issue', onclick: function () { openSupport('reaction'); } }))));
    }
    r.append(dailyCard());
    r.append(reminderCard());
    var np = nextPanel(a);
    if (np) r.append(np);

    var actions = h('div', { class: 'actions' });
    actions.append(h('button', { class: 'btn primary', type: 'button', onclick: function () { switchTab('checkin'); }, text: a.due ? 'Do weekly check-in now' : 'Do weekly check-in' }));
    actions.append(h('p', { class: 'hint', text: a.due && !demo ? 'Your weekly check-in is due.' : 'Next weekly check-in: ' + fmt(a.next) + '.' }));
    r.append(actions);

    var ms = [
      ['settle', 'Settling in', 'Weeks 0–' + p.e, p.phases.settle],
      ['signs', 'Early signs', 'Weeks ' + p.e + '–' + p.W, p.phases.signs],
      ['verdict', 'Fair verdict', 'Week ' + p.W + ' onward', p.phases.verdict]
    ];
    r.append(h('div', { class: 'card' },
      h('h2', { text: 'Why it takes this long' }),
      h('p', { text: p.why }),
      h('ul', { class: 'milestones' }, ms.map(function (m) {
        return h('li', { class: a.phase === m[0] ? 'current' : '' },
          h('span', { class: 'wk', text: m[2] + (a.phase === m[0] ? ' · you are here' : '') }),
          h('strong', { text: m[1] }), h('span', { text: m[3] }));
      })),
      h('p', { class: 'small', text: 'General guide, not the brand\'s own claim. Follow the directions on your pack.' })));

    if (!demo) {
      var btn = h('button', { class: 'btn danger', type: 'button', text: 'Reset all journeys' });
      btn.addEventListener('click', function () {
        if (!armed) { armed = true; btn.textContent = 'Tap again to erase everything'; return; }
        armed = false;
        API.deleteServerState(function () { updateSyncBadge(false); });
        state = SG.demoState(todayISO()); renderAll(); switchTab('setup'); toast('Journey erased');
      });
      r.append(h('div', { class: 'actions' }, btn));
    }
  }

  // ---------- Image Compression Helper ----------
  var draft = null;
  function shrink(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 640 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = function () { cb(null); };
      img.src = fr.result;
    };
    fr.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }

  // Collect all photos from both standalone state.photos and weekly checkins
  function getAllPhotos() {
    var list = [];
    (state.photos || []).forEach(function (p) {
      list.push({ id: p.id, date: p.date, url: p.url, label: p.label || '' });
    });
    (state.checkins || []).forEach(function (c) {
      if (c.photo) list.push({ id: 'ck-' + c.id, date: c.date, url: c.photo, label: 'Check-in' });
    });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return list;
  }

  // ---------- Check-in (Unlocked + Styled Photo Dropzone) ----------
  function renderCheckin() {
    var r = $('#v-checkin'); r.replaceChildren();
    var a = SG.analyse(state, todayISO()), p = a.p;
    draft = { vals: [null, null, null], days: null, note: '', photo: null };
    var save = h('button', { class: 'btn primary', type: 'button', id: 'saveBtn', disabled: true, text: 'Save weekly check-in' });
    var sync = function () { save.disabled = !(draft.vals.every(function (v) { return v !== null; }) && draft.days !== null); };

    var form = h('div', { class: 'card' },
      h('h2', { text: 'Weekly check-in · ' + p.name }),
      h('p', { class: 'hint', text: 'Once a week, compare how things look with day one. Takes about 30 seconds.' }));

    p.measures.forEach(function (m, i) {
      var row = h('div', { class: 'chips levels', role: 'group', 'aria-label': m.label });
      LEVELS.forEach(function (l) {
        var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', text: l.t });
        b.addEventListener('click', function () {
          draft.vals[i] = l.v;
          [].forEach.call(row.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          sync();
        });
        row.append(b);
      });
      form.append(h('div', { class: 'field' }, h('div', { class: 'flabel', text: m.label }), h('div', { class: 'hint', text: m.hint }), row));
    });

    var drow = h('div', { class: 'chips days', role: 'group', 'aria-label': 'Days used this week' });
    for (var d = 0; d <= 7; d++) {
      (function (n) {
        var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', text: String(n) });
        b.addEventListener('click', function () {
          draft.days = n;
          [].forEach.call(drow.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          sync();
        });
        drow.append(b);
      })(d);
    }
    form.append(h('div', { class: 'field' }, h('div', { class: 'flabel', text: 'On how many days did you use it this week?' }), drow));

    form.append(h('div', { class: 'field' },
      h('label', { class: 'flabel', for: 'note', text: 'Anything you noticed? (optional)' }),
      h('textarea', { id: 'note', rows: 3, maxlength: 280, placeholder: 'For example: skin feels smoother, or noticed fewer bumps in daylight.', oninput: function (e) { draft.note = e.target.value; } })));

    // Styled Photo Dropzone inside Check-in
    var prev = h('img', { class: 'preview', alt: 'Photo preview', hidden: true });
    var fileInput = h('input', { type: 'file', id: 'photo', accept: 'image/*', hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) { draft.photo = null; prev.hidden = true; return; }
      shrink(f, function (url) {
        if (!url) { toast('That photo could not be read'); return; }
        draft.photo = url; prev.src = url; prev.hidden = false;
        toast('Photo attached to check-in!');
      });
    } });

    var dropzone = h('div', { class: 'photo-dropzone', role: 'button', tabindex: '0', onclick: function () { fileInput.click(); } },
      h('span', { class: 'cam-icon', text: '📸' }),
      h('strong', { text: 'Tap to upload or take a check-in photo' }),
      h('span', { class: 'small', text: 'JPG, PNG or WebP · Same spot & lighting works best' })
    );

    form.append(h('div', { class: 'field' },
      h('div', { class: 'flabel', text: 'Progress photo (optional)' }),
      fileInput,
      dropzone,
      prev));

    save.addEventListener('click', function () {
      ensurePersonalMode();
      var c = { id: Date.now().toString(36), date: todayISO(), vals: draft.vals.slice(), days: draft.days, note: draft.note.trim() };
      if (draft.photo) c.photo = draft.photo;
      state.checkins = state.checkins.filter(function (x) { return x.date !== c.date; }).concat(c);
      saveCurrentIntoJourneys();
      var ok = persist(), msg = 'Check-in saved!';
      if (!ok && c.photo) { delete c.photo; ok = persist(); msg = ok ? 'Saved without photo (storage full).' : 'Could not save in this browser'; }
      else if (!ok) msg = 'Could not save in this browser';
      renderAll(); switchTab('progress'); toast(msg);
    });
    form.append(save);
    r.append(form);
  }

  // ---------- Progress (Interactive Chart Tooltips + Direct Photo Upload) ----------
  function chartSVG(a, metricIdx) {
    var idx = metricIdx || 0;
    var p = a.p, W = 360, H = 200, L = 66, R = 14, T = 28, B = 30, pw = W - L - R, ph = H - T - B;
    var wk = function (c) { return SG.daysBetween(state.start, c.date) / 7; };
    var lastWeek = a.cks.length ? Math.max.apply(null, a.cks.map(wk)) : 0;
    var xmax = Math.max(Math.ceil(p.W * 1.25), Math.ceil(lastWeek) + 1);
    var X = function (w) { return L + Math.min(w, xmax) / xmax * pw; };
    var Y = function (v) { return T + (2 - v) / 4 * ph; };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Line chart of ' + p.measures[idx].label + ' by week">';
    s += '<rect class="band-early" x="' + X(0) + '" y="' + T + '" width="' + (X(p.e) - X(0)) + '" height="' + ph + '"/>';
    s += '<rect class="band-verdict" x="' + X(p.W) + '" y="' + T + '" width="' + (X(xmax) - X(p.W)) + '" height="' + ph + '"/>';
    s += '<text class="ax" x="' + ((X(0) + X(p.e)) / 2) + '" y="' + (T - 10) + '" text-anchor="middle">Too early</text>';
    s += '<text class="ax" x="' + (W - R) + '" y="' + (T - 10) + '" text-anchor="end">Fair verdict</text>';
    var names = { '-2': 'Much worse', '-1': 'Worse', '0': 'Same', '1': 'Better', '2': 'Much better' };
    for (var v = -2; v <= 2; v++) {
      s += '<line class="' + (v === 0 ? 'zero' : 'grid') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
      s += '<text class="ax" x="' + (L - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + names[v] + '</text>';
    }
    var step = xmax <= 10 ? 2 : 4;
    for (var w = 0; w <= xmax; w += step) {
      s += '<text class="ax" x="' + X(w) + '" y="' + (H - 10) + '" text-anchor="middle">' + (w === 0 ? 'wk 0' : w) + '</text>';
    }
    var pts = [{ w: 0, v: 0 }].concat(a.cks.map(function (c) { return { w: wk(c), v: c.vals[idx] }; }));
    s += '<polyline class="ln" points="' + pts.map(function (q) { return X(q.w).toFixed(1) + ',' + Y(q.v).toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (q, i) {
      s += '<circle class="pt" data-pt="' + i + '" cx="' + X(q.w).toFixed(1) + '" cy="' + Y(q.v).toFixed(1) + '" r="' + (i === pts.length - 1 && i > 0 ? 5.5 : 4) + '"/>';
    });
    var ringIdx = selectedPointIdx !== null && pts[selectedPointIdx] ? selectedPointIdx : (pts.length > 1 ? pts.length - 1 : -1);
    if (ringIdx > -1) {
      var l = pts[ringIdx];
      s += '<circle class="ring" cx="' + X(l.w).toFixed(1) + '" cy="' + Y(l.v).toFixed(1) + '" r="9"/>';
    }
    return s + '</svg>';
  }

  function photoCard(a) {
    var allPhotos = getAllPhotos();
    var card = h('div', { class: 'card' },
      h('div', { class: 'mrow' },
        h('h2', { text: '📸 Before & After Photos' }),
        h('span', { class: 'mval', text: allPhotos.length + (allPhotos.length === 1 ? ' photo' : ' photos') })
      ),
      h('p', { class: 'hint', text: 'Upload your Day-1 baseline photo and progress photos anytime to compare them side-by-side.' })
    );

    var dayOf = function (d) { return Math.max(0, SG.daysBetween(state.start, d)); };

    // Direct Photo Upload Controls right inside the card!
    var fileInBefore = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      shrink(f, function (url) {
        if (!url) { toast('Could not read image'); return; }
        ensurePersonalMode();
        state.photos.push({ id: 'p-' + Date.now(), date: state.start, url: url, label: 'Day 1 Baseline' });
        saveCurrentIntoJourneys(); persist(); renderProgress(); toast('📸 Day-1 baseline photo uploaded!');
      });
    } });

    var fileInLatest = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      shrink(f, function (url) {
        if (!url) { toast('Could not read image'); return; }
        ensurePersonalMode();
        state.photos.push({ id: 'p-' + Date.now(), date: todayISO(), url: url, label: 'Day ' + a.day });
        saveCurrentIntoJourneys(); persist(); renderProgress(); toast('📸 Progress photo uploaded!');
      });
    } });

    var uploadZone = h('div', { class: 'photo-dropzone', onclick: function () { fileInLatest.click(); } },
      h('span', { class: 'cam-icon', text: '📷' }),
      h('strong', { text: 'Click here to upload a progress photo' }),
      h('span', { class: 'small', text: 'Or use the buttons below to add a Day-1 Before photo or Today\'s After photo' })
    );

    var uploadBtns = h('div', { class: 'actions' },
      h('button', { class: 'btn primary sm', type: 'button', text: '+ Upload Today\'s Photo (Day ' + a.day + ')', onclick: function () { fileInLatest.click(); } }),
      h('button', { class: 'btn sm', type: 'button', text: '+ Upload Day-1 "Before" Photo', onclick: function () { fileInBefore.click(); } })
    );

    card.append(fileInBefore, fileInLatest, uploadZone, uploadBtns);

    if (allPhotos.length === 1) {
      card.append(
        h('div', { class: 'cmpwrap' },
          h('div', { class: 'cmp' }, h('img', { src: allPhotos[0].url, alt: 'Uploaded photo from day ' + dayOf(allPhotos[0].date) }))
        ),
        h('p', { class: 'small', text: 'Great! Upload one more photo so you can drag the Before/After comparison slider.' })
      );
    } else if (allPhotos.length >= 2) {
      var first = allPhotos[0], last = allPhotos[allPhotos.length - 1];
      var cmp = h('div', { class: 'cmp' },
        h('img', { src: last.url, alt: 'Latest photo, day ' + dayOf(last.date) }),
        h('img', { class: 'before', src: first.url, alt: 'First photo, day ' + dayOf(first.date) }),
        h('span', { class: 'handle' }),
        h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Drag to compare your first and latest photo', oninput: function (e) { cmp.style.setProperty('--pos', e.target.value + '%'); } }));
      card.append(
        h('div', { class: 'cmpwrap' },
          cmp,
          h('div', { class: 'cmplabels' },
            h('span', { text: 'BEFORE · Day ' + dayOf(first.date) + ' (' + fmt(first.date) + ')' }),
            h('span', { text: 'AFTER · Day ' + dayOf(last.date) + ' (' + fmt(last.date) + ')' })
          )
        ),
        h('p', { class: 'small', text: '↔️ Drag the white slider left and right across the photo to compare.' })
      );
    }

    // Thumbnail strip with delete option
    if (allPhotos.length > 0) {
      var strip = h('div', { class: 'photo-thumbs' });
      allPhotos.forEach(function (ph) {
        var canDel = String(ph.id).indexOf('p-') === 0;
        strip.append(h('div', { class: 'thumb-item' },
          h('img', { src: ph.url, alt: 'Day ' + dayOf(ph.date) }),
          h('span', { text: 'Day ' + dayOf(ph.date) }),
          canDel ? h('button', { class: 'thumb-del', type: 'button', title: 'Remove photo', text: '×', onclick: function () {
            state.photos = (state.photos || []).filter(function (x) { return x.id !== ph.id; });
            saveCurrentIntoJourneys(); persist(); renderProgress(); toast('Photo removed');
          } }) : null
        ));
      });
      card.append(strip);
    }

    return card;
  }

  function summaryText(a) {
    var p = a.p, lines = ['Slow Glow summary', 'Product: ' + p.name, 'Day ' + a.day + ' (week ' + a.week + '), ' + a.cks.length + ' check-ins'];
    if (a.cons !== null) lines.push('Used on about ' + Math.round(a.cons * 7) + ' of 7 days recently');
    if (a.last) p.measures.forEach(function (m, i) { lines.push(m.label + ': ' + LEVELS.filter(function (l) { return l.v === a.last.vals[i]; })[0].t.toLowerCase() + ' vs day one'); });
    lines.push('Status: ' + a.verdict.title);
    lines.push('General guide: first signs from week ' + p.e + ', fair verdict from week ' + p.W + '.');
    return lines.join('\n');
  }

  function renderProgress() {
    var r = $('#v-progress'); r.replaceChildren();
    var a = SG.analyse(state, todayISO()), p = a.p;
    if (activeChartMetric >= p.measures.length) activeChartMetric = 0;

    // Put Photo Comparison right at the top of Progress so it's super easy to find!
    r.append(photoCard(a));

    var metricChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Select measure to view on chart' });
    p.measures.forEach(function (m, idx) {
      metricChips.append(h('button', {
        type: 'button',
        class: 'chip tag',
        'aria-pressed': String(activeChartMetric === idx),
        text: m.label,
        onclick: function () { activeChartMetric = idx; renderProgress(); }
      }));
    });

    var tooltipBox = h('div', { class: 'chart-tooltip' });
    var updateTooltip = function (ptIdx) {
      if (ptIdx === 0 || !a.cks.length) {
        tooltipBox.replaceChildren(
          h('strong', { text: 'Day 1 Baseline (' + fmt(state.start) + ')' }),
          h('span', { class: 'small', text: 'Starting point · Tap any dot on the line to inspect that week' })
        );
        return;
      }
      var ck = a.cks[ptIdx - 1];
      if (!ck) return;
      var val = ck.vals[activeChartMetric];
      var lv = LEVELS.filter(function (l) { return l.v === val; })[0];
      var wkNum = Math.max(1, Math.round(SG.daysBetween(state.start, ck.date) / 7));
      tooltipBox.replaceChildren(
        h('div', {},
          h('strong', { text: 'Week ' + wkNum + ' (' + fmt(ck.date) + ') · ' + lv.t }),
          ck.note ? h('p', { class: 'small', text: '"' + ck.note + '"' }) : null
        ),
        h('span', { class: 'mval', text: 'Used ' + ck.days + '/7 days' })
      );
    };

    var chart = h('div', { class: 'card' },
      h('h2', { text: p.measures[activeChartMetric].label + ' over time' }),
      metricChips,
      h('p', { class: 'hint', text: 'Tap any dot on the chart to inspect that week\'s check-in details.' }),
      h('div', { class: 'chartwrap' }),
      tooltipBox
    );
    var wrap = chart.querySelector('.chartwrap');
    wrap.innerHTML = chartSVG(a, activeChartMetric);
    wrap.querySelectorAll('.pt').forEach(function (circle) {
      circle.addEventListener('click', function () {
        selectedPointIdx = Number(circle.getAttribute('data-pt'));
        renderProgress();
      });
    });
    updateTooltip(selectedPointIdx !== null ? selectedPointIdx : a.cks.length);

    r.append(chart);
    r.append(dailyHistory());

    if (a.last) {
      r.append(h('div', { class: 'card' }, h('h2', { text: 'Latest check-in' }),
        h('div', { class: 'rows' }, p.measures.map(function (m, i) {
          var v = a.last.vals[i], lv = LEVELS.filter(function (l) { return l.v === v; })[0];
          return h('div', { class: 'mrow' }, h('span', { text: m.label }), h('span', { class: 'mval ' + (v > 0 ? 'pos' : v < 0 ? 'neg' : ''), text: lv.t }));
        })),
        h('p', { class: 'small', text: 'Checked in on ' + fmt(a.last.date) + '.' })));

      r.append(h('div', { class: 'card' }, h('h2', { text: 'How regularly you used it' }),
        h('div', { class: 'rows' }, a.cks.slice(-6).map(function (c) {
          var dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
          for (var i = 0; i < 7; i++) dots.append(h('i', { class: i < c.days ? 'on' : '' }));
          return h('div', { class: 'urow' }, h('span', { class: 'lbl', text: 'Wk ' + Math.max(1, Math.round(SG.daysBetween(state.start, c.date) / 7)) }), dots, h('span', { class: 'cnt', text: c.days + '/7' }));
        })),
        h('p', { class: 'small', text: 'Results are easiest to read when you use the product on most days.' })));
    }

    var notes = a.cks.filter(function (c) { return c.note; }).slice(-3).reverse();
    if (notes.length) {
      r.append(h('div', { class: 'card' }, h('h2', { text: 'Your notes' }),
        h('ul', { class: 'journal' }, notes.map(function (c) { return h('li', {}, h('b', { text: fmt(c.date) }), c.note); }))));
    }

    var ta = h('textarea', { class: 'summary', id: 'summary', readonly: true, 'aria-label': 'Progress summary' });
    ta.value = summaryText(a);
    var copy = h('button', { class: 'btn', type: 'button', text: 'Copy summary' });
    copy.addEventListener('click', function () {
      var fallback = function () { ta.focus(); ta.select(); toast('Text selected. Use your device copy option.'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast('Summary copied'); }, fallback);
        else fallback();
      } catch (e) { fallback(); }
    });
    r.append(h('div', { class: 'card' }, h('h2', { text: 'Share an honest summary' }),
      h('p', { class: 'hint', text: 'Plain facts about your progress. It has no name or contact details. Share it with your doctor or with the brand.' }), ta,
      h('div', { class: 'actions' }, copy, h('button', { class: 'btn', type: 'button', text: 'Send to an advisor', onclick: function () { openSupport('advisor'); } }))));
  }

  // ---------- Perks (Normal Mystery Streak Drops + Student + 5-Order) ----------
  var MYSTERY_TIERS = [
    { key: 'm3', days: 3, title: '🎁 3-Day Sparkle Drop', desc: 'Unlock a surprise 10% OFF coupon on your next refill.', prefix: 'SPARK10-' },
    { key: 'm7', days: 7, title: '⚡ 7-Day Week Warrior', desc: 'Unlock Free Express Shipping + a mystery mini sample.', prefix: 'WARRIOR7-' },
    { key: 'm14', days: 14, title: '👑 14-Day Glow Master', desc: 'Unlock a Flat ₹150 OFF voucher on any combo kit.', prefix: 'GLOW150-' }
  ];

  function renderPerks() {
    var r = $('#v-perks'); r.replaceChildren();
    var pk = SG.perks(state, todayISO()), st = pk.streak, run = pk.run;
    var meter = function (done, need) {
      return h('div', { class: 'meter', role: 'img', 'aria-label': done + ' of ' + need }, h('i', { style: 'width:' + Math.min(100, (done / need * 100)) + '%' }));
    };
    var claimBlock = function (key, open, lockText, prefix) {
      if (state.claimed[key]) {
        return h('div', { class: 'rows' }, h('span', { class: 'code', text: state.claimed[key] }),
          h('p', { class: 'small', text: 'Unlocked! Copy this code at checkout.' }));
      }
      return h('div', { class: 'actions' }, h('button', {
        class: 'btn sm' + (open ? ' primary' : ''), type: 'button', disabled: !open, text: open ? '🎉 Reveal Mystery Offer' : lockText,
        onclick: function () {
          ensurePersonalMode();
          state.claimed[key] = (prefix || 'SG-') + rand4();
          persist(); renderPerks(); toast('🎉 Mystery reward unlocked!');
        }
      }));
    };

    // Normal Basic Streak Card + Catchy Mystery Drops for EVERYONE (No Student ID needed)
    var line = st.pendingBackfill ? 'You missed yesterday. Fill it in on the Journey tab to keep your streak.'
      : st.days > 0 ? (st.loggedToday ? 'Logged today. Keep going tomorrow!' : 'Log today on the Journey tab to keep your streak alive.')
      : 'Log today on the Journey tab to start your streak!';

    var mysteryGrid = h('div', { class: 'mystery-grid' });
    MYSTERY_TIERS.forEach(function (tier) {
      var open = st.days >= tier.days;
      mysteryGrid.append(h('div', { class: 'mystery-box' + (open ? ' unlocked' : '') },
        h('div', { class: 'rows' },
          h('h3', { text: tier.title }),
          h('p', { class: 'small', text: tier.desc }),
          meter( Math.min(st.days, tier.days), tier.days ),
          h('span', { class: 'small', text: Math.min(st.days, tier.days) + ' / ' + tier.days + ' day streak' })
        ),
        claimBlock(tier.key, open, 'Need ' + tier.days + '-day streak', tier.prefix)
      ));
    });

    r.append(h('div', { class: 'card' },
      h('div', { class: 'streakline' }, h('span', { class: 'big', text: String(st.days) }), h('span', { class: 'hint', text: 'day glow streak' })),
      catchyStreakBanner(st),
      h('p', { class: 'small', text: line }),
      h('h2', { text: '✨ Mystery Streak Drops (For Everyone)' }),
      h('p', { class: 'hint', text: 'No student ID needed! Just build your daily streak to unlock surprise offers and freebies:' }),
      mysteryGrid
    ));

    // Student 100-Day Gift Section
    var stu = h('div', { class: 'card' }, h('h2', { text: '🎓 Bonus: 100-Day Student Gift' }));
    if (state.studentCheck) {
      var sc = state.studentCheck;
      stu.append(h('span', { class: 'pill', text: 'Student verified' }),
        h('p', { text: 'College: ' + sc.domain + ' · ' + sc.product + ' · order ' + sc.orderMasked + ' on ' + fmt(sc.orderDate) }),
        h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', text: 'Remove verification', onclick: function () { state.studentCheck = null; persist(); renderPerks(); } })));
    } else {
      stu.append(verifyForm());
    }
    var info = pk.g100;
    stu.append(h('div', { class: 'reward' },
      h('h3', { text: 'Free Full-Size Gift at 100-Day Streak' }),
      h('p', { text: 'Verified college students get a special gift pack at 100 days (up to 3 single missed days allowed along the way).' }),
      meter(info.done, info.need),
      h('p', { class: 'small', text: info.done + ' of ' + info.need + ' days · missed days used: ' + run.skips + ' of 3' }),
      claimBlock('g100', info.open, pk.verified ? 'Locked until 100 days' : 'Verify student email above to unlock', 'STU100-')));
    r.append(stu);

    r.append(ordersCard(pk));
  }

  var PLATFORMS = ['Be Bodywise website', 'Amazon', 'Flipkart', 'Nykaa', 'Quick commerce app (Blinkit, Zepto, Instamart)', 'Offline store', 'Other'];

  function ordersCard(pk) {
    var today = todayISO();
    var card = h('div', { class: 'card' },
      h('h2', { text: '🛍️ Buy 5 products, get a mini 6th free' }),
      h('p', { text: 'Add each order with its order number, date and where you bought it.' }),
      h('div', { class: 'meter', role: 'img', 'aria-label': pk.buy.done + ' of 5 orders' }, h('i', { style: 'width:' + (pk.buy.done / 5 * 100) + '%' })),
      h('p', { class: 'small', text: state.orders.length + ' orders added · ' + pk.buy.done + ' of 5 counted' }));
    if (state.orders.length) {
      card.append(h('ul', { class: 'orders' }, state.orders.map(function (o, i) {
        return h('li', {}, h('span', { text: o.platform + ' · ' + o.product + ' · ' + o.masked + ' · ' + fmt(o.date) }),
          h('button', { class: 'linkbtn', type: 'button', 'aria-label': 'Remove order ' + o.masked, text: 'Remove', onclick: function () { ensurePersonalMode(); state.orders.splice(i, 1); persist(); renderPerks(); } }));
      })));
    }
    var plat = h('select', { id: 'oPlat' }, PLATFORMS.map(function (t) { return h('option', { value: t, text: t }); }));
    var prod = productSelect('oProd', false);
    var num = h('input', { type: 'text', id: 'oNum', placeholder: 'For example 123-4567890', maxlength: 20, autocomplete: 'off' });
    var dt = h('input', { type: 'date', id: 'oDate', max: today, min: SG.addDays(today, -365) });
    var err = h('div', { class: 'status tone-bad', hidden: true });
    var add = h('button', { class: 'btn', type: 'button', text: 'Add order' });
    add.addEventListener('click', function () {
      var res = state.orders.length >= 12
        ? { ok: false, errors: ['You can add up to 12 orders.'] }
        : SG.validateOrder({ platform: plat.value, product: prod.value, order: num.value, date: dt.value }, today, state.orders);
      if (!res.ok) {
        err.replaceChildren(h('h3', { text: 'Please fix these' }), h('ul', { class: 'errs' }, res.errors.map(function (m) { return h('li', { text: m }); })));
        err.hidden = false; return;
      }
      ensurePersonalMode();
      err.hidden = true; state.orders.push(res.record);
      state.orders.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
      persist(); renderPerks(); toast('Order added');
    });
    card.append(h('div', { class: 'rows' },
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'oPlat', text: 'Where did you buy it?' }), plat),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'oProd', text: 'Product' }), prod),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'oNum', text: 'Order number (required)' }), num),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'oDate', text: 'Order date' }), dt),
      err, h('div', { class: 'actions' }, add)));

    if (state.claimed.buy) {
      card.append(h('span', { class: 'code', text: state.claimed.buy }),
        h('p', { class: 'small', text: 'Apply this code at checkout on your next order.' }));
    } else if (pk.buy.open) {
      var latest = SG.latestOrder(state);
      var cNum = h('input', { type: 'text', id: 'oConfirm', placeholder: 'Order number ending ' + latest.masked.slice(-4), maxlength: 20, autocomplete: 'off' });
      var cErr = h('p', { class: 'small', hidden: true, text: 'That does not match your latest order. Check the number and try again.' });
      var go = h('button', { class: 'btn primary', type: 'button', text: 'Verify and claim mini gift' });
      go.addEventListener('click', function () {
        if (!SG.confirmOrder(state, cNum.value)) { cErr.hidden = false; return; }
        ensurePersonalMode();
        state.claimed.buy = 'SG-' + rand4() + '-' + rand4(); persist(); renderPerks(); toast('Mini gift claimed');
      });
      card.append(h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'oConfirm', text: 'Second check: re-enter your latest order number' }), cNum),
        cErr, h('div', { class: 'actions' }, go));
    } else {
      card.append(h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', disabled: true, text: 'Locked until 5 orders are added' })));
    }
    return card;
  }

  function verifyForm() {
    var email = h('input', { type: 'email', id: 'sEmail', autocomplete: 'off', placeholder: 'you@college.ac.in' });
    var prod = productSelect('sProd', false);
    var order = h('input', { type: 'text', id: 'sOrder', placeholder: 'For example BW-123456', maxlength: 14, autocomplete: 'off' });
    var odate = h('input', { type: 'date', id: 'sDate', max: todayISO(), min: SG.addDays(todayISO(), -365) });
    var err = h('div', { class: 'status tone-bad', hidden: true });
    var btn = h('button', { class: 'btn primary', type: 'button', text: 'Verify student status' });
    btn.addEventListener('click', function () {
      var res = SG.validateStudent({ email: email.value, product: prod.value, order: order.value, date: odate.value }, todayISO());
      if (!res.ok) {
        err.replaceChildren(h('h3', { text: 'Please fix these' }), h('ul', { class: 'errs' }, res.errors.map(function (m) { return h('li', { text: m }); })));
        err.hidden = false; return;
      }
      ensurePersonalMode();
      err.hidden = true; state.studentCheck = res.record; persist(); renderPerks(); toast('Student status verified');
    });
    return h('div', { class: 'rows' },
      h('p', { class: 'hint', text: 'Optional: Have a college email (.ac.in, .edu.in, .edu)? Verify below to unlock the 100-day student mega gift.' }),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'sEmail', text: 'College email' }), email),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'sProd', text: 'Product you bought' }), prod),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'sOrder', text: 'Order number' }), order),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'sDate', text: 'Order date' }), odate),
      err, h('div', { class: 'actions' }, btn));
  }

  // ---------- Help menu ----------
  function renderHelpMenu() {
    var r = $('#v-helpmenu'); r.replaceChildren();
    var labels = { reaction: 'Skin issue', advisor: 'Advisor request', feedback: 'Brand feedback' };
    var rows = [
      ['reaction', 'Report a skin issue', 'Redness, itching, stinging, a breakout or dryness since you started'],
      ['advisor', 'Talk to an advisor', 'Send your progress summary and ask about your results'],
      ['feedback', 'Share feedback', 'Tell the brand what to change or explain better']
    ];
    r.append(h('div', { class: 'card' },
      h('h2', { text: 'Help and support' }),
      h('p', { class: 'hint', text: 'Pick what you need. Nothing here asks for your name or phone number.' }),
      h('div', { class: 'rows' }, rows.map(function (x) {
        return h('button', { class: 'menurow', type: 'button', onclick: function () { openSupport(x[0], 'helpmenu'); } },
          h('span', { class: 'mtxt' }, h('strong', { text: x[1] }), h('span', { text: x[2] })),
          h('span', { class: 'chev', 'aria-hidden': 'true', text: '›' }));
      }))));

    var a = SG.analyse(state, todayISO()), p = a.p;
    r.append(h('div', { class: 'card' }, h('h2', { text: 'Quick answers' }),
      h('details', {}, h('summary', { text: 'When should I see results?' }), h('p', { text: 'For the ' + p.name + ', first signs are typical from about week ' + p.e + ' and a fair verdict from week ' + p.W + '. This is a general guide, not a claim by the brand.' })),
      h('details', {}, h('summary', { text: 'How do Mystery Streak Drops work?' }), h('p', { text: 'Every daily log adds to your streak. At 3, 7, and 14 days, everyone unlocks Mystery Streak Drops in the Perks tab—no student email required!' })),
      h('details', {}, h('summary', { text: 'Where do I upload Before & After photos?' }), h('p', { text: 'Go to the Progress tab to upload a Day-1 Before photo and Today\'s After photo anytime, or attach one during your weekly Check-in.' }))));

    var fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var parsed = API.validateShape(JSON.parse(fr.result));
          if (!parsed) { toast('Invalid backup file'); return; }
          state = parsed; persist(); renderAll(); switchTab('journey'); toast('Journey restored from backup');
        } catch (err) { toast('Could not read backup file'); }
      };
      fr.readAsText(f);
    } });
    r.append(h('div', { class: 'card' },
      h('h2', { text: 'Data backup & restore' }),
      h('p', { class: 'hint', text: 'Download a copy of your journey data or restore from a previous backup.' }),
      fileIn,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', text: 'Export JSON backup', onclick: function () {
          var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
          var aTag = document.createElement('a');
          aTag.href = URL.createObjectURL(blob);
          aTag.download = 'slow-glow-backup-' + todayISO() + '.json';
          aTag.click();
          toast('Backup downloaded');
        } }),
        h('button', { class: 'btn', type: 'button', text: 'Import backup', onclick: function () { fileIn.click(); } }))));

    if (state.requests.length) {
      r.append(h('div', { class: 'card' }, h('h2', { text: 'Your requests' }),
        h('ul', { class: 'reqs' }, state.requests.map(function (q) { return h('li', { text: q.ref + ' · ' + (labels[q.type] || q.type) + ' · ' + fmt(q.date) }); }))));
    }
    r.append(h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', text: 'Back', onclick: function () { switchTab('journey'); } })));
  }

  // ---------- Support ----------
  function renderHelp() {
    var r = $('#v-help'); r.replaceChildren();
    var labels = { reaction: 'Skin issue', advisor: 'Advisor request', feedback: 'Brand feedback' };
    var PH = {
      reaction: 'What did you notice, and since when? For example: redness and stinging since day 3.',
      advisor: 'What result were you hoping for, and what have you seen so far?',
      feedback: 'What should the brand change or explain better?'
    };
    var DONE = {
      reaction: 'Stop using the product until you have spoken to a pharmacist or doctor. Your report has been logged.',
      advisor: 'Your request and progress summary have been logged for an advisor.',
      feedback: 'Your feedback has been logged for the team.'
    };

    if (helpRef) {
      r.append(h('div', { class: 'card' },
        h('span', { class: 'pill', text: 'Request logged' }),
        h('h2', { text: labels[helpType] }),
        h('p', { text: DONE[helpType] }),
        h('span', { class: 'code', text: helpRef }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', text: 'Back to journey', onclick: function () { helpRef = null; helpText = ''; switchTab('journey'); } }),
          h('button', { class: 'btn', type: 'button', text: 'Send another', onclick: function () { helpRef = null; helpText = ''; renderHelp(); } }))));
    } else {
      var ta = h('textarea', { id: 'helpText', rows: 5, maxlength: 400 });
      ta.value = helpText;
      var safety = h('div', { class: 'status tone-bad' },
        h('h3', { text: 'Get medical help if it is serious' }),
        h('p', { text: 'Swelling, blistering, severe redness or trouble breathing: stop using the product and get medical help now.' }));
      var send = h('button', { class: 'btn primary', type: 'button', disabled: true, text: 'Send request' });
      var sync = function () { send.disabled = helpText.trim().length < 5; };
      var apply = function () { safety.hidden = helpType !== 'reaction'; ta.placeholder = PH[helpType]; };
      ta.addEventListener('input', function (e) { helpText = e.target.value; sync(); });
      var picks = ['reaction', 'advisor', 'feedback'].map(function (k) {
        var text = { reaction: 'I have a skin issue', advisor: 'Talk to an advisor about my results', feedback: 'Share feedback with the brand' }[k];
        return h('label', { class: 'pick', for: 'h-' + k },
          h('input', { type: 'radio', name: 'helptype', id: 'h-' + k, value: k, checked: k === helpType, onchange: function () { helpType = k; apply(); } }),
          h('span', { class: 'pname', text: text }));
      });
      send.addEventListener('click', function () {
        ensurePersonalMode();
        helpRef = 'SG-' + rand4() + '-' + rand4();
        var ticket = { ref: helpRef, type: helpType, details: helpText.trim(), date: todayISO(), attached: helpAttach };
        state.requests.unshift(ticket);
        state.requests = state.requests.slice(0, 10);
        persist();
        API.postSupportTicket(ticket);
        renderHelp(); try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } toast('Request logged');
      });
      r.append(h('div', { class: 'card' },
        h('h2', { text: 'Support' }),
        h('p', { class: 'hint', text: 'Tell us what is going on. Nothing here asks for your name or phone number.' }),
        h('div', { class: 'picks', role: 'radiogroup', 'aria-label': 'What do you need' }, picks),
        safety,
        h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'helpText', text: 'Details' }), ta),
        h('label', { class: 'check', for: 'attach' },
          h('input', { type: 'checkbox', id: 'attach', checked: helpAttach, onchange: function (e) { helpAttach = e.target.checked; } }),
          h('span', { text: 'Attach my progress summary (no name or contact details)' })),
        h('div', { class: 'actions' }, send, h('button', { class: 'btn', type: 'button', text: 'Back', onclick: function () { switchTab(helpFrom); } }))));
      apply(); sync();
    }

    if (state.requests.length) {
      r.append(h('div', { class: 'card' }, h('h2', { text: 'Your requests' }),
        h('ul', { class: 'reqs' }, state.requests.map(function (q) { return h('li', { text: q.ref + ' · ' + (labels[q.type] || q.type) + ' · ' + fmt(q.date) }); }))));
    }
  }

  function productSelect(id, byId, filterText) {
    var q = (filterText || '').trim().toLowerCase();
    var sel = h('select', { id: id }, h('option', { value: '', text: byId ? 'Choose your product' : 'Choose a product' }));
    SG.CATALOG.forEach(function (g) {
      var matching = g.items.filter(function (it) {
        return !q || it[1].toLowerCase().indexOf(q) > -1 || g.cat.toLowerCase().indexOf(q) > -1;
      });
      if (matching.length) {
        sel.append(h('optgroup', { label: g.cat }, matching.map(function (it) {
          return h('option', { value: byId ? it[0] : it[1], text: it[1] });
        })));
      }
    });
    return sel;
  }

  // ---------- Setup (Start Fresh or Add Extra Product + Optional Day-1 Photo) ----------
  function renderSetup() {
    var r = $('#v-setup'); r.replaceChildren();
    var searchIn = h('input', { type: 'search', id: 'pSearch', placeholder: 'Type to filter products (e.g. Biotin, Roll On, SPF)...' });
    var selWrap = h('div');
    var sel = productSelect('pSel', true, '');
    if (!setupAddingExtra && state.mode === 'mine' && PRODUCTS[state.productId] && !PRODUCTS[state.productId].legacy) sel.value = state.productId;
    selWrap.append(sel);

    var info = h('p', { class: 'hint' });
    var sync = function () {
      var p = PRODUCTS[sel.value];
      info.textContent = p ? 'First signs are typical from about week ' + p.e + ', and a fair verdict from week ' + p.W + '.' : 'Pick a product to see a realistic timeline.';
    };
    sel.addEventListener('change', sync);
    sync();

    searchIn.addEventListener('input', function (e) {
      var prevVal = sel.value;
      sel = productSelect('pSel', true, e.target.value);
      if (prevVal && sel.querySelector('option[value="' + prevVal + '"]')) {
        sel.value = prevVal;
      } else if (e.target.value.trim()) {
        var firstOpt = sel.querySelector('optgroup option');
        if (firstOpt) sel.value = firstOpt.value;
      }
      sel.addEventListener('change', sync);
      selWrap.replaceChildren(sel);
      sync();
    });

    var date = h('input', { type: 'date', id: 'startDate', value: todayISO(), max: todayISO(), min: SG.addDays(todayISO(), -365) });
    var remSel = h('select', { id: 'setupRem' },
      h('option', { value: '', text: 'No reminder' }),
      h('option', { value: 'Morning (8:00 AM)', text: '🌅 Morning Routine (8:00 AM)' }),
      h('option', { value: 'Night (9:30 PM)', text: '🌙 Night Routine (9:30 PM)' })
    );

    // Optional Day-1 Baseline Photo right in Setup!
    var setupPhotoUrl = null;
    var setupPrev = h('img', { class: 'preview', alt: 'Day 1 preview', hidden: true });
    var setupFile = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      shrink(f, function (url) {
        if (!url) { toast('Could not read photo'); return; }
        setupPhotoUrl = url; setupPrev.src = url; setupPrev.hidden = false;
        toast('📸 Day-1 photo ready!');
      });
    } });
    var setupDrop = h('div', { class: 'photo-dropzone', onclick: function () { setupFile.click(); } },
      h('span', { class: 'cam-icon', text: '📸' }),
      h('strong', { text: 'Upload Day-1 "Before" Photo (Optional)' }),
      h('span', { class: 'small', text: 'Tap to choose a photo from your device or camera' })
    );

    r.append(h('div', { class: 'card' },
      h('h2', { text: setupAddingExtra ? 'Track another product' : 'Start your journey' }),
      h('p', { class: 'hint', text: 'Pick the product you use and the day you began. Already started? Choose your real start date.' }),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'pSearch', text: '1. Quick search product' }), searchIn),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'pSel', text: '2. Select product' }), selWrap, info),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'startDate', text: '3. Start date' }), date),
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'setupRem', text: '4. Daily routine slot (optional)' }), remSel),
      h('div', { class: 'field' }, h('div', { class: 'flabel', text: '5. Day-1 baseline photo (optional)' }), setupFile, setupDrop, setupPrev),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', text: setupAddingExtra ? 'Add product journey' : 'Start journey', onclick: function () {
          var id = sel.value;
          if (!id || !PRODUCTS[id]) { toast('Choose your product first'); return; }
          var v = date.value || todayISO(); if (v > todayISO()) v = todayISO();
          var initialPhotos = setupPhotoUrl ? [{ id: 'p-' + Date.now(), date: v, url: setupPhotoUrl, label: 'Day 1 Baseline' }] : [];

          if (setupAddingExtra && state.mode === 'mine') {
            saveCurrentIntoJourneys();
            state.productId = id;
            state.start = v;
            state.checkins = [];
            state.logs = [];
            state.photos = initialPhotos;
            state.reminder = remSel.value;
            saveCurrentIntoJourneys();
          } else {
            state = {
              mode: 'mine', productId: id, start: v,
              checkins: [], orders: state.orders || [], studentCheck: state.studentCheck || null,
              claimed: state.claimed || {}, requests: state.requests || [], logs: [],
              photos: initialPhotos, reminder: remSel.value, journeys: []
            };
            saveCurrentIntoJourneys();
          }
          setupAddingExtra = false; armed = false; helpRef = null; helpText = ''; dailyDraft = null; dailyEditing = false; dailyFor = null;
          persist(); renderAll(); switchTab('journey'); toast('✨ Journey started!');
        } }),
        h('button', { class: 'btn', type: 'button', text: 'Back', onclick: function () { setupAddingExtra = false; switchTab('journey'); } }))));
  }

  function renderAll() { renderJourney(); renderCheckin(); renderProgress(); renderPerks(); }

  initTheme();
  renderAll();
  switchTab('journey');
  updateSyncBadge(false);

  API.fetchServerState(function (online, serverState) {
    if (online && serverState) {
      state = serverState;
      if (!Array.isArray(state.photos)) state.photos = [];
      if (!Array.isArray(state.journeys)) state.journeys = [];
      renderAll();
    }
    updateSyncBadge(online);
  });
})();