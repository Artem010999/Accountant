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

/**
 * Пакетная генерация эмбеддингов через OpenAI-совместимый API (aitunnel.ru / qwen3-embedding-8b).
 * Разбивает массив текстов на пачки по batchSize (по умолчанию 20) и запрашивает векторы 4096 измерений.
 * При ошибках сети или рейт-лимитах выполняет до 3 повторов с паузой 1000ms * attempt.
 */
export async function getEmbeddingsBatch(texts: string[], batchSize = 20): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = config.embeddingModel;
  const baseUrl = config.embeddingBaseUrl;

  const client =
    embeddingClient.apiKey === config.embeddingApiKey &&
    embeddingClient.baseURL === config.embeddingBaseUrl
      ? embeddingClient
      : new OpenAI({ apiKey: config.embeddingApiKey, baseURL: config.embeddingBaseUrl });

  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const response = await client.embeddings.create({
          model,
          input: batch,
        });

        const data = response.data || [];
        const sorted = data.sort((a, b) => a.index - b.index);
        const vectors = sorted.map((d) => d.embedding);

        if (vectors.length !== batch.length) {
          throw new Error(
            `Expected ${batch.length} embeddings in batch, received ${vectors.length}`
          );
        }

        for (let j = 0; j < vectors.length; j++) {
          if (!Array.isArray(vectors[j]) || vectors[j].length !== config.embeddingDimensions) {
            throw new Error(
              `Vector ${j} in batch has invalid dimensions: expected ${config.embeddingDimensions}, got ${vectors[j]?.length}`
            );
          }
        }

        allVectors.push(...vectors);
        break;
      } catch (err: any) {
        attempt++;
        if (attempt >= maxAttempts) {
          console.error(
            `[embeddings] getEmbeddingsBatch failed after ${attempt} attempts (batch ${i}..${i + batch.length}): ${err?.message ?? err}`
          );
          throw err;
        }
        console.warn(
          `[embeddings] Error in getEmbeddingsBatch attempt ${attempt}/${maxAttempts} (baseURL: "${baseUrl}", model: "${model}"): ${err?.message ?? err}. Retrying in ${1000 * attempt}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return allVectors;
}

