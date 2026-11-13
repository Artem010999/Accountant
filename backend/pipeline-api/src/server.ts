// HTTP-вход пайплайна. Аутентификация: общий секрет (x-pipeline-secret) от шлюза/n8n.
// В проде user_id должен подтверждаться JWT Supabase на шлюзе — здесь он доверяется.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { handlePipeline, withCallLogging } from './pipeline/handler';
import { consultantRequestSchema, exportRequestSchema, pipelineRequestSchema } from './pipeline/validation';
import type { PipelineDeps } from './pipeline/deps';
import { handleSupportRequest, SUPPORT_PATH, type SupportOptions } from './support/http';
import { handleConsultant } from './consultant/consultant';
import { handleExport, type ExportReady, type ExportRequestBody } from './pipeline/export';
import { PipelineFailure } from './errors';
import type { ConsultantRequest, ConsultantResponse, PipelineError } from '@passport/contracts';

const MAX_BODY_BYTES = 1_000_000;
const CONSULTANT_PATH = '/consultant';
const EXPORT_PATH = '/export';
const EXPORT_PREFIX = '/export/';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Ожидаемая ошибка выгрузки → ERROR с кодом; прочее → INTERNAL. */
async function exportOrError(deps: PipelineDeps, body: ExportRequestBody): Promise<PipelineError | ExportReady> {
  try {
    const ctx = await deps.store.loadContext(body.user_id);
    if (!ctx || ctx.isBanned) throw new PipelineFailure('USER_BANNED', 'Профиль не найден или заблокирован');
    return await handleExport(withCallLogging(deps, body.user_id), body, ctx);
  } catch (err) {
    if (err instanceof PipelineFailure) return { status: 'ERROR', code: err.code, message: err.message };
    deps.logger.error('[export] unexpected error', err);
    return { status: 'ERROR', code: 'INTERNAL', message: 'Внутренняя ошибка выгрузки' };
  }
}

/** Ожидаемая ошибка консультанта → ERROR с кодом; прочее → INTERNAL. */
async function consultantOrError(deps: PipelineDeps, req: ConsultantRequest): Promise<ConsultantResponse | PipelineError> {
  try {
    return await handleConsultant(withCallLogging(deps, req.user_id), req);
  } catch (err) {
    if (err instanceof PipelineFailure) return { status: 'ERROR', code: err.code, message: err.message };
    deps.logger.error('[consultant] unexpected error', err);
    return { status: 'ERROR', code: 'INTERNAL', message: 'Внутренняя ошибка консультанта' };
  }
}

export function createPipelineServer(deps: PipelineDeps, opts: { sharedSecret?: string; support?: SupportOptions } = {}): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return send(res, 200, { status: 'ok' });
      }

      // Публичный эндпоинт поддержки: без x-pipeline-secret, CORS только для SUPPORT_ALLOWED_ORIGIN.
      if (req.url === SUPPORT_PATH) {
        if (!opts.support) return send(res, 404, { error: 'not found' });
        return await handleSupportRequest(req, res, opts.support);
      }

      // Внутренние маршруты блока 4 (общий секрет): ИИ-Консультант, выгрузка DOCX и её скачивание.
      const internal = req.url === CONSULTANT_PATH || req.url === EXPORT_PATH || (req.method === 'GET' && req.url?.startsWith(EXPORT_PREFIX));
      if (internal && opts.sharedSecret && req.headers['x-pipeline-secret'] !== opts.sharedSecret) {
        return send(res, 401, { error: 'unauthorized' });
      }

      if (req.method === 'POST' && req.url === CONSULTANT_PATH) {
        let body: unknown;
        try {
          body = await readJson(req);
        } catch {
          return send(res, 400, { error: 'invalid json' });
        }
        const parsed = consultantRequestSchema.safeParse(body);
        if (!parsed.success) {
          return send(res, 400, { error: 'invalid request', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
        }
        const result = await consultantOrError(deps, parsed.data);
        return send(res, result.status === 'ERROR' ? 422 : 200, result);
      }

      if (req.method === 'POST' && req.url === EXPORT_PATH) {
        let body: unknown;
        try {
          body = await readJson(req);
        } catch {
          return send(res, 400, { error: 'invalid json' });
        }
        const parsed = exportRequestSchema.safeParse(body);
        if (!parsed.success) {
          return send(res, 400, { error: 'invalid request', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
        }
        const result = await exportOrError(deps, parsed.data);
        return send(res, result.status === 'ERROR' ? 422 : 200, result);
      }

      if (req.method === 'GET' && req.url?.startsWith(EXPORT_PREFIX)) {
        const exportId = req.url.slice(EXPORT_PREFIX.length).split('?')[0] ?? '';
        const userId = req.headers['x-user-id'];
        if (!UUID_RE.test(exportId) || typeof userId !== 'string' || !UUID_RE.test(userId)) {
          return send(res, 404, { error: 'not found' });
        }
        const file = await deps.store.getExport(exportId, userId);
        if (!file) return send(res, 404, { error: 'not found' });
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
        });
        return res.end(file.content);
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
