// Блок 2 (ШАГ 3А): приём файлов — дедуп по sha256, парсинг, проверка хеша, запись project_sources.
import type { PipelineFileInput } from '@passport/contracts';
import { PipelineFailure } from '../errors';
import type { PipelineDeps } from './deps';
import type { SourceRow } from '../db/store';

/** Возвращает только НОВЫЕ источники (уже известные по sha256 пропускаются). */
export async function ingestFiles(deps: PipelineDeps, projectId: string, files: PipelineFileInput[]): Promise<SourceRow[]> {
  const added: SourceRow[] = [];

  for (const file of files) {
    const known = await deps.store.findSourceBySha(projectId, file.sha256_hash);
    if (known) continue;

    const parsed = await deps.parser.parse({ file_name: file.file_name, file_url: file.file_url });
    if (parsed.sha256_hash.toLowerCase() !== file.sha256_hash.toLowerCase()) {
      throw new PipelineFailure('FILE_HASH_MISMATCH', `Хеш файла «${file.file_name}» не совпадает с заявленным`);
    }

    const id = await deps.store.insertSource(projectId, {
      file_name: file.file_name,
      file_url: file.file_url,
      sha256_hash: file.sha256_hash.toLowerCase(),
      extracted_text: parsed.extracted_text,
      metadata: parsed.metadata,
    });
    added.push({
      id,
      file_name: file.file_name,
      extracted_text: parsed.extracted_text,
      metadata: parsed.metadata,
    });
  }

  return added;
}
