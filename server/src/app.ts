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
import { stateRouter } from './routes/state.router.js';
import { prefsRouter } from './routes/prefs.router.js';
import { chatRouter } from './routes/chat.router.js';
import { tasteRouter } from './routes/taste.router.js';
import { planRouter } from './routes/plan.router.js';
import { schedulerService } from './modules/scheduler/scheduler.service.js';
import { playerService } from './modules/player/player.service.js';
import { musicService } from './modules/music/music.service.js';
import { getStore } from './store/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' }, path: '/ws' });

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use('/tts', express.static(path.join(__dirname, '..', 'cache', 'tts')));

  // ===== Music API =====

  // Get playlist from wyy.json
  app.get('/api/playlist', (_req, res) => {
    const wyyPath = path.join(__dirname, '..', '..', 'wyy.json');
    try {
      if (fs.existsSync(wyyPath)) {
        const songs = JSON.parse(fs.readFileSync(wyyPath, 'utf-8'));
        res.json({ songs, total: songs.length });
      } else {
        res.json({ songs: [], total: 0 });
      }
    } catch { res.json({ songs: [], total: 0 }); }
  });

  // Get playlist songs (basic info only, no URL resolution)
  app.get('/api/playlist-resolved', async (_req, res) => {
    const wyyPath = path.join(__dirname, '..', '..', 'wyy.json');
    try {
      const raw = JSON.parse(fs.readFileSync(wyyPath, 'utf-8'));
      // Return songs with basic info — URLs resolved on demand via /api/song-url
      const songs = raw.map((s: any, i: number) => ({
        id: `pl_${i}_${s.name}`,
        name: s.name,
        artist: s.artist || '',
        album: s.album || '',
        duration: s.duration || 0,
        fee: s.fee ?? 0,
        cover: s.cover || null,
        url: null, // will be resolved on play
      }));
      res.json({ songs, total: songs.length });
    } catch (err) {
      res.json({ songs: [], error: String(err) });
    }
  });

  // Resolve more songs on demand
  app.post('/api/resolve-batch', async (req, res) => {
    const { songs } = req.body;
    if (!songs?.length) return res.json({ songs: [] });

    const resolved: any[] = [];
    for (const s of songs.slice(0, 5)) {
      try {
        const searchRes = await musicService.search(`${s.name} ${s.artist}`.trim(), 1);
        if (searchRes.songs.length > 0) {
          const song = searchRes.songs[0];
          const { url, isTrial } = await musicService.getSongUrl(song.id);
          resolved.push({ ...song, url: url ? `/api/audio-proxy?url=${encodeURIComponent(url)}` : null, isTrial });
        }
      } catch { /* skip */ }
    }
    res.json({ songs: resolved });
  });

  // Search songs from Netease API
  app.post('/api/search', async (req, res) => {
    const { keyword, limit = 20 } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Missing keyword' });
    try {
      const result = await musicService.search(keyword, limit);
      res.json(result);
    } catch (err) {
      res.json({ songs: [], error: String(err) });
    }
  });

  // Search for a song and get its URL
  app.post('/api/resolve-song', async (req, res) => {
    const { name, artist } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    try {
      const searchRes = await musicService.search(`${name} ${artist || ''}`.trim(), 3);
      if (searchRes.songs.length > 0) {
        const s = searchRes.songs[0];
        const { url, isTrial } = await musicService.getSongUrl(s.id);
        const proxyUrl = url ? `/api/audio-proxy?url=${encodeURIComponent(url)}` : null;
        res.json({ song: { ...s, url: proxyUrl, isTrial } });
      } else {
        res.json({ song: null });
      }
    } catch (err) {
      res.json({ song: null, error: String(err) });
    }
  });

  // Get song URL by ID or by name+artist (with caching)
  app.get('/api/song-url', async (req, res) => {
    const { id, name, artist, force } = req.query as { id?: string; name?: string; artist?: string; force?: string };
    try {
      let songId = id;
      let cover: string | null = null;
      // If no ID but have name, resolve from cache or search
      if (!songId && name) {
        // Search to get both songId and cover
        const searchRes = await musicService.search(`${name} ${artist || ''}`.trim(), 1);
        if (searchRes.songs.length > 0) {
          songId = searchRes.songs[0].id;
          cover = searchRes.songs[0].cover ?? null;
        }
      }
      if (!songId) return res.json({ url: null, error: 'No song found' });

      const { url, isTrial } = await musicService.getSongUrl(songId, force === 'true');
      const proxyUrl = url ? `/api/audio-proxy?url=${encodeURIComponent(url)}` : null;
      res.json({ url: proxyUrl, isTrial, id: songId, cover });
    } catch (err) {
      res.json({ url: null, error: String(err) });
    }
  });

  // Pre-warm URL cache for multiple songs
  app.post('/api/warmup', async (req, res) => {
    const { songs } = req.body as { songs?: { name: string; artist: string }[] };
    if (!songs?.length) return res.json({ ok: true, count: 0 });
    // Fire and forget - warmup in background
    let count = 0;
    for (const s of songs.slice(0, 10)) {
      try {
        const songId = await musicService.resolveSongId(s.name, s.artist);
        if (songId) { await musicService.warmupUrl(songId); count++; }
      } catch { /* skip */ }
    }
    res.json({ ok: true, count });
  });

  // Get top comment for a song
  app.get('/api/comment', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const comment = await musicService.getTopComment(String(id));
      res.json({ comment });
    } catch (err) {
      res.json({ comment: null, error: String(err) });
    }
  });

  // Get lyrics
  app.get('/api/lyrics', async (req, res) => {
    const { id, name, artist } = req.query as { id?: string; name?: string; artist?: string };
    try {
      let songId = id;
      if (!songId && name) {
        songId = await musicService.resolveSongId(String(name), String(artist || '')) ?? undefined;
      }
      if (!songId) return res.json({ lyrics: [] });

      const lyricUrl = new URL('/lyric', config.netease.apiBase);
      lyricUrl.searchParams.set('id', songId);
      if (config.netease.cookie) lyricUrl.searchParams.set('cookie', config.netease.cookie);
      const lyricRes = await fetch(lyricUrl.toString(), { signal: AbortSignal.timeout(10_000) });
      const lyricData = await lyricRes.json() as any;
      const rawLyric = lyricData.lrc?.lyric || '';
      if (!rawLyric) return res.json({ lyrics: [] });

      // 解析LRC格式，返回结构化数据
      const lrcLines: Array<{ time: number; text: string }> = [];
      const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
      let match;
      while ((match = regex.exec(rawLyric)) !== null) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = minutes * 60 + seconds + ms / 1000;
        const text = match[4].trim();
        if (text) lrcLines.push({ time, text });
      }
      lrcLines.sort((a, b) => a.time - b.time);

      res.json({ lyrics: lrcLines, raw: rawLyric });
    } catch (err) {
      res.json({ lyrics: [], error: String(err) });
    }
  });

  // Audio proxy (with SSRF protection + Range support)
  app.get('/api/audio-proxy', async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) return res.status(400).json({ error: 'Missing url param' });
    // SSRF protection: only allow specific domains
    try {
      const parsed = new URL(audioUrl);
      const isAllowedHost = (hostname: string): boolean => {
        const allowedDomains = [
          'music.163.com',
          'music.126.net',
        ];
        return allowedDomains.some(
          d => hostname === d || hostname.endsWith('.' + d)
        );
      };
      if (!isAllowedHost(parsed.hostname)) {
        return res.status(403).json({ error: 'Domain not allowed' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    try {
      // 构建上游请求头，透传 Range
      const upstreamHeaders: Record<string, string> = {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };
      const rangeHeader = req.headers.range;
      if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

      const audioRes = await fetch(audioUrl, {
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(15_000),
      });
      // 上游可能返回 206 或 200
      if (!audioRes.ok && audioRes.status !== 206) {
        return res.status(audioRes.status).json({ error: `Upstream: ${audioRes.status}` });
      }

      // 修正 Content-Type：音频文件不应带 charset，且确保是浏览器支持的格式
      let contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg';
      contentType = contentType.replace(/;\s*charset=[^;]*/i, '');
      // 拦截非音频 Content-Type（错误页面、JSON 错误等）
      if (['application/json', 'text/html', 'text/plain'].some(t => contentType.startsWith(t))) {
        const ext = audioUrl.split('?')[0].split('.').pop()?.toLowerCase();
        const extMap: Record<string, string> = { mp3: 'audio/mpeg', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav' };
        contentType = extMap[ext || ''] || 'audio/mpeg';
      }
      // 如果上游返回 generic octet-stream，从 URL 推断类型
      if (contentType === 'application/octet-stream') {
        const ext = audioUrl.split('?')[0].split('.').pop()?.toLowerCase();
        const extMap: Record<string, string> = { mp3: 'audio/mpeg', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav' };
        contentType = extMap[ext || ''] || 'audio/mpeg';
      }

      // 缓冲第一个 chunk 做 magic byte 验证，通过后再写响应头
      const reader = audioRes.body?.getReader();
      if (!reader) return res.status(502).json({ error: 'No response body' });

      const firstChunk = await reader.read();
      if (firstChunk.done || !firstChunk.value || firstChunk.value.length < 12) {
        return res.status(502).json({ error: 'Empty or too small response from upstream' });
      }

      const magic = Buffer.from(firstChunk.value.slice(0, 12));
      const isAudio =
        (magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0) || // MP3 sync word
        magic.toString('ascii', 0, 3) === 'ID3' ||            // MP3 ID3 tag
        magic.toString('ascii', 0, 4) === 'fLaC' ||           // FLAC
        magic.toString('ascii', 0, 4) === 'OggS' ||           // OGG
        magic.toString('ascii', 4, 8) === 'ftyp' ||           // M4A/AAC
        magic.toString('ascii', 0, 4) === 'RIFF';             // WAV
      if (!isAudio) {
        logger.warn('音频代理：上游返回非音频数据，前12字节:', magic.toString('hex'));
        return res.status(502).json({ error: 'Upstream returned non-audio data' });
      }

      // 验证通过，设置响应头
      const isRangeResponse = audioRes.status === 206;
      res.status(isRangeResponse ? 206 : 200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      // 透传上游 Content-Length 和 Content-Range
      const contentLen = audioRes.headers.get('content-length');
      if (contentLen) res.setHeader('Content-Length', contentLen);
      const contentRange = audioRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      // 写第一个 chunk 并继续流式传输
      res.write(Buffer.from(firstChunk.value));
      let bytesWritten = firstChunk.value.length;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.destroyed) break; // 客户端断开连接
        res.write(Buffer.from(value));
        bytesWritten += value.length;
      }
      if (!isRangeResponse && bytesWritten < 1024) {
        logger.warn(`音频代理：响应体过小 (${bytesWritten} bytes)，可能无效`);
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Audio proxy error' });
      } else {
        // 响应头已发送，只能结束响应
        logger.error('音频代理：流式传输中断', err);
        res.end();
      }
    }
  });

  // ===== State & Prefs =====
  app.use('/api', stateRouter);
  app.use('/api/prefs', prefsRouter);
  app.use('/api', chatRouter);
  app.use('/api', tasteRouter);
  app.use('/api', planRouter);

  // ===== SPA fallback =====
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else next();
  });

  app.use(notFound);
  app.use(errorHandler);

  // ===== Socket.IO =====
  io.on('connection', (socket) => {
    logger.info(`客户端连接 (${io.engine.clientsCount} 在线)`);
    const state = playerService.getState();
    socket.emit('init', { current: state.current, prefs: getStore().getAllPrefs() });
    socket.on('player_action', (msg) => {
      switch (msg.action) {
        case 'next': playerService.next(); break;
        case 'prev': playerService.prev(); break;
        case 'toggle': playerService.togglePlay(); break;
        case 'pause': playerService.pause(); break;
        case 'resume': playerService.resume(); break;
        case 'volume': playerService.setVolume(Number(msg.value) / 100); break;
      }
      io.emit('state_update', playerService.getState());
    });
    socket.on('disconnect', () => { logger.info(`客户端断开 (${io.engine.clientsCount} 在线)`); });
  });

  function broadcast(data: Record<string, unknown>) { io.emit('server_event', data); }
  schedulerService.start(broadcast);

  return { app, server, io };
}
