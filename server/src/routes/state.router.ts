import { Router } from 'express';
import { playerService } from '../modules/player/player.service.js';
import { getStore } from '../store/index.js';

export const stateRouter = Router();

stateRouter.get('/now', (_req, res) => {
  const state = playerService.getState();
  const prefs = getStore().getAllPrefs();
  res.json({
    current: state.current,
    queueLength: state.queue.length,
    isPlaying: state.isPlaying,
    volume: state.volume,
    autoPlay: prefs.auto_play !== 'false',
    timestamp: new Date().toISOString(),
  });
});

stateRouter.get('/next', (_req, res) => {
  const state = playerService.getState();
  const recent = getStore().getRecentPlays(5);
  const nextIdx = state.queue.length ? (state.index + 1) % state.queue.length : 0;
  res.json({
    history: recent,
    next: state.queue[nextIdx] ?? null,
    queue: state.queue.slice(state.index + 1).slice(0, 5),
  });
});
