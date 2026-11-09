// HTTP-вход пайплайна. Аутентификация: общий секрет (x-pipeline-secret) от шлюза/n8n.
// В проде user_id должен подтверждаться JWT Supabase на шлюзе — здесь он доверяется.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { handlePipeline } from './pipeline/handler';
import { pipelineRequestSchema } from './pipeline/validation';
import type { PipelineDeps } from './pipeline/deps';

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

export function createPipelineServer(deps: PipelineDeps, opts: { sharedSecret?: string } = {}): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return send(res, 200, { status: 'ok' });
      }

      if (req.method !== 'POST' || req.url !== '/pipeline') {
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
