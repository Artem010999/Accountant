// Построитель DOCX паспорта (задача 4.2, пункт 2 правок): собирает 10 секций в документ со стилями бренда.
// Цвета и шрифт — из дизайн-токенов фронтенда (frontend/src/shared/styles/tokens.css), это и есть брендбук проекта.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

/** Цвета и шрифт из tokens.css. Hex без «#», как принимает docx. */
export const BRAND = {
  font: 'Onest',
  brand: 'FF6B1A', // --color-brand: линии и акценты
  ink: '17171C', // --color-ink: основной текст
  terracotta: '7C2D12', // --color-terracotta: заголовки
  peach: 'FFF1E8', // --color-peach: шапка таблицы
  gray600: '52525B', // --color-gray-600: подписи полей
  gray500: '71717A', // --color-gray-500: служебный текст
  gray200: 'E4E4E7', // --color-gray-200: линии таблицы
} as const;

export interface ExportField {
  label: string;
  value: string;
}

export interface ExportSection {
  /** 1–10: номер блока паспорта. */
  number: number;
  title: string;
  fields: ExportField[];
}

export interface ExportBudgetRow {
  stage_label: string;
  category_label: string;
  title: string;
  quantity: string;
  unit_price: string;
  amount: string;
  justification: string;
}

export interface PassportExportData {
  title: string;
  founder_name: string;
  generated_at: string;
  sections: ExportSection[];
  budget: ExportBudgetRow[];
  budget_total: string;
  checklist: string[];
}

/** Текст с переносами строк: каждая строка — отдельный TextRun с разрывом. */
function runs(text: string, opts: { bold?: boolean; color?: string; size: number }): TextRun[] {
  return text.split('\n').map(
    (line, i) => new TextRun({ text: line, bold: opts.bold, color: opts.color ?? BRAND.ink, size: opts.size, font: BRAND.font, break: i > 0 ? 1 : 0 }),
  );
}

const bottomRule = (color: string) => ({ bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 4 } });

function sectionHeading(number: number, title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    border: bottomRule(BRAND.brand),
    keepNext: true,
    children: runs(`${number}. ${title}`, { bold: true, color: BRAND.terracotta, size: 28 }),
  });
}

function fieldBlock(field: ExportField): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 120, after: 40 }, keepNext: true, children: runs(field.label, { bold: true, color: BRAND.gray600, size: 19 }) }),
    new Paragraph({ spacing: { after: 120, line: 300 }, children: runs(field.value, { size: 22 }) }),
  ];
}

const cellBorders = { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND.gray200 }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND.gray200 }, left: { style: BorderStyle.SINGLE, size: 4, color: BRAND.gray200 }, right: { style: BorderStyle.SINGLE, size: 4, color: BRAND.gray200 } };

function cell(
  text: string,
  opts: { header?: boolean; bold?: boolean; width: number; columnSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.columnSpan,
    borders: cellBorders,
    shading: opts.header ? { type: ShadingType.CLEAR, color: 'auto', fill: BRAND.peach } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts.align,
        children: runs(text, { bold: opts.header || opts.bold, color: opts.header ? BRAND.terracotta : BRAND.ink, size: 18 }),
      }),
    ],
  });
}

/** Ширины колонок таблицы сметы (twips, сумма ≈ 9 638 — ширина текстовой области A4 с полями 2 см). */
const BUDGET_COLS = [1100, 1500, 1500, 1000, 1350, 1350, 1838];

function budgetTable(rows: readonly ExportBudgetRow[], total: string): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ['Этап', 'Статья', 'Группа', 'Кол-во', 'Цена, ₽', 'Сумма, ₽', 'Обоснование'].map((t, i) =>
      cell(t, { header: true, width: BUDGET_COLS[i]! }),
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [r.stage_label, r.title, r.category_label, r.quantity, r.unit_price, r.amount, r.justification].map((t, i) =>
          cell(t, { width: BUDGET_COLS[i]!, align: i >= 3 && i <= 5 ? AlignmentType.RIGHT : undefined }),
        ),
      }),
  );
  const spanWidth = BUDGET_COLS.slice(0, 5).reduce((a, b) => a + b, 0);
  const totalRow = new TableRow({
    children: [
      cell('Итого', { bold: true, width: spanWidth, columnSpan: 5 }),
      cell(total, { bold: true, width: BUDGET_COLS[5]!, align: AlignmentType.RIGHT }),
      cell('', { width: BUDGET_COLS[6]! }),
    ],
  });
  return new Table({ width: { size: 9638, type: WidthType.DXA }, rows: [header, ...body, totalRow] });
}

/** Строит DOCX из 10 секций, сметы и чек-листа. Возвращает бинарный файл. */
export async function buildPassportDocx(data: PassportExportData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 80 }, children: runs('Паспорт проекта', { bold: true, color: BRAND.terracotta, size: 44 }) }),
    new Paragraph({ spacing: { after: 120 }, children: runs(data.title, { color: BRAND.ink, size: 30 }) }),
    new Paragraph({
      spacing: { after: 240 },
      border: bottomRule(BRAND.brand),
      children: runs(`Заявитель: ${data.founder_name}  ·  Дата формирования: ${data.generated_at}`, { color: BRAND.gray600, size: 20 }),
    }),
  ];

  for (const section of data.sections) {
    children.push(sectionHeading(section.number, section.title));
    for (const field of section.fields) children.push(...fieldBlock(field));
  }

  children.push(sectionHeading(data.sections.length + 1, 'Смета'));
  children.push(budgetTable(data.budget, data.budget_total));

  children.push(
    new Paragraph({
      spacing: { before: 360, after: 160 },
      border: bottomRule(BRAND.brand),
      keepNext: true,
      children: runs('Чек-лист документов для подачи', { bold: true, color: BRAND.terracotta, size: 28 }),
    }),
  );
  for (const item of data.checklist) {
    children.push(new Paragraph({ spacing: { after: 80, line: 300 }, indent: { left: 360, hanging: 360 }, children: runs(`☐  ${item}`, { size: 22 }) }));
  }

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Буха · паспорт проекта · стр. ', color: BRAND.gray500, size: 16, font: BRAND.font }),
          new TextRun({ children: [PageNumber.CURRENT], color: BRAND.gray500, size: 16, font: BRAND.font }),
          new TextRun({ text: ' из ', color: BRAND.gray500, size: 16, font: BRAND.font }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: BRAND.gray500, size: 16, font: BRAND.font }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: 'Буха',
    title: `Паспорт проекта: ${data.title}`,
    styles: { default: { document: { run: { font: BRAND.font, size: 22, color: BRAND.ink } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: { default: footer },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
