import type { ResolvedSong } from '../music/music.types.js';
import { getStore } from '../../store/index.js';

export interface PlayerState {
  current: ResolvedSong | null;
  queue: ResolvedSong[];
  index: number;
  isPlaying: boolean;
  volume: number;
}

export class PlayerService {
  private state: PlayerState = {
    current: null,
    queue: [],
    index: -1,
    isPlaying: false,
    volume: 0.6,
  };

  getState(): PlayerState {
    return { ...this.state };
  }

  setQueue(songs: ResolvedSong[], startIndex = 0) {
    this.state.queue = songs;
    this.state.index = startIndex;
    if (songs.length > startIndex) {
      this.state.current = songs[startIndex];
      this.state.isPlaying = true;
    }
  }

  addToQueue(songs: ResolvedSong[]) {
    this.state.queue.push(...songs);
    if (!this.state.current && songs.length > 0) {
      this.state.index = this.state.queue.length - songs.length;
      this.state.current = this.state.queue[this.state.index];
      this.state.isPlaying = true;
    }
  }

  next(): ResolvedSong | null {
    if (this.state.queue.length === 0) return null;
    this.state.index = (this.state.index + 1) % this.state.queue.length;
    this.state.current = this.state.queue[this.state.index];
    this.state.isPlaying = true;
    if (this.state.current) {
      getStore().addPlay(this.state.current.name, this.state.current.artist, 'queue');
    }
    return this.state.current;
  }

  prev(): ResolvedSong | null {
    if (this.state.queue.length === 0) return null;
    this.state.index = this.state.index <= 0 ? this.state.queue.length - 1 : this.state.index - 1;
    this.state.current = this.state.queue[this.state.index];
    this.state.isPlaying = true;
    return this.state.current;
  }

  pause() { this.state.isPlaying = false; }
  resume() { this.state.isPlaying = true; }
  togglePlay() { this.state.isPlaying = !this.state.isPlaying; return this.state.isPlaying; }

  setVolume(v: number) {
    this.state.volume = Math.max(0, Math.min(1, v));
    getStore().setPref('volume', String(this.state.volume));
  }
}

export const playerService = new PlayerService();
