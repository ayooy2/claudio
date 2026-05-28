export interface SongInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;        // 0=free, 1=VIP, 8=restricted
  pop?: number;       // popularity (0-100), from cloudsearch
}

export interface ResolvedSong extends SongInfo {
  url: string | null;
  isTrial: boolean;   // true if only 30s preview
}

export interface SearchResult {
  success: boolean;
  mock?: boolean;
  songs: SongInfo[];
}

export interface UrlResult {
  success: boolean;
  mock?: boolean;
  url: string | null;
  br: number;
}
