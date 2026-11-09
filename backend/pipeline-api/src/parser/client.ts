import { PipelineFailure } from '../errors';

export interface ParsedPage {
  page: number;
  text: string;
  char_start: number;
  char_end: number;
}

export interface ParsedDocument {
  sha256_hash: string;
  extracted_text: string;
  metadata: { total_pages: number; pages: ParsedPage[] };
}

export interface DocumentParser {
  parse(file: { file_name: string; file_url: string }): Promise<ParsedDocument>;
}

/** Клиент к parser-service (backend/parser-service): POST /parse. */
export class HttpDocumentParser implements DocumentParser {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async parse(file: { file_name: string; file_url: string }): Promise<ParsedDocument> {
    const res = await this.fetchImpl(`${this.baseUrl}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new PipelineFailure('INTERNAL', `Парсер вернул HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as ParsedDocument;
  }
}
