import { Notice } from '../../shared/ui';

/** Замечание аудита под проблемным блоком: что не так и как исправить (block_audits: remark и how_to_fix). */
export function AuditRemark({ remark, howToFix }: { remark: string; howToFix?: string | null }) {
  return (
    <Notice tone="warning" title="Замечание аудита">
      {remark}
      {howToFix ? ` ${howToFix}` : null}
    </Notice>
  );
}
