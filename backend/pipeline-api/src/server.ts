// HTTP-вход пайплайна. Аутентификация: общий секрет (x-pipeline-secret) от шлюза/n8n.
// В проде user_id должен подтверждаться JWT Supabase на шлюзе — здесь он доверяется.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { handlePipeline } from './pipeline/handler';
import { pipelineRequestSchema } from './pipeline/validation';
import type { PipelineDeps } from './pipeline/deps';
import { handleSupportRequest, SUPPORT_PATH, type SupportOptions } from './support/http';
import { handleChatRequest, CHAT_PATH, type ChatOptions } from './chat/http';

const MAX_BODY_BYTES = 1_000_000;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export interface PipelineServerOptions {
  sharedSecret?: string;
  support?: SupportOptions;
  chat?: ChatOptions;
}

export function createPipelineServer(deps: PipelineDeps, opts: PipelineServerOptions = {}): Server {
  return createServer(async (req, res) => {
    try {
      const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '';

      if (req.method === 'GET' && pathname === '/health') {
        return send(res, 200, { status: 'ok' });
      }

      // Публичный эндпоинт поддержки: без x-pipeline-secret, CORS только для SUPPORT_ALLOWED_ORIGIN.
      if (pathname === SUPPORT_PATH) {
        if (!opts.support) return send(res, 404, { error: 'not found' });
        return await handleSupportRequest(req, res, opts.support);
      }

      // Публичный эндпоинт ИИ-Консультанта: без x-pipeline-secret
      if (pathname === CHAT_PATH) {
        const chatOpts = opts.chat ?? {
          allowedOrigin: opts.support?.allowedOrigin,
        };
        return await handleChatRequest(req, res, deps, chatOpts);
      }

      if (req.method !== 'POST' || pathname !== '/pipeline') {
        return send(res, 404, { error: 'not found' });
      }

      if (opts.sharedSecret && req.headers['x-pipeline-secret'] !== opts.sharedSecret) {
        return send(res, 401, { error: 'unauthorized' });
      }

      let body: unknown;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: 'invalid json' });
      }

      const parsed = pipelineRequestSchema.safeParse(body);
      if (!parsed.success) {
        return send(res, 400, { error: 'invalid request', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      }

      const result = await handlePipeline(deps, parsed.data);
      return send(res, result.status === 'ERROR' ? 422 : 200, result);
    } catch (err) {
      deps.logger.error('[http] unhandled', err);
      return send(res, 500, { error: 'internal' });
    }
  });
}
