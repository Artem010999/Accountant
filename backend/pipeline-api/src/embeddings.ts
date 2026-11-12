import OpenAI from 'openai';
import { config } from './config';

export const embeddingClient = new OpenAI({
  apiKey: config.embeddingApiKey,
  baseURL: config.embeddingBaseUrl,
});

/**
 * Получение эмбеддинга текста через OpenAI-совместимый API (aitunnel.ru / qwen3-embedding-8b).
 * Всегда использует config.embeddingModel (4096 измерений), игнорируя устаревшие имена моделей.
 */
export async function getEmbedding(text: string, _legacyModel?: string): Promise<number[]> {
  const model = config.embeddingModel;
  const baseUrl = config.embeddingBaseUrl;

  const client =
    embeddingClient.apiKey === config.embeddingApiKey &&
    embeddingClient.baseURL === config.embeddingBaseUrl
      ? embeddingClient
      : new OpenAI({ apiKey: config.embeddingApiKey, baseURL: config.embeddingBaseUrl });

  try {
    const response = await client.embeddings.create({
      model,
      input: text,
    });

    const vector = response.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Embedding response contains empty or invalid embedding vector`);
    }

    if (vector.length !== config.embeddingDimensions) {
      throw new Error(
        `Expected embedding dimensions ${config.embeddingDimensions}, but received ${vector.length}`
      );
    }

    return vector;
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode ?? 'unknown';
    console.error(
      `[embeddings] Error requesting embedding (baseURL: "${baseUrl}", model: "${model}", status: ${status}): ${err?.message ?? err}`
    );
    throw err;
  }
}

export const createEmbedding = getEmbedding;
