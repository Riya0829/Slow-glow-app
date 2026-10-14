const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory and db.json exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ state: null, supportTickets: [] }, null, 2));
}

// Allow up to 10MB payload for base64 check-in photos
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    return { state: null, supportTickets: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET saved journey state
app.get('/api/state', (req, res) => {
  const db = readDB();
  res.json({ ok: true, state: db.state });
});

// POST save/sync journey state
app.post('/api/state', (req, res) => {
  const { state } = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid state payload' });
  }
  const db = readDB();
  db.state = state;
  writeDB(db);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

// DELETE reset journey state
app.delete('/api/state', (req, res) => {
  const db = readDB();
  db.state = null;
  writeDB(db);
  res.json({ ok: true });
});

// POST log a support request to the server
app.post('/api/support', (req, res) => {
  const ticket = req.body;
  if (!ticket || !ticket.ref) {
    return res.status(400).json({ ok: false, error: 'Invalid support ticket' });
  }
  const db = readDB();
  db.supportTickets.unshift({ ...ticket, createdAt: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true, ref: ticket.ref });
});

app.listen(PORT, () => {
  console.log(`✨ Slow Glow Full-Stack Server running at http://localhost:${PORT}`);
});