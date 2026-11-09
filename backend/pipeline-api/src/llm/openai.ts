import { PipelineFailure } from '../errors';
import { SYSTEM_PROMPTS } from './prompts';
import type { LlmClient, LlmTask } from './types';

export interface OpenAiConfig {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  fetchImpl?: typeof fetch;
}

/** OpenAI-совместимый клиент (chat completions в JSON-режиме + embeddings). */
export class OpenAiClient implements LlmClient {
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly cfg: OpenAiConfig) {
    this.model = cfg.chatModel;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async complete(task: LlmTask, input: unknown): Promise<unknown> {
    const res = await this.post('/chat/completions', {
      model: this.cfg.chatModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[task] },
        { role: 'user', content: JSON.stringify(input) },
      ],
    });
    const content = res?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new PipelineFailure('INTERNAL', `LLM (${task}): пустой ответ`);
    try {
      return JSON.parse(content);
    } catch {
      throw new PipelineFailure('INTERNAL', `LLM (${task}): ответ не является JSON`);
    }
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.post('/embeddings', { model: this.cfg.embeddingModel, input: text });
    const vector = res?.data?.[0]?.embedding;
    if (!Array.isArray(vector)) throw new PipelineFailure('INTERNAL', 'Embeddings: пустой ответ');
    return vector as number[];
  }

  private async post(path: string, body: unknown): Promise<any> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new PipelineFailure('INTERNAL', `LLM API HTTP ${res.status}`);
    return res.json();
  }
}
