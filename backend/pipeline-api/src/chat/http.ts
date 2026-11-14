import type { IncomingMessage, ServerResponse } from 'node:http';
import { PipelineFailure } from '../errors';
import type { PipelineDeps } from '../pipeline/deps';
import { chatGetQuerySchema, chatPostRequestSchema } from './schema';
import { getConsultantHistory, handleConsultantChat } from './service';

export const CHAT_PATH = '/chat';
const MAX_BODY_BYTES = 64_000;

export interface ChatOptions {
  allowedOrigin?: string;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

class PayloadTooLargeError extends Error {}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  let tooLarge = false;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk as Buffer);
  }
  if (tooLarge) throw new PayloadTooLargeError('payload too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function applyCors(req: IncomingMessage, res: ServerResponse, allowedOrigin?: string): void {
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (!origin) return;

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8081',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
  ];
  if (allowedOrigin && !allowedOrigins.includes(allowedOrigin)) {
    allowedOrigins.push(allowedOrigin);
  }

  const isAllowed =
    allowedOrigins.includes(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

export async function handleChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PipelineDeps,
  opts: ChatOptions = {},
): Promise<void> {
  applyCors(req, res, opts.allowedOrigin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url ?? '', 'http://localhost');
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    const parsed = chatGetQuerySchema.safeParse(query);
    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'invalid query',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }

    try {
      const result = await getConsultantHistory(deps, parsed.data.user_id, parsed.data.limit);
      sendJson(res, 200, result);
      return;
    } catch (err: any) {
      if (err instanceof PipelineFailure && err.code === 'USER_BANNED') {
        sendJson(res, 403, { error: err.message, code: err.code });
        return;
      }
      deps.logger?.error?.('[chat] get history error', err);
      sendJson(res, 500, { error: err?.message ?? 'internal chat error' });
      return;
    }
  }

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        sendJson(res, 413, { error: 'payload too large' });
        return;
      }
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }

    const parsed = chatPostRequestSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'invalid request',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }

    try {
      const result = await handleConsultantChat(deps, parsed.data);
      sendJson(res, 200, result);
      return;
    } catch (err: any) {
      if (err instanceof PipelineFailure && err.code === 'USER_BANNED') {
        sendJson(res, 403, { error: err.message, code: err.code });
        return;
      }
      deps.logger?.error?.('[chat] post message error', err);
      sendJson(res, 500, { error: err?.message ?? 'internal chat error' });
      return;
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  sendJson(res, 405, { error: 'method not allowed' });
}
