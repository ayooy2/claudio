import { Router } from 'express';
import { getStore } from '../store/index.js';

export const prefsRouter = Router();

prefsRouter.get('/', (_req, res) => {
  res.json(getStore().getAllPrefs());
});

prefsRouter.put('/', (req, res) => {
  const prefs = req.body;
  if (!prefs || typeof prefs !== 'object') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '需要 JSON body' } });
  }
  const store = getStore();
  for (const [k, v] of Object.entries(prefs)) {
    store.setPref(k, String(v));
  }
  res.json(store.getAllPrefs());
});
