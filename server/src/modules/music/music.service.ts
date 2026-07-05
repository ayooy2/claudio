import { config } from '../../config.js';
import { logger } from '../../common/logger.js';
import type { SongInfo, SearchResult, UrlResult, ResolvedSong } from './music.types.js';

const log = logger.child('music');

// ====== In-memory cache with TTL + auto cleanup ======
class MemoryCache<T> {
  private store = new Map<string, { data: T; expiry: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // 每 10 分钟清理过期条目，防止内存泄漏
    this.cleanupTimer = setInterval(() => this.evictExpired(), 10 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref(); // 不阻止进程退出
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiry) this.store.delete(key);
    }
  }

  clear() { this.store.clear(); }
}

// ====== Rate limiter (serializes concurrent callers) ======
class RateLimiter {
  private lastCall = 0;
  private mutex = Promise.resolve();

  async wait(minIntervalMs: number) {
    // 排队：同一时间只有一个调用者可以进入
    const prev = this.mutex;
    let release: () => void;
    this.mutex = new Promise<void>(r => { release = r; });
    await prev;

    const elapsed = Date.now() - this.lastCall;
    if (elapsed < minIntervalMs) {
      await new Promise(r => setTimeout(r, minIntervalMs - elapsed));
    }
    this.lastCall = Date.now();
    release!();
  }
}

// ====== Caches ======
const searchCache = new MemoryCache<SongInfo[]>();
const urlCache = new MemoryCache<UrlResult & { isTrial: boolean }>();
const commentCache = new MemoryCache<TopComment>();
const songIdCache = new MemoryCache<string>(); // name+artist → songId

// ====== Rate limiters ======
const searchLimiter = new RateLimiter();
const urlLimiter = new RateLimiter();

// Cache TTLs
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const URL_CACHE_TTL = 10 * 60 * 1000;         // 10 min (CDN签名URL约20分钟过期，留安全余量)
const COMMENT_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
const SONGID_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit intervals (本地netease-api可降低间隔)
const SEARCH_INTERVAL = 300;   // 0.3s between searches
const URL_INTERVAL = 200;      // 0.2s between URL fetches

// ====== Types ======
export interface TopComment {
  content: string;
  nickname: string;
  likedCount: number;
}

// ====== Mock data ======
const MOCK_SONGS: SongInfo[] = [
  { id: '1001', name: '晴天', artist: '周杰伦', album: '叶惠美', duration: 269, fee: 0 },
  { id: '1002', name: '七里香', artist: '周杰伦', album: '七里香', duration: 299, fee: 0 },
  { id: '1003', name: '稻香', artist: '周杰伦', album: '魔杰座', duration: 223, fee: 0 },
  { id: '1004', name: '夜曲', artist: '周杰伦', album: '十一月的萧邦', duration: 226, fee: 0 },
  { id: '1005', name: '一路向北', artist: '周杰伦', album: '头文字D', duration: 260, fee: 0 },
  { id: '2001', name: '修炼爱情', artist: '林俊杰', album: '因你而在', duration: 291, fee: 0 },
  { id: '2002', name: '不为谁而作的歌', artist: '林俊杰', album: '和自己对话', duration: 260, fee: 0 },
  { id: '2003', name: '关键词', artist: '林俊杰', album: '和自己对话', duration: 239, fee: 0 },
  { id: '2004', name: '可惜没如果', artist: '林俊杰', album: '新地球', duration: 290, fee: 0 },
  { id: '3001', name: '好久不见', artist: '陈奕迅', album: '认了吧', duration: 248, fee: 0 },
  { id: '3002', name: '富士山下', artist: '陈奕迅', album: "What's Going On...?", duration: 247, fee: 0 },
  { id: '3003', name: '十年', artist: '陈奕迅', album: '黑白灰', duration: 205, fee: 0 },
  { id: '3004', name: '孤独患者', artist: '陈奕迅', album: '?', duration: 284, fee: 0 },
  { id: '4001', name: '成都', artist: '赵雷', album: '无法长大', duration: 328, fee: 0 },
  { id: '4002', name: '南方姑娘', artist: '赵雷', album: '赵小雷', duration: 322, fee: 0 },
  { id: '4003', name: '理想', artist: '赵雷', album: '吉姆餐厅', duration: 262, fee: 0 },
  { id: '5001', name: '南山南', artist: '马頔', album: '孤岛', duration: 324, fee: 0 },
  { id: '6001', name: '特别的人', artist: '方大同', album: '危险世界', duration: 250, fee: 0 },
  { id: '6002', name: 'Love Song', artist: '方大同', album: '爱爱爱', duration: 236, fee: 0 },
  { id: '7001', name: '突然好想你', artist: '五月天', album: '后青春期的诗', duration: 251, fee: 0 },
  { id: '7002', name: '倔强', artist: '五月天', album: '神的孩子都在跳舞', duration: 256, fee: 0 },
  { id: '8001', name: '理想三旬', artist: '陈鸿宇', album: '浓烟下的诗歌电台', duration: 257, fee: 0 },
  { id: '9001', name: 'Your Hand in Mine', artist: 'Explosions in the Sky', album: 'The Earth Is Not a Cold Dead Place', duration: 496, fee: 0 },
  { id: '9002', name: 'Aruarian Dance', artist: 'Nujabes', album: 'Departure', duration: 256, fee: 0 },
  { id: '9003', name: 'Merry Christmas Mr. Lawrence', artist: '坂本龙一', album: 'Merry Christmas Mr. Lawrence', duration: 277, fee: 0 },
  { id: '9004', name: 'Experience', artist: 'Ludovico Einaudi', album: 'In a Time Lapse', duration: 315, fee: 0 },
];

