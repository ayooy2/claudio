import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DIR = path.join(__dirname, '..', '..', '..', 'user');

export const tasteRouter = Router();

tasteRouter.get('/', (_req, res) => {
  const data: Record<string, unknown> = {};
  const files = ['taste.md', 'routines.md', 'mood-rules.md'];
  for (const f of files) {
    const fp = path.join(USER_DIR, f);
    if (fs.existsSync(fp)) {
      data[f.replace('.md', '')] = fs.readFileSync(fp, 'utf-8');
    }
  }
  const plPath = path.join(USER_DIR, 'playlists.json');
  if (fs.existsSync(plPath)) {
    data.playlists = JSON.parse(fs.readFileSync(plPath, 'utf-8'));
  }
  res.json(data);
});
