import { config } from '../../config.js';
import type { BrainResult } from './brain.types.js';
import { logger } from '../../common/logger.js';

const log = logger.child('brain');
const TIMEOUT_MS = 60_000;

export class BrainService {
  async ask(prompt: string): Promise<BrainResult> {
    if (!config.brain.apiKey || config.brain.apiKey === '你的DeepSeek_API_Key') {
      throw new Error('BRAIN_API_KEY 未配置，请在 .env 中设置');
    }

    // Split prompt: everything before "用户输入" is system context,
    // the "用户输入" section is the user message
    const parts = prompt.split('## 用户输入');
    const systemPrompt = parts[0]?.trim() ?? prompt;
    const userInput = parts[1]?.trim() ?? prompt;

    log.debug(`API 调用: ${config.brain.model}`);

    const body = {
      model: config.brain.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userInput }],
    };

    const res = await fetch(`${config.brain.apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.brain.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;

    // Anthropic response format: { content: [{ type: "text", text: "..." }] }
    // Find text content (skip thinking blocks)
    const textContent = data.content?.find((c: any) => c.type === 'text');
    const text = textContent?.text ?? '';
    return this.parse(text);
  }

  private parse(raw: string): BrainResult {
    let jsonStr = raw.trim();

    // Extract from markdown code block
    const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();

    // Find JSON boundaries
    const a = jsonStr.indexOf('{');
    const b = jsonStr.lastIndexOf('}');
    if (a >= 0 && b > a) jsonStr = jsonStr.slice(a, b + 1);

    // Fix model JSON errors: closing value quote + bare known key → insert comma+quote
    // "直接放空。"segue": → "直接放空。","segue":
    jsonStr = jsonStr.replace(/([^{,])"((?:say|play|reason|segue|action))"\s*:/g, '$1","$2":');
    // Trailing comma before }
    jsonStr = jsonStr.replace(/,(\s*})/g, '$1');

    let obj: any;
    try {
      obj = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`无法解析模型输出: ${(e as Error).message}\n输出: ${raw.slice(0, 300)}`);
    }

    return {
      say: Array.isArray(obj.say) ? obj.say : (obj.say ? [obj.say] : []),
      play: (obj.play ?? []).map((item: any) => {
        if (typeof item === 'string') {
          const parts = item.split(' - ');
          return parts.length >= 2
            ? { name: parts.slice(1).join(' - ').trim(), artist: parts[0].trim() }
            : { name: item.trim(), artist: '' };
        }
        return {
          name: (item.name ?? item.song ?? item.title ?? '').trim(),
          artist: (item.artist ?? item.singer ?? '').trim(),
        };
      }),
      reason: obj.reason ?? '',
      segue: Boolean(obj.segue),
      action: obj.action === 'next' ? 'next' : 'now',
    };
  }
}

export const brainService = new BrainService();
