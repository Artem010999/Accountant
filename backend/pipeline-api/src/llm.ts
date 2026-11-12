import OpenAI from 'openai';
import { config } from './config';
import { withSecurityGuardrail } from './promptGuard';

export interface LLMCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  jsonMode?: boolean;
  thinking?: boolean;
  maxTokens?: number;
}

/** Канал 1: OpenCode Go (DeepSeek) */
export const deepseekClient = new OpenAI({
  baseURL: config.deepseekBaseUrl,
  apiKey: config.deepseekApiKey,
  defaultHeaders: {
    'User-Agent': 'opencode-pipeline-agent/1.0',
    'x-opencode-session': 'pipeline-api-session',
  },
});

/** Канал 2: Kimi Code (Kimi k3) */
export const kimiClient = new OpenAI({
  baseURL: config.kimiBaseUrl,
  apiKey: config.kimiApiKey,
  defaultHeaders: {
    'User-Agent': 'kimi-code-agent/1.0',
    ...(config.kimiBaseUrl.includes('opencode.ai')
      ? { 'x-opencode-session': 'pipeline-api-session' }
      : {}),
  },
});

function getDeepSeekClient(): OpenAI {
  if (
    deepseekClient.apiKey === config.deepseekApiKey &&
    deepseekClient.baseURL === config.deepseekBaseUrl
  ) {
    return deepseekClient;
  }
  return new OpenAI({
    baseURL: config.deepseekBaseUrl,
    apiKey: config.deepseekApiKey,
    defaultHeaders: {
      'User-Agent': 'opencode-pipeline-agent/1.0',
      'x-opencode-session': 'pipeline-api-session',
    },
  });
}

function getKimiClient(): OpenAI {
  if (kimiClient.apiKey === config.kimiApiKey && kimiClient.baseURL === config.kimiBaseUrl) {
    return kimiClient;
  }
  return new OpenAI({
    baseURL: config.kimiBaseUrl,
    apiKey: config.kimiApiKey,
    defaultHeaders: {
      'User-Agent': 'kimi-code-agent/1.0',
      ...(config.kimiBaseUrl.includes('opencode.ai')
        ? { 'x-opencode-session': 'pipeline-api-session' }
        : {}),
    },
  });
}

/**
 * Очищает вывод LLM от тегов рассуждений <think>...</think> и маркдаун-обёрток ```json ... ```.
 */
export function cleanLLMJsonOutput(rawText: string): string {
  if (!rawText) return '';

  // 1. Вырезаем рассуждения модели <think>...</think>
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Ищем блок кода ```json ... ``` или ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Частичные или несбалансированные блоки
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/```$/, '');
    }
    cleaned = cleaned.trim();
  }

  // 3. Если перед/после JSON остался пояснительный текст, извлекаем внешний JSON ({...} или [...])
  const firstBrace = cleaned.search(/[{\[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1).trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Оставляем cleaned как есть
    }
  }

  return cleaned.trim();
}

/**
 * Внутренний исполнитель вызова OpenAI-совместимого клиента.
 */
async function invokeChannel(
  client: OpenAI,
  model: string,
  options: LLMCallOptions,
  channelName: string,
): Promise<any> {
  const isJson = options.jsonMode !== false;
  const systemPrompt = withSecurityGuardrail(options.systemPrompt);
  const temperature = options.temperature ?? 0.1;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: options.userPrompt },
  ];

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(isJson ? { response_format: { type: 'json_object' } } : {}),
    });

    const choice = completion.choices?.[0];
    const rawContent = choice?.message?.content ?? '';

    if (!isJson) {
      return cleanLLMJsonOutput(rawContent);
    }

    const cleaned = cleanLLMJsonOutput(rawContent);
    if (!cleaned) {
      throw new Error(`Пустой ответ от ${channelName} (модель ${model})`);
    }

    try {
      return JSON.parse(cleaned);
    } catch (parseErr: any) {
      throw new Error(
        `Ответ от ${channelName} (${model}) не является валидным JSON: ${parseErr.message}\nТекст: ${rawContent}`
      );
    }
  } catch (err: any) {
    const status = err?.status ?? err?.statusCode ?? 'unknown';
    console.error(
      `[llm] Ошибка вызова ${channelName} (model="${model}", status=${status}): ${err?.message ?? err}`
    );
    throw err;
  }
}

/**
 * Канал 1: OpenCode Go (DeepSeek)
 * Используется для Шага 5 (сборка блоков), Шага 8 (тех. подход и аналоги) и чата-консультанта.
 */
export async function callDeepSeek<T = any>(options: LLMCallOptions): Promise<T> {
  return invokeChannel(getDeepSeekClient(), config.deepseekModel, options, 'DeepSeek');
}

/**
 * Канал 2: Kimi Code (Kimi k3)
 * Используется строго для Шага 6 (первичный аудит и точечный ре-аудит).
 */
export async function callKimi<T = any>(options: LLMCallOptions): Promise<T> {
  return invokeChannel(getKimiClient(), config.kimiModel, options, 'Kimi');
}

// -------------------------------------------------------------
// Функции обратной совместимости
// -------------------------------------------------------------

/**
 * Обратная совместимость: chatJson через callDeepSeek.
 */
export async function chatJson<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: Partial<LLMCallOptions> = {},
): Promise<T> {
  return callDeepSeek<T>({
    systemPrompt,
    userPrompt,
    jsonMode: true,
    ...options,
  });
}

/**
 * Обратная совместимость: callLLM через callDeepSeek.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: Partial<LLMCallOptions> = {},
): Promise<any> {
  return callDeepSeek({
    systemPrompt,
    userPrompt,
    ...options,
  });
}

export const callLlm = callLLM;
