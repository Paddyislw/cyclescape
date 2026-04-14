import express from 'express';
import cors from 'cors';
import path from 'path';
import { query, initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} +${Date.now() - start}ms`);
  });
  next();
});

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── GET /api/scores ───────────────────────────────────────
app.get('/api/scores', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, time_ms, created_at FROM scores ORDER BY time_ms ASC LIMIT 50'
    );
    const data = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      timeMs: row.time_ms,
      date: new Date(row.created_at).toLocaleDateString(),
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[GET /api/scores]', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch scores' },
    });
  }
});

// ── POST /api/scores ──────────────────────────────────────
app.post('/api/scores', async (req, res) => {
  const { username, timeMs } = req.body || {};

  // Validate
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'username must be a non-empty string' },
    });
  }
  if (typeof timeMs !== 'number' || !Number.isInteger(timeMs) || timeMs <= 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'timeMs must be a positive integer' },
    });
  }

  try {
    const result = await query(
      'INSERT INTO scores (username, time_ms) VALUES ($1, $2) RETURNING id, username, time_ms, created_at',
      [username.trim(), timeMs]
    );
    const row = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        username: row.username,
        timeMs: row.time_ms,
        date: new Date(row.created_at).toLocaleDateString(),
      },
    });
  } catch (err) {
    console.error('[POST /api/scores]', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to save score' },
    });
  }
});

// ── STATIC FRONTEND ───────────────────────────────────────
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ── START ─────────────────────────────────────────────────
async function start() {
  try {
    await initDb();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] Cycle Runner API running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[server] SIGTERM received, shutting down...');
      server.close(() => {
        console.log('[server] Closed');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('[server] Startup failed:', err);
    process.exit(1);
  }
}

start();
