(function (g) {
  'use strict';

  var cat = g.SG_CATALOG;
  var LEVELS = cat.LEVELS;
  var PRODUCTS = cat.PRODUCTS;
  var CATALOG = cat.CATALOG;

  var COLLEGE_SUFFIXES = ['.ac.in', '.edu.in', '.edu', '.ac.uk'];
  var MAX_SKIPS = 3;

  function parse(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function fmtDate(s) { return parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function levelName(x) {
    if (x >= 1.5) return 'much better';
    if (x >= 0.5) return 'slightly better';
    if (x > -0.5) return 'about the same';
    if (x > -1.5) return 'slightly worse';
    return 'much worse';
  }

  function verdictFor(p, phase, week, smooth, cons, n, dates) {
    var goal = p.measures[0].label.toLowerCase();
    var low = cons !== null && cons < 0.7;
    var usedTxt = cons === null ? '' : Math.round(cons * 7);
    if (phase === 'settle') {
      var extra = n >= 2 && low ? ' You have missed a few days. Steady use makes the later results easier to read.' : '';
      return { tone: 'wait', tag: 'Too early', title: 'Too early to judge',
        body: 'Most people cannot see a change before week ' + p.e + '. Keep using it and check in weekly. Your first fair look is ' + dates.first + '.' + extra };
    }
    if (n === 0) {
      return { tone: 'neutral', tag: 'Early days', title: 'No check-ins yet',
        body: 'Add a check-in so there is a record to judge from. Compare how things look and feel with day one.' };
    }
    if (phase === 'signs') {
      if (low) return { tone: 'warn', tag: 'Keep an eye', title: 'Use it more regularly',
        body: 'You used it on about ' + usedTxt + ' of 7 days. Gaps slow results and make them harder to read. Aim for most days until ' + dates.verdict + '.' };
      if (smooth >= 0.5) return { tone: 'good', tag: 'Encouraging', title: 'Early signs showing',
        body: 'You rated your ' + goal + ' ' + levelName(smooth) + ' than day one. That fits what is typical around week ' + week + '. Keep going until ' + dates.verdict + ' for a fair verdict.' };
      return { tone: 'neutral', tag: 'Early days', title: 'No clear change yet',
        body: 'That is common at week ' + week + '. Your fair verdict date is ' + dates.verdict + '. Until then, keep checking in weekly.' };
    }
    if (low) return { tone: 'warn', tag: 'Keep an eye', title: 'Hard to judge',
      body: 'You used it on about ' + usedTxt + ' of 7 days, so this result is not reliable yet. Try four weeks of near-daily use, then check in again.' };
    if (smooth >= 1) return { tone: 'good', tag: 'Working', title: 'It is working for you',
      body: 'After ' + week + ' weeks, you rate your ' + goal + ' ' + levelName(smooth) + ' than day one, with regular use.' };
    if (smooth >= 0.5) return { tone: 'good', tag: 'Encouraging', title: 'Slow, steady progress',
      body: 'The change is small but real. Another four weeks of regular use will show whether it keeps going.' };
    if (smooth >= 0) return { tone: 'warn', tag: 'Keep an eye', title: 'Little change so far',
      body: 'After ' + week + ' weeks of regular use, your ' + goal + ' looks about the same. This product may not be the right fit. Consider asking a pharmacist or dermatologist, and tell the brand what you noticed.' };
    return { tone: 'bad', tag: 'Pause', title: 'Not helping right now',
      body: 'Your ' + goal + ' is worse than on day one. Pause the product and ask a pharmacist or doctor before continuing.' };
  }

  function analyse(state, now) {
    var p = PRODUCTS[state.productId];
    var day = Math.max(0, daysBetween(state.start, now));
    var week = Math.floor(day / 7);
    var cks = state.checkins.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var last = cks[cks.length - 1];
    var smooth = cks.length ? mean(cks.slice(-2).map(function (c) { return c.vals[0]; })) : null;
    var recent = cks.slice(-4);
    var cons = recent.length ? mean(recent.map(function (c) { return c.days; })) / 7 : null;
    var phase = day < p.e * 7 ? 'settle' : day < p.W * 7 ? 'signs' : 'verdict';
    var verdictDate = addDays(state.start, p.W * 7);
    var firstLookDate = addDays(state.start, p.e * 7);
    var next = last ? addDays(last.date, 7) : addDays(state.start, 7);
    return {
      p: p, day: day, week: week, cks: cks, last: last, smooth: smooth, cons: cons, phase: phase,
      verdictDate: verdictDate, firstLookDate: firstLookDate, next: next, due: now >= next,
      alert: (!!last && last.vals.some(function (v) { return v <= -2; })) || (state.logs || []).some(function (l) { return l.date === now && l.skin === 'strong'; }),
      verdict: verdictFor(p, phase, week, smooth, cons, cks.length, { first: fmtDate(firstLookDate), verdict: fmtDate(verdictDate) })
    };
  }

  function demoState(now) {
    var rows = [
      [7, [0, 0, 1], 6], [14, [0, 0, 1], 5], [21, [0, 1, 1], 7],
      [28, [0, 1, 1], 6], [35, [1, 1, 1], 4], [42, [1, 0, 1], 6]
    ];
    var start = addDays(now, -45);
    var logs = [];
    for (var i = 1; i <= 37; i++) {
      logs.push({ date: addDays(now, -i), used: i % 13 !== 0, skin: i === 5 ? 'mild' : 'ok', tags: i % 11 === 0 ? ['Sun or travel'] : [], note: '' });
    }
    logs.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
    return {
      mode: 'demo', productId: 'ur6', start: start,
      orders: [
        { h: 'demo1', masked: '\u2022\u2022\u2022\u20224821', date: addDays(now, -150), platform: 'Be Bodywise website', product: 'Underarm roll-on' },
        { h: 'demo2', masked: '\u2022\u2022\u2022\u20227310', date: addDays(now, -95), platform: 'Nykaa', product: 'Body wash' },
        { h: 'demo3', masked: '\u2022\u2022\u2022\u20220962', date: addDays(now, -40), platform: 'Amazon', product: 'Hair growth serum' }
      ],
      studentCheck: null, claimed: {}, requests: [], logs: logs,
      checkins: rows.map(function (r, i) {
        return { id: 'd' + i, date: addDays(start, r[0]), vals: r[1], days: r[2], note: i === 5 ? 'Skin feels a little drier this week, tone looks a bit more even in daylight.' : '' };
      })
    };
  }

  function logList(state) {
    var seen = {};
    (state.logs || []).forEach(function (l) { seen[l.date] = 1; });
    return { seen: seen, list: Object.keys(seen).sort() };
  }

  function streak(state, now) {
    var o = logList(state), list = o.list;
    if (!list.length) return { days: 0, broken: false, loggedToday: false, pendingBackfill: false };
    var last = list[list.length - 1], gap = daysBetween(last, now);
    if (gap > 2) return { days: 0, broken: true, loggedToday: false, pendingBackfill: false };
    var n = 1;
    for (var i = list.length - 1; i > 0; i--) { if (daysBetween(list[i - 1], list[i]) === 1) n++; else break; }
    return { days: n, broken: false, loggedToday: !!o.seen[now], pendingBackfill: gap === 2 };
  }

  function studentRun(state, now) {
    var list = logList(state).list;
    if (!list.length) return { days: 0, skips: 0, left: MAX_SKIPS, broken: false };
    var runStart = list[0], missed = 0, prev = list[0];
    for (var i = 1; i < list.length; i++) {
      var m = daysBetween(prev, list[i]) - 1;
      if (m >= 2) { runStart = list[i]; missed = 0; }
      else if (m === 1) { missed += 1; if (missed > MAX_SKIPS) { runStart = list[i]; missed = 0; } }
      prev = list[i];
    }
    var tail = Math.max(0, daysBetween(prev, now) - 2);
    if (tail >= 2) return { days: 0, skips: MAX_SKIPS, left: 0, broken: true };
    var total = missed + tail;
    if (total > MAX_SKIPS) return { days: 0, skips: MAX_SKIPS, left: 0, broken: true };
    return { days: daysBetween(runStart, prev) + 1, skips: total, left: MAX_SKIPS - total, broken: false };
  }

  function perks(state, now) {
    var st = streak(state, now), run = studentRun(state, now), buy = (state.orders || []).length, verified = !!state.studentCheck;
    return {
      streak: st, run: run, verified: verified,
      g100: { need: 100, done: Math.min(run.days, 100), open: verified && run.days >= 100 },
      buy: { need: 5, done: Math.min(buy, 5), open: buy >= 5 }
    };
  }

  function hashOrder(x) {
    var t = String(x).trim().toUpperCase(), n = 5381;
    for (var i = 0; i < t.length; i++) n = ((n << 5) + n + t.charCodeAt(i)) >>> 0;
    return n.toString(36);
  }

  function validateOrder(inp, now, existing) {
    var errors = [];
    if (!inp.platform) errors.push('Choose where you bought it.');
    if (!inp.product) errors.push('Choose the product.');
    var o = (inp.order || '').trim();
    if (!o) errors.push('The order number is required.');
    else if (!/^[A-Za-z0-9\/-]{6,20}$/.test(o) || (o.match(/\d/g) || []).length < 4) errors.push('Enter the order number exactly as it appears: 6 to 20 letters, numbers, hyphens or slashes, with at least 4 digits.');
    var d = inp.date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push('Choose your order date.');
    else if (d > now) errors.push('The order date cannot be in the future.');
    else if (daysBetween(d, now) > 365) errors.push('The order must be from the last 12 months.');
    if (!errors.length && (existing || []).some(function (x) { return x.h === hashOrder(o); })) errors.push('This order number has already been added.');
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, errors: [], record: { h: hashOrder(o), masked: '••••' + o.slice(-4).toUpperCase(), date: d, platform: inp.platform, product: inp.product } };
  }

  function latestOrder(state) {
    var best = null;
    (state.orders || []).forEach(function (o) { if (!best || o.date >= best.date) best = o; });
    return best;
  }

  function confirmOrder(state, input) {
    var lo = latestOrder(state);
    return !!lo && !!String(input || '').trim() && hashOrder(input) === lo.h;
  }

  function validateStudent(inp, now) {
    var errors = [], domain = '';
    var m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec((inp.email || '').trim());
    if (!m) errors.push('Enter your college email address.');
    else {
      domain = m[1].toLowerCase();
      if (!COLLEGE_SUFFIXES.some(function (x) { return domain.slice(-x.length) === x; })) errors.push('That email does not look like a college address. It should end in .ac.in, .edu.in or .edu.');
    }
    if (!inp.product) errors.push('Choose the product you bought.');
    var o = (inp.order || '').trim();
    if (!/^[A-Za-z0-9-]{6,14}$/.test(o) || (o.match(/\d/g) || []).length < 4) errors.push('Enter your order number: 6 to 14 letters, numbers or hyphens, with at least 4 digits.');
    var d = inp.date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push('Choose your order date.');
    else if (d > now) errors.push('The order date cannot be in the future.');
    else if (daysBetween(d, now) > 365) errors.push('The order must be from the last 12 months.');
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, errors: [], record: { domain: domain, product: inp.product, orderMasked: '••••' + o.slice(-4), orderDate: d, verifiedOn: now } };
  }

  g.SG = {
    LEVELS: LEVELS, PRODUCTS: PRODUCTS, CATALOG: CATALOG,
    parse: parse, iso: iso, addDays: addDays, daysBetween: daysBetween,
    fmtDate: fmtDate, levelName: levelName, analyse: analyse, demoState: demoState,
    perks: perks, streak: streak, studentRun: studentRun, validateOrder: validateOrder,
    latestOrder: latestOrder, confirmOrder: confirmOrder, hashOrder: hashOrder, validateStudent: validateStudent
  };
})(typeof window !== 'undefined' ? window : globalThis);