import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContextInput } from './context.types.js';
import { getStore } from '../../store/index.js';
import { playerService } from '../player/player.service.js';
import { getPlaylistService } from '../music/playlist.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, '..', '..', '..', 'prompts');

export class ContextService {
  assemble(input: ContextInput): string {
    const parts: string[] = [];

    parts.push(this.systemPrompt());
    parts.push(this.buildStateLine());
    parts.push(`用户: ${input.userInput}`);

    return parts.join('\n');
  }

  /** Ultra-compact system prompt — ~100 tokens */
  private systemPrompt(): string {
    const pl = getPlaylistService();
    const a = pl.getAnalysis();
    const top8 = a.topArtists.slice(0, 8).map(x => x.artist).join('、');

    return `你是Claudio，私人DJ。歌单${a.totalSongs}首，常听: ${top8}。
推荐优先歌单，避免重复最近5首，没匹配则搜网易云。
输出JSON: {"say":["文本"],"play":[{"name":"歌名","artist":"歌手"}],"reason":"理由","segue":false,"action":"now或next"}`;
  }

  /** Current playback state + recently played — ~30 tokens */
  private buildStateLine(): string {
    const state = playerService.getState();
    const store = getStore();
    const recent5 = store.getRecentPlays(5).map(p => `${p.song_name} - ${p.artist}`);

    if (!state.current) {
      return recent5.length
        ? `最近放过: ${recent5.join('、')}（避免重复）`
        : '状态: 未播放';
    }

    let line = `正在: ${state.current.name} - ${state.current.artist}`;
    if (recent5.length) line += ` | 最近: ${recent5.join('、')}`;
    return line;
  }
}

export const contextService = new ContextService();