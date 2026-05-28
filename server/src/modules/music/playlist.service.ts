import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.child('playlist');

const PLAYLIST_FILE = path.join(__dirname, '..', '..', '..', '..', 'wyy.json');
const CACHE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'playlist-analysis.json');

interface SongEntry { name: string; artist: string }
interface PlaylistAnalysis {
  totalSongs: number;
  uniqueArtists: number;
  langs: Record<string, number>;
  topArtists: { artist: string; count: number }[];
  songs: SongEntry[];
  analyzedAt: string;
}

let cached: PlaylistAnalysis | null = null;

function analyzePlaylist(songs: SongEntry[]): PlaylistAnalysis {
  const artistCount = new Map<string, number>();
  const langs: Record<string, number> = {};

  for (const s of songs) {
    const artist = s.artist.split('/')[0].split('、')[0].trim();
    artistCount.set(artist, (artistCount.get(artist) || 0) + 1);

    // Simple language detection
    const name = s.name + s.artist;
    if (/[぀-ゟ゠-ヿ]/.test(name)) {
      langs['日文'] = (langs['日文'] || 0) + 1;
    } else if (/[一-鿿]/.test(s.name)) {
      langs['中文'] = (langs['中文'] || 0) + 1;
    } else {
      langs['英文'] = (langs['英文'] || 0) + 1;
    }
  }

  // Check for instrumental/piano
  const instrumentals = songs.filter(s =>
    /纯音乐|伴奏|beat|piano|guitar|口琴|古筝|古风|inst/i.test(s.artist + s.name)
  );
  if (instrumentals.length > 0) langs['纯音乐/器乐'] = instrumentals.length;

  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([artist, count]) => ({ artist, count }));

  return {
    totalSongs: songs.length,
    uniqueArtists: artistCount.size,
    langs,
    topArtists,
    songs,
    analyzedAt: new Date().toISOString(),
  };
}

function loadAndAnalyze(): PlaylistAnalysis {
  // Try cache first
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      // Check if wyy.json has been modified since cache was created
      const playlistStat = fs.statSync(PLAYLIST_FILE);
      const cacheTime = new Date(cached.analyzedAt).getTime();
      if (playlistStat.mtimeMs < cacheTime + 60_000) {
        log.debug('使用缓存的歌单分析');
        return cached;
      }
    } catch { /* regenerate */ }
  }

  // Load and analyze
  const raw = fs.readFileSync(PLAYLIST_FILE, 'utf-8');
  const songs: SongEntry[] = JSON.parse(raw);
  const analysis = analyzePlaylist(songs);

  // Write cache
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(analysis, null, 2), 'utf-8');
  log.info(`歌单分析完成: ${analysis.totalSongs}首, ${analysis.uniqueArtists}位艺人`);

  return analysis;
}

export class PlaylistService {
  private analysis: PlaylistAnalysis;

  constructor() {
    this.analysis = loadAndAnalyze();
  }

  getAnalysis(): PlaylistAnalysis {
    return this.analysis;
  }

  /** Generate a compact summary for Claude's prompt */
  getPromptSummary(): string {
    const a = this.analysis;
    const lines: string[] = [];
    lines.push(`歌单: ${a.totalSongs}首, ${a.uniqueArtists}位艺人`);
    lines.push(`语种: ${Object.entries(a.langs).map(([k, v]) => `${k}${v}首`).join(' / ')}`);
    lines.push(`常听: ${a.topArtists.slice(0, 8).map(x => `${x.artist}(${x.count})`).join('、')}`);
    return lines.join('\n');
  }

  /** Find matching songs in the playlist */
  findInPlaylist(keyword: string): SongEntry[] {
    const kw = keyword.toLowerCase();
    return this.analysis.songs.filter(s =>
      s.name.toLowerCase().includes(kw) ||
      s.artist.toLowerCase().includes(kw)
    );
  }

  /** Get random songs from playlist */
  randomPicks(count: number): SongEntry[] {
    const shuffled = [...this.analysis.songs].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /** Reload from file */
  reload() {
    this.analysis = loadAndAnalyze();
  }
}

// Singleton — reloads on file change
let instance: PlaylistService | null = null;
export function getPlaylistService(): PlaylistService {
  if (!instance) instance = new PlaylistService();
  return instance;
}
