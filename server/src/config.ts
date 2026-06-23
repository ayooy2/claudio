import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env is at project root (2 levels up from src/)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback = true): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val !== 'false' && val !== '0';
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  port: envInt('PORT', 8080),
  nodeEnv: env('NODE_ENV', 'development'),
  isDev: env('NODE_ENV') !== 'production',

  mock: {
    music: envBool('USE_MOCK_MUSIC', false),
    tts: envBool('USE_MOCK_TTS', false),
    weather: envBool('USE_MOCK_WEATHER', false),
    calendar: envBool('USE_MOCK_CALENDAR', false),
    upnp: envBool('USE_MOCK_UPNP', false),
  },

  netease: {
    apiBase: env('NETEASE_API_BASE', 'http://localhost:3000'),
    cookie: env('NETEASE_COOKIE'),
  },

  fishAudio: {
    apiKey: env('FISH_AUDIO_API_KEY'),
    voiceId: env('FISH_AUDIO_VOICE_ID'),
  },

  aliTts: {
    accessKeyId: env('ALI_ACCESS_KEY_ID'),
    accessKeySecret: env('ALI_ACCESS_KEY_SECRET'),
    appKey: env('ALI_TTS_APP_KEY'),
  },

  openWeather: {
    apiKey: env('OPENWEATHER_API_KEY'),
    city: env('OPENWEATHER_CITY', 'Beijing'),
  },

  feishu: {
    appId: env('FEISHU_APP_ID'),
    appSecret: env('FEISHU_APP_SECRET'),
  },

  upnp: {
    deviceName: env('UPNP_DEVICE_NAME'),
  },

  brain: {
    apiUrl: env('BRAIN_API_URL', 'https://api.deepseek.com/anthropic'),
    apiKey: env('BRAIN_API_KEY'),
    model: env('BRAIN_MODEL', 'deepseek-chat'),
  },
} as const;
