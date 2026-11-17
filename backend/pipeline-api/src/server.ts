// HTTP-вход пайплайна. Аутентификация: общий секрет (x-pipeline-secret) от шлюза/n8n.
// В проде user_id должен подтверждаться JWT Supabase на шлюзе — здесь он доверяется.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { handlePipeline, withCallLogging } from './pipeline/handler';
import { exportRequestSchema, pipelineRequestSchema, profileRequestSchema } from './pipeline/validation';
import type { PipelineDeps } from './pipeline/deps';
import { handleSupportRequest, SUPPORT_PATH, type SupportOptions } from './support/http';
import { handleChatRequest, CHAT_PATH, type ChatOptions } from './chat/http';
import { handleExport, type ExportReady, type ExportRequestBody } from './pipeline/export';
import { PipelineFailure } from './errors';
import { handleAuthRequest, sessionUserFor, type AuthHttpOptions } from './auth/http';
import type { PipelineError } from '@passport/contracts';

const MAX_BODY_BYTES = 1_000_000;
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

/**
 * Когда вход включён (opts.auth), user_id в теле запроса заменяется пользователем из сессии:
 * подставить чужой id через тело невозможно. Без входа (старый режим с общим секретом) тело не меняем.
 */
function bindUser(body: unknown, userId: string | null): unknown {
  if (userId === null || !body || typeof body !== 'object') return body;
  return { ...(body as Record<string, unknown>), user_id: userId };
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

export interface PipelineServerOptions {
  sharedSecret?: string;
  support?: SupportOptions;
  chat?: ChatOptions;
  /** Вход по коду из письма (/auth/*). Без него маршруты входа не подключены. */
  auth?: AuthHttpOptions;
}

export function createPipelineServer(deps: PipelineDeps, opts: PipelineServerOptions = {}): Server {
  return createServer(async (req, res) => {
    try {
      const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '';

      if (req.method === 'GET' && pathname === '/health') {
        return send(res, 200, { status: 'ok' });
      }

      // Вход по коду из письма: без общего секрета (это публичные маршруты).
      if (opts.auth && pathname.startsWith('/auth/') && (await handleAuthRequest(req, res, pathname, opts.auth))) {
        return;
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
        const authOpts = opts.auth;
        const sessionUser = authOpts
          ? async (r: IncomingMessage) => (await sessionUserFor(r, authOpts))?.userId ?? null
          : undefined;
        return await handleChatRequest(req, res, deps, { ...chatOpts, sessionUser });
      }

      // Справочник технологических вызовов (357) для выбора в паспорте. Публичный: это справочник, без персональных данных.
      if (req.method === 'GET' && pathname === '/challenges') {
        return send(res, 200, {
          challenges: deps.kb.tech_challenges.map((c) => ({ number: c.number, direction: c.direction, partner: c.partner, topic: c.topic })),
        });
      }

      // Данные основателя (блок 1): POST /profile (общий секрет).
      if (req.method === 'POST' && pathname === '/profile') {
        if (opts.sharedSecret && req.headers['x-pipeline-secret'] !== opts.sharedSecret) {
          return send(res, 401, { error: 'unauthorized' });
        }
        let sessionUserId: string | null = null;
        if (opts.auth) {
          const user = await sessionUserFor(req, opts.auth);
          if (!user) return send(res, 401, { status: 'UNAUTHORIZED' });
          sessionUserId = user.userId;
        }
        let body: unknown;
        try {
          body = bindUser(await readJson(req), sessionUserId);
        } catch {
          return send(res, 400, { error: 'invalid json' });
        }
        const parsed = profileRequestSchema.safeParse(body);
        if (!parsed.success) {
          return send(res, 400, { error: 'invalid request', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
        }
        const ctx = await deps.store.loadContext(parsed.data.user_id);
        if (!ctx || ctx.isBanned) return send(res, 422, { status: 'ERROR', code: 'USER_BANNED', message: 'Профиль не найден или заблокирован' });
        await deps.store.updateFounderData(parsed.data.user_id, parsed.data.founder as Record<string, string>);
        return send(res, 200, { status: 'OK' });
      }

      // Внутренние маршруты выгрузки (общий секрет): POST /export и скачивание GET /export/:id.
      if (pathname === EXPORT_PATH || (req.method === 'GET' && pathname.startsWith(EXPORT_PREFIX))) {
        if (opts.sharedSecret && req.headers['x-pipeline-secret'] !== opts.sharedSecret) {
          return send(res, 401, { error: 'unauthorized' });
        }
      }

      if (req.method === 'POST' && pathname === EXPORT_PATH) {
        let sessionUserId: string | null = null;
        if (opts.auth) {
          const user = await sessionUserFor(req, opts.auth);
          if (!user) return send(res, 401, { status: 'UNAUTHORIZED' });
          sessionUserId = user.userId;
        }
        let body: unknown;
        try {
          body = bindUser(await readJson(req), sessionUserId);
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

      if (req.method === 'GET' && pathname.startsWith(EXPORT_PREFIX)) {
        const exportId = pathname.slice(EXPORT_PREFIX.length);
        // С входом владелец — пользователь сессии; без входа (старый режим) — заголовок x-user-id.
        let userId: unknown = req.headers['x-user-id'];
        if (opts.auth) {
          const user = await sessionUserFor(req, opts.auth);
          if (!user) return send(res, 401, { status: 'UNAUTHORIZED' });
          userId = user.userId;
        }
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

      if (req.method !== 'POST' || pathname !== '/pipeline') {
        return send(res, 404, { error: 'not found' });
      }

      if (opts.sharedSecret && req.headers['x-pipeline-secret'] !== opts.sharedSecret) {
        return send(res, 401, { error: 'unauthorized' });
      }

      let sessionUserId: string | null = null;
      if (opts.auth) {
        const user = await sessionUserFor(req, opts.auth);
        if (!user) return send(res, 401, { status: 'UNAUTHORIZED' });
        sessionUserId = user.userId;
      }

      let body: unknown;
      try {
        body = bindUser(await readJson(req), sessionUserId);
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
