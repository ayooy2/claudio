import { Router } from 'express';
import { brainService } from '../modules/brain/brain.service.js';
import { contextService } from '../modules/context/context.service.js';
import { musicService } from '../modules/music/music.service.js';
import { getPlaylistService } from '../modules/music/playlist.service.js';
import { weatherService } from '../modules/weather/weather.service.js';
import { calendarService } from '../modules/calendar/calendar.service.js';
import { playerService } from '../modules/player/player.service.js';
import { getStore } from '../store/index.js';
import { ttsService } from '../modules/tts/tts.service.js';
import { logger } from '../common/logger.js';

const log = logger.child('chat');
export const chatRouter = Router();

function proxyUrl(raw: string | null): string | null {
  if (!raw) return null;
  return `/api/audio-proxy?url=${encodeURIComponent(raw)}`;
}

chatRouter.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '缺少 message 字段' } });
  }

  getStore().addMessage('user', message);

  try {
    const [weather, calendar] = await Promise.all([
      weatherService.getCurrent().catch(() => null),
      calendarService.getTodayEvents().catch(() => null),
    ]);

    const env = {
      weather: weather ? weatherService.toString(weather) : '未知',
      calendar: calendar?.events ?? [],
    };

    const prompt = contextService.assemble({ userInput: message, env });

    let result;
    try {
      result = await brainService.ask(prompt);
    } catch (err) {
      log.warn('AI 不可用: ' + (err as Error).message);
      // Fallback: play something random from playlist
      const pl = getPlaylistService();
      const picks = pl.randomPicks(1);
      const playlist = await resolveSongs(picks);

      getStore().addMessage('assistant', '给你随机放了首歌。');
      playerService.setQueue(playlist);

      return res.json({
        type: 'fallback', playlist,
        say: ['给你随机放了首歌。'],
        reason: 'AI 不可用', segue: true,
      });
    }

    if (result.say.length) getStore().addMessage('assistant', result.say.join(' '));

    // Resolve songs: playlist first, then Netease API
    const songs = result.play.length
      ? await resolveSongs(result.play)
      : [];

    for (const s of songs) getStore().addPlay(s.name, s.artist, 'claude');

    if (songs.length) {
      if (result.action === 'next' && playerService.getState().current) {
        playerService.addToQueue(songs);
      } else {
        playerService.setQueue(songs);
      }
    }

    const audioUrls = result.say.length ? await ttsService.speakAll(result.say) : [];

    res.json({ type: 'claude', playlist: songs, say: result.say, audioUrls, reason: result.reason, segue: result.segue, action: result.action });
  } catch (err) {
    log.error('chat 处理失败', { error: (err as Error).message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
  }
});

/** Resolve song names → playable tracks. Playlist first, Netease API fallback */
async function resolveSongs(items: { name: string; artist: string }[]) {
  const pl = getPlaylistService();
  const resolved: { id: string; name: string; artist: string; album: string; duration: number; fee: number; url: string | null; isTrial: boolean; fromPlaylist: boolean }[] = [];

  for (const item of items) {
    // 1. Try match in user's playlist
    const matches = pl.findInPlaylist(`${item.name} ${item.artist}`.trim());
    if (matches.length > 0) {
      // Search Netease for the matched playlist song to get a playable URL
      const neteaseResult = await musicService.search(`${matches[0].name} ${matches[0].artist}`, 1);
      if (neteaseResult.songs.length > 0) {
        const s = neteaseResult.songs[0];
        const { url, isTrial } = await musicService.getSongUrl(s.id);
        resolved.push({ ...s, url: proxyUrl(url), isTrial, fromPlaylist: true });
        continue;
      }
    }

    // 2. Fallback to Netease search
    const neteaseResult = await musicService.search(`${item.name} ${item.artist}`, 1);
    if (neteaseResult.songs.length > 0) {
      const s = neteaseResult.songs[0];
      const { url, isTrial } = await musicService.getSongUrl(s.id);
      resolved.push({ ...s, url: proxyUrl(url), isTrial, fromPlaylist: false });
    }
  }

  return resolved;
}
