import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger } from './common/logger.js';
import { requestLogger, errorHandler, notFound } from './common/middleware.js';
import { chatRouter } from './routes/chat.router.js';
import { stateRouter } from './routes/state.router.js';
import { tasteRouter } from './routes/taste.router.js';
import { planRouter } from './routes/plan.router.js';
import { prefsRouter } from './routes/prefs.router.js';
import { schedulerService } from './modules/scheduler/scheduler.service.js';
import { playerService } from './modules/player/player.service.js';
import { getStore } from './store/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    path: '/ws',
  });

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Audio proxy — forwards Netease CDN audio with proper Referer
  app.get('/api/audio-proxy', async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) return res.status(400).json({ error: 'Missing url param' });

    try {
      const audioRes = await fetch(audioUrl, {
        headers: {
          'Referer': 'https://music.163.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!audioRes.ok) {
        return res.status(audioRes.status).json({ error: `Upstream error: ${audioRes.status}` });
      }

      const contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Stream the audio via pipe
      const reader = audioRes.body?.getReader();
      if (!reader) return res.status(500).json({ error: 'No body' });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err) {
      res.status(502).json({ error: 'Audio proxy error' });
    }
  });

  // Static files
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // TTS cache
  app.use('/tts', express.static(path.join(__dirname, '..', 'cache', 'tts')));

  // API routes
  app.use('/api/chat', chatRouter);
  app.use('/api', stateRouter);
  app.use('/api/taste', tasteRouter);
  app.use('/api/plan', planRouter);
  app.use('/api/prefs', prefsRouter);

  // SPA fallback (after API routes)
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  // Socket.IO
  io.on('connection', (socket) => {
    logger.info(`客户端连接 (${io.engine.clientsCount} 在线)`);

    // Send initial state
    const state = playerService.getState();
    socket.emit('init', {
      current: state.current,
      prefs: getStore().getAllPrefs(),
    });

    socket.on('player_action', (msg) => {
      switch (msg.action) {
        case 'next': playerService.next(); break;
        case 'prev': playerService.prev(); break;
        case 'toggle': playerService.togglePlay(); break;
        case 'pause': playerService.pause(); break;
        case 'resume': playerService.resume(); break;
        case 'volume': playerService.setVolume(Number(msg.value) / 100); break;
      }
      // Broadcast updated state to all clients
      io.emit('state_update', playerService.getState());
    });

    socket.on('disconnect', () => {
      logger.info(`客户端断开 (${io.engine.clientsCount} 在线)`);
    });
  });

  // Broadcast helper
  function broadcast(data: Record<string, unknown>) {
    io.emit('server_event', data);
  }

  // Start scheduler
  schedulerService.start(broadcast);

  return { app, server, io };
}
