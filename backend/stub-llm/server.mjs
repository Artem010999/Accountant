// Заглушка OpenAI-совместимого API для локального стека без ключей.
// Отвечает на /v1/chat/completions (JSON-режим) и /v1/embeddings.
// Ответ выбирается по системному промпту (те же задачи, что в pipeline-api/src/llm/prompts.ts).
// НЕ для продакшена: это детерминированные заглушки, не модели.

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8090);
// Должно совпадать с колонкой anchor_embedding (vector(4096), миграция 0005) и EMBEDDING_DIM в pipeline-api.
const DIM = 4096;

function hashEmbedding(text) {
  const v = new Array(DIM).fill(0);
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []) {
    let h = 0;
    for (const ch of w) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
    v[h % DIM] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function firstSentence(text) {
  const s = (text.split(/[.!?]/)[0] ?? '').trim();
  return s.length >= 15 ? s : text.trim().slice(0, 200);
}

function taskOf(systemPrompt) {
  if (systemPrompt.includes('редактор грантовой заявки')) return 'anchor';
  if (systemPrompt.includes('экспертный продуктовый аналитик')) return 'extract';
  if (systemPrompt.includes('валидатор сведений')) return 'validate_answer';
  if (systemPrompt.includes('научно-технический эксперт')) return 'novelty';
  if (systemPrompt.includes('ИИ-Навигатор')) return 'navigator';
  return 'unknown';
}

function answer(task, input) {
  switch (task) {
    case 'anchor':
      return { anchor_summary: String(input.brief ?? '').slice(0, 1200) };
    case 'extract': {
      const text = [input.user_input, ...(input.sources ?? []).map((s) => (s.pages ?? []).map((p) => p.text).join(' '))]
        .filter(Boolean)
        .join(' ');
      const sentence = firstSentence(text);
      if (!sentence) return { fields: [] };
      return {
        fields: [
          {
            section_id: 3,
            field_key: 'problem_description',
            value: sentence,
            claims: [{ claim_text: sentence, claim_type: 'hypothesis', claim_kind: 'sentence', source_id: null, source_locator: null, confidence: 0.8 }],
          },
        ],
      };
    }
    case 'validate_answer': {
      const a = String(input.answer ?? '').trim();
      if (a.length < 20) return { is_valid: false, rejection_reason: 'Ответ слишком короткий. Опишите подробнее.', formatted_value: null, claims: [] };
      return {
        is_valid: true,
        rejection_reason: null,
        formatted_value: a,
        claims: [{ claim_text: a, claim_type: 'client_statement', claim_kind: 'sentence', source_id: null, source_locator: null, confidence: 0.9 }],
      };
    }
    case 'novelty':
      // Заглушка всегда просит уточнить аналоги: проверяется ветка STOP_NOV.
      return { analogues_count: 0, analogues_list: [], has_measurable_comparison: false, missing_details_question: 'Укажите минимум 2 аналога и измеримое отличие по каждому.' };
    case 'navigator':
      return { summary: 'Паспорт сформирован (локальная заглушка LLM).', checklist: ['Проверьте данные перед подачей.'] };
    default:
      return {};
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method === 'GET' && req.url === '/health') return send(200, { status: 'ok' });
    if (req.method === 'POST' && req.url === '/v1/embeddings') {
      const body = JSON.parse(await readBody(req));
      return send(200, { object: 'list', data: [{ object: 'embedding', index: 0, embedding: hashEmbedding(String(body.input ?? '')) }], model: body.model });
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = JSON.parse(await readBody(req));
      const system = body.messages?.find((m) => m.role === 'system')?.content ?? '';
      const user = body.messages?.find((m) => m.role === 'user')?.content ?? '{}';
      const task = taskOf(system);
      const content = JSON.stringify(answer(task, JSON.parse(user)));
      return send(200, {
        id: 'stub-1',
        object: 'chat.completion',
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      });
    }
    return send(404, { error: 'not found' });
  } catch (err) {
    return send(500, { error: String(err) });
  }
});

server.listen(PORT, () => console.log(`stub-llm listening on :${PORT}`));
