import { PipelineFailure } from '../errors';
import { SYSTEM_PROMPTS } from './prompts';
import type { LlmClient, LlmTask } from './types';
import { callDeepSeek, callKimi, cleanLLMJsonOutput } from '../llm';
import { getEmbedding } from '../embeddings';
import { withSecurityGuardrail } from '../promptGuard';

export interface OpenAiConfig {
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
  fetchImpl?: typeof fetch;
}

/** OpenAI-совместимый клиент с маршрутизацией по 3 независимым каналам. */
export class OpenAiClient implements LlmClient {
  readonly model: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(private readonly cfg: OpenAiConfig = {}) {
    this.model = cfg.chatModel ?? 'deepseek-v4.1-flash';
    this.fetchImpl = cfg.fetchImpl;
  }

  async complete(task: LlmTask, input: unknown): Promise<unknown> {
    if (this.fetchImpl) {
      const res = await this.post('/chat/completions', {
        model: this.cfg.chatModel ?? this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: withSecurityGuardrail(SYSTEM_PROMPTS[task]) },
          { role: 'user', content: JSON.stringify(input) },
        ],
      });
      const content = res?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new PipelineFailure('INTERNAL', `LLM (${task}): пустой ответ`);
      try {
        return JSON.parse(cleanLLMJsonOutput(content));
      } catch {
        throw new PipelineFailure('INTERNAL', `LLM (${task}): ответ не является JSON`);
      }
    }

    const systemPrompt = SYSTEM_PROMPTS[task];
    const userPrompt = typeof input === 'string' ? input : JSON.stringify(input);

    try {
      // Канал 2 (Kimi Code): Шаг 6 (Первичный аудит и точечный ре-аудит)
      if (task === 'validate_answer') {
        return await callKimi({ systemPrompt, userPrompt });
      }

      // Канал 1 (OpenCode Go - DeepSeek): Шаг 5 (сборка блоков), Шаг 8 (тех. подход и аналоги), якорь
      return await callDeepSeek({ systemPrompt, userPrompt });
    } catch (err: any) {
      throw new PipelineFailure('INTERNAL', `LLM (${task}): ${err?.message ?? err}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (this.fetchImpl) {
      const res = await this.post('/embeddings', {
        model: this.cfg.embeddingModel ?? 'qwen3-embedding-8b',
        input: text,
      });
      const vector = res?.data?.[0]?.embedding;
      if (!Array.isArray(vector)) throw new PipelineFailure('INTERNAL', 'Embeddings: пустой ответ');
      return vector as number[];
    }

    try {
      // Канал 3 (AITunnel - qwen3-embedding-8b): генерация эмбеддингов
      return await getEmbedding(text);
    } catch (err: any) {
      throw new PipelineFailure('INTERNAL', `Embeddings: ${err?.message ?? err}`);
    }
  }

  private async post(path: string, body: unknown): Promise<any> {
    if (!this.fetchImpl) throw new Error('fetchImpl not configured');
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new PipelineFailure('INTERNAL', `LLM API HTTP ${res.status}`);
    return res.json();
  }
}
