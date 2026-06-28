export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Play {
  song_name: string;
  artist: string;
  source: string;
  action: 'play' | 'skip' | 'pause' | 'complete';
  played_at: string;
}

export interface PlanEntry {
  date: string;
  time_slot: string;
  mood: string | null;
  playlist: string[] | null;
  notes: string | null;
}

export interface PlaylistSong {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  cover?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  songs: PlaylistSong[];
  songCount: number;
  isDefault: boolean;
  createdAt: string;
}

export interface IStore {
  // Messages
  addMessage(role: Message['role'], content: string, metadata?: Record<string, unknown>): Message;
  getRecentMessages(limit?: number): Message[];

  // Plays
  addPlay(songName: string, artist: string, source?: string, action?: Play['action']): Play;
  getRecentPlays(limit?: number): Play[];
  getTodayPlays(): Play[];

  // Plan
  setPlan(date: string, timeSlot: string, mood?: string | null, playlist?: string[] | null, notes?: string | null): PlanEntry;
  getTodayPlan(): PlanEntry[];

  // Playlists
  getPlaylists(): Playlist[];
  getPlaylist(id: string): Playlist | undefined;
  addPlaylist(name: string, description?: string): Playlist;
  deletePlaylist(id: string): boolean;
  addSongsToPlaylist(playlistId: string, songs: PlaylistSong[]): boolean;
  removeSongFromPlaylist(playlistId: string, songId: string): boolean;

  // Preferences
  getPref(key: string): string | null;
  setPref(key: string, value: string): void;
  getAllPrefs(): Record<string, string>;
}
