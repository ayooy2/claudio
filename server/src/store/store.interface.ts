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

  // Preferences
  getPref(key: string): string | null;
  setPref(key: string, value: string): void;
  getAllPrefs(): Record<string, string>;
}
