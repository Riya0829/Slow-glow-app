(function (g) {
  'use strict';

  var KEY = 'slowglow.v1';
  var THEME_KEY = 'slowglow.theme';
  var PRODUCTS = g.SG.PRODUCTS;

  function validateShape(s) {
    if (!s || !PRODUCTS[s.productId] || typeof s.start !== 'string' || !Array.isArray(s.checkins)) return null;
    var validCheckins = s.checkins.every(function (c) {
      return c && typeof c.date === 'string' && Array.isArray(c.vals) && c.vals.length === 3 && typeof c.days === 'number';
    });
    if (!validCheckins) return null;

    s.mode = 'mine';
    s.requests = Array.isArray(s.requests) ? s.requests : [];
    s.orders = Array.isArray(s.orders) ? s.orders.filter(function (o) { return o && typeof o.h === 'string' && typeof o.date === 'string'; }) : [];
    s.logs = Array.isArray(s.logs) ? s.logs.filter(function (l) { return l && typeof l.date === 'string' && typeof l.used === 'boolean' && l.skin && Array.isArray(l.tags); }) : [];
    s.photos = Array.isArray(s.photos) ? s.photos.filter(function (p) { return p && typeof p.url === 'string' && typeof p.date === 'string'; }) : [];
    s.journeys = Array.isArray(s.journeys) ? s.journeys : [];
    s.reminder = typeof s.reminder === 'string' ? s.reminder : '';
    s.studentCheck = s.studentCheck && typeof s.studentCheck === 'object' ? s.studentCheck : null;
    s.claimed = s.claimed && typeof s.claimed === 'object' ? s.claimed : {};
    return s;
  }

  function loadLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      return validateShape(raw);
    } catch (e) {
      return null;
    }
  }

  function saveLocal(state) {
    if (state.mode !== 'mine') return true;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearLocal() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function fetchServerState(cb) {
    fetch('/api/state')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          var valid = validateShape(data.state);
          if (valid) saveLocal(valid);
          cb(true, valid);
        } else {
          cb(false, null);
        }
      })
      .catch(function () { cb(false, null); });
  }

  function pushServerState(state, cb) {
    var localOk = saveLocal(state);
    if (state.mode !== 'mine') {
      if (cb) cb(localOk, false);
      return localOk;
    }
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: state })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (cb) cb(localOk, !!(d && d.ok)); })
      .catch(function () { if (cb) cb(localOk, false); });
    return localOk;
  }

  function deleteServerState(cb) {
    clearLocal();
    fetch('/api/state', { method: 'DELETE' })
      .then(function () { if (cb) cb(true); })
      .catch(function () { if (cb) cb(false); });
  }

  function postSupportTicket(ticket) {
    fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket)
    }).catch(function () { /* offline fallback */ });
  }

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  g.SG_API = {
    validateShape: validateShape,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    clearLocal: clearLocal,
    fetchServerState: fetchServerState,
    pushServerState: pushServerState,
    deleteServerState: deleteServerState,
    postSupportTicket: postSupportTicket,
    getTheme: getTheme,
    setTheme: setTheme
  };
})(typeof window !== 'undefined' ? window : globalThis);