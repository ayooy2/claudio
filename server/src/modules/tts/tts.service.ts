import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';
import { logger } from '../../common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'cache', 'tts');
const log = logger.child('tts');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const TOKEN_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/';
const TTS_URL = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts';

let cachedToken = { token: '', expires: 0 };

async function getToken(): Promise<string> {
  if (Date.now() < cachedToken.expires) return cachedToken.token;

  const RPCClient = (await import('@alicloud/pop-core')).RPCClient;
  const client = new RPCClient({
    accessKeyId: config.aliTts.accessKeyId,
    accessKeySecret: config.aliTts.accessKeySecret,
    endpoint: TOKEN_URL,
    apiVersion: '2019-02-28',
  });

  const result = await client.request('CreateToken', {}, { method: 'POST' }) as any;
  cachedToken = {
    token: result.Token.Id,
    expires: Date.now() + (result.Token.ExpireTime - 60) * 1000,
  };
  log.debug('阿里云 Token 已刷新');
  return cachedToken.token;
}

export class TtsService {
  async speak(text: string): Promise<string> {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const file = path.join(CACHE_DIR, `${hash}.mp3`);
    if (fs.existsSync(file)) return `/tts/${hash}.mp3`;

    if (!config.aliTts.accessKeyId) {
      log.warn('阿里云 TTS 未配置');
      return '';
    }

    try {
      const token = await getToken();
      const params = new URLSearchParams({
        appkey: config.aliTts.appKey,
        token,
        text,
        format: 'mp3',
        sample_rate: '16000',
        voice: 'xiaoyun',
      });

      const res = await fetch(`${TTS_URL}?${params}`, {
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`阿里云 TTS ${res.status}: ${err.slice(0, 200)}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      log.debug(`TTS: ${text.slice(0, 30)}... (${buf.length} bytes)`);
      return `/tts/${hash}.mp3`;
    } catch (err) {
      log.warn(`TTS 失败: ${(err as Error).message}`);
      return '';
    }
  }

  async speakAll(texts: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const t of texts) {
      const url = await this.speak(t);
      if (url) urls.push(url);
    }
    return urls;
  }
}

export const ttsService = new TtsService();