const MOCK_AUDIO_BASE = 'https://music.163.com/song/media/outer/url?id=';

// Render 免费版冷启动需 30-60 秒，超时设为 45 秒
const API_TIMEOUT = 45_000;

// ====== MusicService ======
export class MusicService {

  /**
   * 带超时和重试的网易云API请求封装
   * 自动检测连接拒绝、超时等常见问题并给出明确日志
   */
  private async neteaseFetch(path: string, params: Record<string, string> = {}, retries = 2): Promise<Response> {
    const url = new URL(path, config.netease.apiBase);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
    if (config.netease.cookie) url.searchParams.set('cookie', config.netease.cookie);

    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(API_TIMEOUT) });
        return res;
      } catch (e: unknown) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // ECONNREFUSED = 网易云API服务未启动
        if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          log.error(`网易云API连接失败 (${config.netease.apiBase})，服务可能未启动。请检查 NETEASE_API_BASE 配置。`);
          throw new Error(`网易云API不可达: ${config.netease.apiBase}，请确认服务已启动`);
        }
        if (msg.includes('TimeoutError') || msg.includes('timeout') || msg.includes('abort')) {
          log.warn(`网易云API请求超时 (attempt ${attempt + 1}/${retries})，可能正在冷启动...`);
          if (attempt < retries - 1) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          throw new Error('网易云API请求超时，服务可能正在冷启动（约需30-60秒），请稍后重试');
        }
        // 其他错误直接抛出
        throw e;
      }
    }
    throw lastErr;
  }
  async search(keyword: string, limit = 10): Promise<SearchResult> {
    if (config.mock.music) {
      const kw = keyword.toLowerCase();
      const songs = MOCK_SONGS.filter(s =>
        s.name.toLowerCase().includes(kw) ||
        s.artist.toLowerCase().includes(kw) ||
        s.album.toLowerCase().includes(kw)
      ).slice(0, limit);
      return { success: true, mock: true, songs };
    }

    // Cache check
    const cacheKey = `search:${keyword}:${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
      log.debug(`搜索命中缓存: ${keyword}`);
      return { success: true, songs: cached };
    }

    // Rate limit
    await searchLimiter.wait(SEARCH_INTERVAL);

    try {
      const res = await this.neteaseFetch('/cloudsearch', {
        keywords: keyword,
        limit: String(Math.max(limit, 20)),
      });
      const data = await res.json() as { result?: { songs?: unknown[] } };
      const allSongs: SongInfo[] = ((data.result?.songs ?? []) as unknown[])
        .map((s: unknown) => {
          const song = s as Record<string, unknown>;
          const artists = (song.artists ?? song.ar) as { name: string }[] | undefined;
          const album = (song.album ?? song.al) as { name?: string; picUrl?: string } | undefined;
          return {
            id: String(song.id),
            name: String(song.name ?? ''),
            artist: artists?.map(a => a.name).join('/') ?? '',
            album: album?.name ?? '',
            duration: Math.floor(((song.duration ?? song.dt ?? 0) as number) / 1000),
            fee: (song.fee as number) ?? 1,
            pop: (song.pop as number) ?? 0,
            cover: album?.picUrl ?? null,
          };
        });
      // Sort by popularity descending, then free songs first (fee=0 before fee=8/VIP)
      const sorted = allSongs.sort((a, b) => {
        if ((b.pop ?? 0) !== (a.pop ?? 0)) return (b.pop ?? 0) - (a.pop ?? 0);
        return a.fee - b.fee; // 可播放的免费歌曲排前面
      });

      // Cache result
      searchCache.set(cacheKey, sorted, SEARCH_CACHE_TTL);

      return { success: true, songs: sorted };
    } catch (err) {
      log.warn('网易云搜索失败:', err);
      return { success: false, songs: [] };
    }
  }

  // Resolve songId from name+artist, with caching
  async resolveSongId(name: string, artist: string): Promise<string | null> {
    const cacheKey = `sid:${name}:${artist}`;
    const cached = songIdCache.get(cacheKey);
    if (cached) return cached;

    const searchRes = await this.search(`${name} ${artist}`.trim(), 5);
    if (searchRes.songs.length > 0) {
      // 优先匹配歌手名，避免热门翻唱覆盖用户指定的版本
      let matched = searchRes.songs[0];
      if (artist) {
        const artistLower = artist.toLowerCase().split('/')[0].trim();
        const exact = searchRes.songs.find(s =>
          s.artist.toLowerCase().split('/')[0].trim() === artistLower
        );
        const partial = searchRes.songs.find(s =>
          s.artist.toLowerCase().includes(artistLower) ||
          artistLower.includes(s.artist.toLowerCase().split('/')[0].trim())
        );
        matched = exact || partial || matched;
      }
      songIdCache.set(cacheKey, matched.id, SONGID_CACHE_TTL);
      return matched.id;
    }
    return null;
  }

  // Pre-warm URL cache for a song (fire-and-forget)
  async warmupUrl(songId: string): Promise<void> {
    if (urlCache.get(songId)) return; // already cached
    await this.getSongUrl(songId);
  }

  async getSongUrl(songId: string, force = false, br?: number): Promise<UrlResult & { isTrial: boolean }> {
    if (config.mock.music) {
      return { success: true, mock: true, url: `${MOCK_AUDIO_BASE}${songId}.mp3`, br: 320000, isTrial: false };
    }

    // Cache key includes bitrate when specified
    const cacheKey = br ? `${songId}:${br}` : songId;

    // Cache check (song URLs expire faster) — skip if force=true
    if (!force) {
      const cached = urlCache.get(cacheKey);
      if (cached) {
        log.debug(`URL 命中缓存: ${cacheKey}`);
        return cached;
      }
    } else {
      log.debug(`URL 强制刷新: ${cacheKey}`);
    }

    // Rate limit
    await urlLimiter.wait(URL_INTERVAL);

    try {
      const res = await this.neteaseFetch('/song/url', {
        id: songId,
        ...(br ? { br: String(br) } : {}),
      });
      const data = await res.json() as { data?: { url?: string | null; br?: number; freeTrialInfo?: unknown }[] };
      const song = data.data?.[0];
      const result: UrlResult & { isTrial: boolean } = {
        success: true,
        url: song?.url ?? null,
        br: song?.br ?? 0,
        isTrial: !!song?.freeTrialInfo,
      };

      // Cache if valid URL
      if (result.url) {
        urlCache.set(cacheKey, result, URL_CACHE_TTL);
      }

      return result;
    } catch (err) {
      log.warn(`getSongUrl 失败 (${songId}):`, err);
      return { success: false, url: null, br: 0, isTrial: false };
    }
  }

  async resolvePlaylist(items: { name: string; artist: string }[]): Promise<ResolvedSong[]> {
    const results: ResolvedSong[] = [];
    for (const item of items) {
      const { songs } = await this.search(`${item.name} ${item.artist}`.trim(), 3);
      if (songs.length > 0) {
        const m = songs[0];
        const { url, isTrial } = await this.getSongUrl(m.id);
        results.push({ ...m, url, isTrial });
      } else {
        results.push({ id: '', name: item.name, artist: item.artist, album: '', duration: 0, fee: 0, url: null, isTrial: false });
      }
    }
    return results;
  }

  async recommend(songId: string): Promise<SearchResult> {
    if (config.mock.music) {
      const others = MOCK_SONGS.filter(s => s.id !== songId);
      const shuffled = others.sort(() => Math.random() - 0.5);
      return { success: true, mock: true, songs: shuffled.slice(0, 5) };
    }

    const cacheKey = `recommend:${songId}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return { success: true, songs: cached };

    await searchLimiter.wait(SEARCH_INTERVAL);

    try {
      const res = await this.neteaseFetch('/recommend/songs', { id: songId });
      const data = await res.json() as { data?: { dailySongs?: unknown[] } };
      const songs: SongInfo[] = ((data.data?.dailySongs ?? []) as unknown[]).map((s: unknown) => {
        const song = s as Record<string, unknown>;
        const artists = song.ar as { name: string }[] | undefined;
        const album = song.al as { name?: string } | undefined;
        return {
          id: String(song.id),
          name: String(song.name ?? ''),
          artist: artists?.map(a => a.name).join('/') ?? '',
          album: album?.name ?? '',
          duration: 0,
          fee: 0,
        };
      });

      searchCache.set(cacheKey, songs, SEARCH_CACHE_TTL);
      return { success: true, songs };
    } catch {
      return this.search('', 5);
    }
  }

  async getTopComment(songId: string): Promise<TopComment | null> {
    if (config.mock.music) return null;

    const cacheKey = `comment:${songId}`;
    const cached = commentCache.get(cacheKey);
    if (cached) return cached;

    await searchLimiter.wait(SEARCH_INTERVAL);

    try {
      const res = await this.neteaseFetch('/comment/music', { id: songId, limit: '1' });
      const data = await res.json() as {
        data?: { hotComments?: unknown[]; comments?: unknown[] };
        hotComments?: unknown[];
        comments?: unknown[];
      };
      const comments = (data.data?.hotComments ?? data.hotComments ?? data.data?.comments ?? data.comments ?? []) as unknown[];
      if (!comments.length) return null;

      const top = comments[0] as Record<string, unknown>;
      const user = top.user as { nickname?: string } | undefined;
      const result: TopComment = {
        content: String(top.content ?? '').replace(/\n/g, ' '),
        nickname: user?.nickname ?? '匿名',
        likedCount: Number(top.likedCount ?? 0),
      };

      commentCache.set(cacheKey, result, COMMENT_CACHE_TTL);
      return result;
    } catch {
      return null;
    }
  }

  // Used when real API fails — don't cache
  private mockSearch(keyword: string, limit: number): SearchResult {
    const kw = keyword.toLowerCase();
    const songs = MOCK_SONGS.filter(s =>
      s.name.toLowerCase().includes(kw) ||
      s.artist.toLowerCase().includes(kw) ||
      s.album.toLowerCase().includes(kw)
    ).slice(0, limit);
    return { success: true, mock: true, songs };
  }
}

export const musicService = new MusicService();
