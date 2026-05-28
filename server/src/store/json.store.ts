import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IStore, Message, Play, PlanEntry } from './store.interface.js';
import { logger } from '../common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'state.json');

const log = logger.child('store');

interface StoreData {
  messages: Message[];
  plays: Play[];
  plan: PlanEntry[];
  prefs: Record<string, string>;
}

const DEFAULT_PREFS: Record<string, string> = {
  volume: '0.6',
  speech_speed: '1.0',
  dj_style: 'warm',
  default_device: 'local',
  auto_play: 'true',
  preload_next: 'true',
};

export class JsonStore implements IStore {
  private data: StoreData;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.data = { messages: [], plays: [], plan: [], prefs: { ...DEFAULT_PREFS } };

    if (fs.existsSync(DB_FILE)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        this.data = {
          messages: loaded.messages ?? [],
          plays: loaded.plays ?? [],
          plan: loaded.plan ?? [],
          prefs: { ...DEFAULT_PREFS, ...loaded.prefs },
        };
      } catch {
        log.warn('state.json 损坏，使用空数据库');
      }
    }

    // Ensure defaults exist
    for (const [k, v] of Object.entries(DEFAULT_PREFS)) {
      if (!(k in this.data.prefs)) this.data.prefs[k] = v;
    }
  }

  private save() {
    clearTimeout(this.saveTimer!);
    this.saveTimer = setTimeout(() => {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    }, 200);
  }

  addMessage(role: Message['role'], content: string, metadata?: Record<string, unknown>): Message {
    const msg: Message = { role, content, metadata, created_at: new Date().toISOString() };
    this.data.messages.push(msg);
    // Keep only last 1000 messages
    if (this.data.messages.length > 1000) {
      this.data.messages = this.data.messages.slice(-1000);
    }
    this.save();
    return msg;
  }

  getRecentMessages(limit = 20): Message[] {
    return this.data.messages.slice(-limit);
  }

  addPlay(songName: string, artist: string, source = 'claude', action: Play['action'] = 'play'): Play {
    const play: Play = { song_name: songName, artist, source, action, played_at: new Date().toISOString() };
    this.data.plays.push(play);
    if (this.data.plays.length > 10000) {
      this.data.plays = this.data.plays.slice(-10000);
    }
    this.save();
    return play;
  }

  getRecentPlays(limit = 20): Play[] {
    return this.data.plays.slice(-limit).reverse();
  }

  getTodayPlays(): Play[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.plays
      .filter(p => p.played_at.slice(0, 10) === today)
      .reverse();
  }

  setPlan(date: string, timeSlot: string, mood?: string | null, playlist?: string[] | null, notes?: string | null): PlanEntry {
    const idx = this.data.plan.findIndex(p => p.date === date && p.time_slot === timeSlot);
    const entry: PlanEntry = { date, time_slot: timeSlot, mood: mood ?? null, playlist: playlist ?? null, notes: notes ?? null };
    if (idx >= 0) {
      this.data.plan[idx] = entry;
    } else {
      this.data.plan.push(entry);
    }
    this.save();
    return entry;
  }

  getTodayPlan(): PlanEntry[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.plan
      .filter(p => p.date === today)
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot));
  }

  getPref(key: string): string | null {
    return this.data.prefs[key] ?? null;
  }

  setPref(key: string, value: string): void {
    this.data.prefs[key] = value;
    this.save();
  }

  getAllPrefs(): Record<string, string> {
    return { ...this.data.prefs };
  }
}

// Singleton
let instance: JsonStore | null = null;
export function getStore(): JsonStore {
  if (!instance) instance = new JsonStore();
  return instance;
}
