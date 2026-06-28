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

// Module-level cache for wyy.json
let wyyCache: { mtime: number; songs: any[] } | null = null;
const wyyPath = path.join(__dirname, '..', '..', 'wyy.json');

async function readWyyJson(): Promise<any[]> {
  try {
    const stat = await fs.promises.stat(wyyPath);
    const mtime = stat.mtimeMs;
    if (wyyCache && wyyCache.mtime === mtime) {
      return wyyCache.songs;
    }
    const raw = await fs.promises.readFile(wyyPath, 'utf-8');
    const songs = JSON.parse(raw);
    wyyCache = { mtime, songs };
    return songs;
  } catch {
    return [];
  }
}

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const io = new SocketIOServer(server, { cors: { origin: allowedOrigins }, path: '/ws' });

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.use(requestLogger);

  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use('/tts', express.static(path.join(__dirname, '..', 'cache', 'tts')));

  // ===== Music API =====

  // Get playlist from wyy.json (async with mtime cache)
  app.get('/api/playlist', async (_req, res) => {
    try {
      const songs = await readWyyJson();
      res.json({ songs, total: songs.length });
    } catch { res.json({ songs: [], total: 0 }); }
  });

  // Get playlist songs (basic info only, no URL resolution)
  app.get('/api/playlist-resolved', async (_req, res) => {
    try {
      const raw = await readWyyJson();
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
    if (!keyword) return res.status(400).json({ error: '缺少搜索关键词' });
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
    if (!name) return res.status(400).json({ error: '缺少歌曲名称' });
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
    const { id, name, artist, force, br } = req.query as { id?: string; name?: string; artist?: string; force?: string; br?: string };
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
      if (!songId) return res.json({ url: null, error: '未找到歌曲' });

      const bitrate = br ? parseInt(br, 10) : undefined;
      const { url, isTrial, br: actualBr } = await musicService.getSongUrl(songId, force === 'true', bitrate);
      const proxyUrl = url ? `/api/audio-proxy?url=${encodeURIComponent(url)}` : null;
      res.json({ url: proxyUrl, isTrial, id: songId, cover, br: actualBr });
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
    if (!id) return res.status(400).json({ error: '缺少歌曲ID' });
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
    if (!audioUrl) return res.status(400).json({ error: '缺少URL参数' });
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
        return res.status(403).json({ error: '域名不在白名单' });
      }
    } catch {
      return res.status(400).json({ error: '无效的URL' });
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
        return res.status(audioRes.status).json({ error: `上游返回: ${audioRes.status}` });
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
      if (!reader) return res.status(502).json({ error: '上游无响应体' });

      const firstChunk = await reader.read();
      if (firstChunk.done || !firstChunk.value || firstChunk.value.length < 12) {
        return res.status(502).json({ error: '上游响应过小或为空' });
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
        return res.status(502).json({ error: '上游返回非音频数据' });
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
        res.status(502).json({ error: '音频代理错误' });
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

  // ===== Admin API =====
  const store = getStore();

  // Recent plays
  app.get('/api/plays/recent', (_req, res) => {
    const limit = Number(_req.query.limit) || 20;
    res.json(store.getRecentPlays(limit));
  });

  // Playlists CRUD
  app.get('/api/playlists', (_req, res) => {
    res.json(store.getPlaylists());
  });

  app.post('/api/playlists', (req, res) => {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) return res.status(400).json({ error: '歌单名称不能为空' });
    const playlist = store.addPlaylist(name.trim(), description?.trim());
    res.json(playlist);
  });

  app.delete('/api/playlists/:id', (req, res) => {
    const ok = store.deletePlaylist(req.params.id);
    res.json({ ok });
  });

  // Get songs in a playlist
  app.get('/api/playlists/:id/songs', (req, res) => {
    const playlist = store.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: '歌单不存在' });
    res.json({ songs: playlist.songs, total: playlist.songs.length });
  });

  // Add songs to a playlist
  app.post('/api/playlists/:id/songs', (req, res) => {
    const { songs } = req.body as { songs?: { id: string; name: string; artist: string; album?: string; duration?: number; fee?: number; cover?: string }[] };
    if (!songs?.length) return res.status(400).json({ error: '歌曲列表不能为空' });
    const playlistSongs = songs.map(s => ({
      id: s.id,
      name: s.name,
      artist: s.artist,
      album: s.album || '',
      duration: s.duration || 0,
      fee: s.fee || 0,
      cover: s.cover || null,
    }));
    const ok = store.addSongsToPlaylist(req.params.id, playlistSongs);
    if (!ok) return res.status(404).json({ error: '歌单不存在' });
    res.json({ ok: true, added: playlistSongs.length });
  });

  // Remove a song from a playlist
  app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
    const ok = store.removeSongFromPlaylist(req.params.id, req.params.songId);
    res.json({ ok });
  });

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
