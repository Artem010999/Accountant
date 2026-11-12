import type { AppConfig } from '../config';
import { createMailFromConfig } from '../mail';
import type { SupportOptions } from './http';

/** Параметры /support из конфигурации: почтовый адаптер, адрес поддержки и разрешённый origin. */
export function supportOptionsFromConfig(cfg: AppConfig): SupportOptions {
  return {
    mail: createMailFromConfig(cfg),
    supportEmail: cfg.supportEmail,
    allowedOrigin: cfg.supportAllowedOrigin,
  };
}
