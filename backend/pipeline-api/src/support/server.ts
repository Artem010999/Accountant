// Отдельный HTTP-сервер только для обращений в поддержку: без Postgres и OPENAI_API_KEY.
import { createServer, type Server } from 'node:http';
import { handleSupportRequest, sendJson, SUPPORT_PATH, type SupportOptions } from './http';

export function createSupportServer(opts: SupportOptions): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return sendJson(res, 200, { status: 'ok' });
      }
      if (req.url === SUPPORT_PATH) {
        return await handleSupportRequest(req, res, opts);
      }
      return sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      (opts.logger ?? console).error('[support] unhandled', err);
      return sendJson(res, 500, { error: 'internal' });
    }
  });
}
