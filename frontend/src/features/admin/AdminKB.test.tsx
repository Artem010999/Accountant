import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createDemoKbService,
  DEMO_KB_RECORDS,
  formatRuDate,
  KB_MAX_FILE_BYTES,
  kbFileError,
  kbStatusLabel,
  resolveKbStatuses,
  shortHash,
  type KbDocRecord,
  type KbService,
} from '../../shared/data/adminKb';
import { AdminKB } from './AdminKB';

const SUCCESS_TEXT =
  'Документ опубликован. Паспорта, проверенные по прежней версии, не меняются — новая версия применится при следующей проверке.';

// Хеш-заглушки: hex sha256, у которого сокращённая форма совпадает с эталоном.
const HASH_PUBLISHED = `f0e1${'0'.repeat(56)}6b2c`; // «f0e1…6b2c» — хеш новой редакции из эталона
const HASH_EXISTING = `a41c${'0'.repeat(56)}02fe`; // «a41c…02fe» — документ «Анкета и вопросы по полям»
const HASH_NEW = `1234${'0'.repeat(56)}abcd`;

function demoService(hex: string): KbService {
  return createDemoKbService({ hashFile: async () => hex, today: '2026-11-12' });
}

function pdf(name = 'reg_v1.1.pdf'): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

/** Файл заданного размера без записи больших данных в память. */
function sized(name: string, size: number): File {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function rowByTitle(title: string): HTMLElement {
  const row = screen.getByText(title, { selector: '.kb__doc-title' }).closest('tr');
  if (!row) throw new Error(`Строка не найдена: ${title}`);
  return row;
}

function cellTexts(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent ?? '');
}

/** Строка по названию документа и версии (у одного названия может быть несколько версий). */
function rowByVersion(title: string, version: string): HTMLElement {
  const row = screen.getAllByRole('row').find((r) => {
    const cells = Array.from(r.querySelectorAll('td'), (c) => c.textContent ?? '');
    return cells[0]?.startsWith(title) && cells[2] === version;
  });
  if (!row) throw new Error(`Строка не найдена: ${title} ${version}`);
  return row;
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Добавить документ' }));
  return screen.getByRole('form', { name: 'Новый документ' });
}

describe('AdminKB: отображение', () => {
  it('рендерит заголовок, пояснение и вкладки программ из дизайна', async () => {
    render(<AdminKB />);
    expect(screen.getByRole('heading', { level: 1, name: 'База знаний' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Правила программ, анкеты, вопросы и эталонные примеры. Из них Буха берёт вопросы и стоп-факторы.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Студенческий стартап' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Старт-1 · скоро' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Сколково · скоро' })).toBeDisabled();

    // Документы приходят асинхронно: ждём первую строку.
    expect(await screen.findByText('Положение о программе (прошлая очередь)', { selector: '.kb__doc-title' })).toBeInTheDocument();
  });

  it('таблица: заголовки колонок и строки с типом, версией, датой, хешем и статусом', async () => {
    render(<AdminKB />);
    await screen.findByText('Положение о программе (прошлая очередь)', { selector: '.kb__doc-title' });

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Документ', 'Тип', 'Версия', 'Действует с', 'Хеш', 'Статус']);

    expect(cellTexts(rowByTitle('Положение о программе'))).toEqual([
      'Положение о программе' + 'kb/fasie/studstartup/reg_v1.pdf',
      'Положение',
      '1.0',
      '01.01.2026',
      'xyz7…9hash',
      'Действует',
    ]);
    expect(cellTexts(rowByTitle('Анкета и вопросы по полям'))[1]).toBe('Анкета и вопросы');
    expect(cellTexts(rowByTitle('Анкета и вопросы по полям'))[4]).toBe('a41c…02fe');
    expect(cellTexts(rowByTitle('Положение о программе (прошлая очередь)'))).toEqual([
      'Положение о программе (прошлая очередь)kb/fasie/studstartup/reg_v0.pdf',
      'Положение',
      '0.9',
      '01.03.2025',
      '55aa…e310',
      'Архив',
    ]);
    expect(screen.getAllByText('Действует')).toHaveLength(4);
  });

  it('на экране нигде не упоминается JSON: ни в подсказке, ни в именах файлов таблицы', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    expect(document.body.textContent ?? '').not.toMatch(/json/i);
  });

  it('список берётся из сервиса и совпадает с демо-данными', async () => {
    const list = vi.fn(async () => resolveKbStatuses(DEMO_KB_RECORDS, '2026-11-12').slice(0, 2));
    render(<AdminKB service={{ listDocuments: list, uploadDocument: vi.fn() }} />);
    expect(await screen.findByText('Анкета и вопросы по полям', { selector: '.kb__doc-title' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('studstartup');
    expect(screen.queryByText('Правила стоп-факторов', { selector: '.kb__doc-title' })).toBeNull();
  });
});

describe('AdminKB: форма новой редакции', () => {
  it('открывается по «Добавить документ», предзаполнена значениями эталона, кнопка становится «Отмена»', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });

    const form = await openForm(user);
    expect(within(form).getByRole('heading', { name: 'Новый документ' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Программа' })).toHaveDisplayValue('Студенческий стартап');
    expect(screen.getByRole('combobox', { name: 'Тип' })).toHaveDisplayValue('Положение о программе');
    expect(screen.getByRole('textbox', { name: 'Версия' })).toHaveValue('1.1');
    expect(screen.getByLabelText('Действует с')).toHaveValue('2026-12-01');
    expect(screen.getByText(/Перетащите PDF или DOCX-файл сюда или/)).toBeInTheDocument();
    expect(
      screen.getByText('Анкеты и правила хранятся отдельным файлом рядом с регламентом в формате PDF или DOCX.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
  });

  it('«Отмена» закрывает форму', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('form', { name: 'Новый документ' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Добавить документ' })).toBeInTheDocument();
  });

  it('список типов содержит пять значений эталона', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    const options = within(screen.getByRole('combobox', { name: 'Тип' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'Положение о программе',
      'Анкета и вопросы',
      'Эталонные примеры',
      'Правила стоп-факторов',
      'Критерии оценки',
    ]);
  });

  it('валидация: без файла, версии и даты форма не отправляется и показывает ошибки', async () => {
    const user = userEvent.setup();
    const demo = demoService(HASH_NEW);
    const uploadDocument = vi.fn(demo.uploadDocument);
    render(<AdminKB service={{ listDocuments: demo.listDocuments, uploadDocument }} />);
    await openForm(user);

    await user.clear(screen.getByRole('textbox', { name: 'Версия' }));
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(screen.getByText('Укажите версию')).toBeInTheDocument();
    expect(screen.getByText('Укажите дату начала действия')).toBeInTheDocument();
    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Версия' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Действует с')).toHaveAttribute('aria-invalid', 'true');
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ошибка поля снимается, когда пользователь исправляет значение', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    await user.clear(screen.getByRole('textbox', { name: 'Версия' }));
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(screen.getByText('Укажите версию')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Версия' }), '2');
    expect(screen.queryByText('Укажите версию')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Версия' })).toHaveValue('2');
  });

  it('формат: принимаются только PDF и DOCX; JSON и прочие отклоняются', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    const input = screen.getByLabelText('Файл документа');
    const accept = input.getAttribute('accept') ?? '';
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.docx');
    expect(accept).not.toContain('json');

    fireEvent.change(input, { target: { files: [new File(['{}'], 'questions.json')] } });
    expect(screen.getByText('Допустимы только PDF и DOCX')).toBeInTheDocument();
    expect(screen.queryByText(/Выбран файл/)).toBeNull();

    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt')] } });
    expect(screen.getByText('Допустимы только PDF и DOCX')).toBeInTheDocument();
    expect(screen.queryByText(/Выбран файл/)).toBeNull();
  });

  it('формат: DOCX принимается, ошибка формата снимается', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    const input = screen.getByLabelText('Файл документа');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.json')] } });
    expect(screen.getByText('Допустимы только PDF и DOCX')).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [new File(['PK'], 'reg_v1.1.docx')] } });
    expect(screen.getByText('Выбран файл: reg_v1.1.docx')).toBeInTheDocument();
    expect(screen.queryByText('Допустимы только PDF и DOCX')).toBeNull();
  });

  it('размер: файл больше 50 МБ отклоняется с текстом под полем файла; ровно 50 МБ — допустимо', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    const input = screen.getByLabelText('Файл документа');

    fireEvent.change(input, { target: { files: [sized('big.pdf', KB_MAX_FILE_BYTES + 1)] } });
    expect(screen.getByText('Файл больше 50 МБ. Загрузите файл меньшего размера.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/Выбран файл/)).toBeNull();

    fireEvent.change(input, { target: { files: [sized('edge.pdf', KB_MAX_FILE_BYTES)] } });
    expect(screen.queryByText('Файл больше 50 МБ. Загрузите файл меньшего размера.')).toBeNull();
    expect(screen.getByText('Выбран файл: edge.pdf')).toBeInTheDocument();
  });

  it('размер и формат: файл, не прошедший проверку, не уходит в сервис', async () => {
    const user = userEvent.setup();
    const demo = demoService(HASH_NEW);
    const uploadDocument = vi.fn(demo.uploadDocument);
    render(<AdminKB service={{ listDocuments: demo.listDocuments, uploadDocument }} />);
    await openForm(user);
    fireEvent.change(screen.getByLabelText('Файл документа'), {
      target: { files: [sized('big.docx', KB_MAX_FILE_BYTES + 1)] },
    });
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(screen.getByText('Файл больше 50 МБ. Загрузите файл меньшего размера.')).toBeInTheDocument();
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('выбранный файл показывается по имени', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    await openForm(user);
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    expect(screen.getByText('Выбран файл: reg_v1.1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Выберите файл')).toBeNull();
  });

  it('успешная публикация: сообщение из эталона, новая строка сверху, форма закрыта', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_PUBLISHED)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
    expect(screen.queryByRole('form', { name: 'Новый документ' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Добавить документ' })).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(cellTexts(rows[1])).toEqual([
      'Положение о программе' + 'kb/fasie/studstartup/reg_v1.1.pdf',
      'Положение',
      '1.1',
      '01.12.2026',
      'f0e1…6b2c',
      'С 1 декабря',
    ]);
    expect(rows).toHaveLength(7); // заголовок + шесть документов
  });

  it('версия, введённая пользователем, попадает в новую строку', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_PUBLISHED)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    await user.clear(screen.getByRole('textbox', { name: 'Версия' }));
    await user.type(screen.getByRole('textbox', { name: 'Версия' }), '1.2');
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    await screen.findByRole('status');
    expect(cellTexts(screen.getAllByRole('row')[1])[2]).toBe('1.2');
  });

  it('будущая дата «Действует с»: прежняя редакция остаётся «Действует», новая — «С 1 декабря»', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_PUBLISHED)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    expect(cellTexts(rowByVersion('Положение о программе', '1.0'))[5]).toBe('Действует');

    await openForm(user);
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByRole('status');

    expect(cellTexts(rowByVersion('Положение о программе', '1.0'))[5]).toBe('Действует');
    expect(cellTexts(rowByVersion('Положение о программе', '1.1'))[5]).toBe('С 1 декабря');
    // Другой тип документа не затронут.
    expect(cellTexts(rowByTitle('Анкета и вопросы по полям'))[5]).toBe('Действует');
  });

  it('дата «Действует с» сегодня: прежняя редакция переходит в «Архив», новая — «Действует»', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_PUBLISHED)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });

    await openForm(user);
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '2026-11-12' } });
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByRole('status');

    expect(cellTexts(rowByVersion('Положение о программе', '1.0'))[5]).toBe('Архив');
    expect(cellTexts(rowByVersion('Положение о программе', '1.1'))[5]).toBe('Действует');
  });

  it('дата «Действует с» в прошлом: прежняя редакция — «Архив», новая — «Действует»', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_PUBLISHED)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });

    await openForm(user);
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '2026-10-01' } });
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await screen.findByRole('status');

    expect(cellTexts(rowByVersion('Положение о программе', '1.0'))[5]).toBe('Архив');
    expect(cellTexts(rowByVersion('Положение о программе', '1.1'))[5]).toBe('Действует');
  });

  it('сервис получает значения формы', async () => {
    const user = userEvent.setup();
    const demo = demoService(HASH_PUBLISHED);
    const uploadDocument = vi.fn(demo.uploadDocument);
    render(<AdminKB service={{ listDocuments: demo.listDocuments, uploadDocument }} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тип' }), 'stop_rules');
    const file = pdf();
    await user.upload(screen.getByLabelText('Файл документа'), file);
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    await screen.findByRole('status');
    expect(uploadDocument).toHaveBeenCalledWith({
      programId: 'studstartup',
      type: 'stop_rules',
      version: '1.1',
      validFrom: '2026-12-01',
      file,
    });
    expect(cellTexts(screen.getAllByRole('row')[1])[1]).toBe('Правила');
  });

  it('дубль хеша: сообщение «Такой файл уже загружен», форма остаётся, список не меняется', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_EXISTING)} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    await user.upload(screen.getByLabelText('Файл документа'), pdf('questions_v1.pdf'));
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Такой файл уже загружен');
    expect(screen.getByRole('form', { name: 'Новый документ' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('ошибка сервиса при загрузке не скрывает форму и не добавляет строку', async () => {
    const user = userEvent.setup();
    const demo = demoService(HASH_NEW);
    const service: KbService = {
      listDocuments: demo.listDocuments,
      uploadDocument: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    render(<AdminKB service={service} />);
    await screen.findByText('Правила стоп-факторов', { selector: '.kb__doc-title' });
    await openForm(user);
    await user.upload(screen.getByLabelText('Файл документа'), pdf());
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось опубликовать документ. Попробуйте ещё раз.');
    expect(screen.getByRole('form', { name: 'Новый документ' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('недоступные вкладки программ нельзя выбрать', async () => {
    const user = userEvent.setup();
    render(<AdminKB service={demoService(HASH_NEW)} />);
    const tab = screen.getByRole('tab', { name: 'Старт-1 · скоро' });
    await user.click(tab);
    expect(tab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Студенческий стартап' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('данные базы знаний', () => {
  it('статус: «Действует», «Архив» и дата будущей редакции', () => {
    expect(kbStatusLabel({ status: 'active', validFrom: '2026-01-01' })).toBe('Действует');
    expect(kbStatusLabel({ status: 'archive', validFrom: '2025-03-01' })).toBe('Архив');
    expect(kbStatusLabel({ status: 'scheduled', validFrom: '2026-12-01' })).toBe('С 1 декабря');
  });

  it('форматы даты и хеша', () => {
    expect(formatRuDate('2026-12-01')).toBe('01.12.2026');
    expect(shortHash(HASH_EXISTING)).toBe('a41c…02fe');
  });

  it('демо-сервис: дубль по хешу отклоняется, новая редакция появляется первой', async () => {
    const service = createDemoKbService({ hashFile: async () => HASH_NEW, today: '2026-11-12' });
    const first = await service.uploadDocument({
      programId: 'studstartup',
      type: 'regulation',
      version: '1.1',
      validFrom: '2026-12-01',
      file: pdf(),
    });
    expect(first.ok).toBe(true);
    const again = await service.uploadDocument({
      programId: 'studstartup',
      type: 'regulation',
      version: '1.1',
      validFrom: '2026-12-01',
      file: pdf(),
    });
    expect(again).toEqual({ ok: false, reason: 'duplicate_hash' });
    const list = await service.listDocuments('studstartup');
    expect(list).toHaveLength(6);
    expect(list[0]?.key).toBe('kb/fasie/studstartup/reg_v1.1.pdf');
  });

  it('демо-сервис: будущая редакция не вытесняет действующую — статус вычисляется по дате', async () => {
    const service = createDemoKbService({ hashFile: async () => HASH_NEW, today: '2026-11-12' });
    await service.uploadDocument({
      programId: 'studstartup',
      type: 'regulation',
      version: '1.1',
      validFrom: '2026-12-01',
      file: pdf(),
    });
    const list = await service.listDocuments('studstartup');
    expect(list.find((d) => d.id === 'doc-reg-1-0')?.status).toBe('active');
    expect(list.find((d) => d.id === 'doc-reg-0-9')?.status).toBe('archive');
    expect(list.find((d) => d.key === 'kb/fasie/studstartup/reg_v1.1.pdf')?.status).toBe('scheduled');
    // Другой тип той же программы остаётся действующим.
    expect(list.find((d) => d.id === 'doc-questions-1-0')?.status).toBe('active');
  });

  it('демо-сервис: редакция с датой сегодня или раньше вытесняет прежнюю в «Архив»', async () => {
    for (const validFrom of ['2026-11-12', '2026-10-01']) {
      const service = createDemoKbService({ hashFile: async () => HASH_NEW, today: '2026-11-12' });
      await service.uploadDocument({
        programId: 'studstartup',
        type: 'regulation',
        version: '1.1',
        validFrom,
        file: pdf(),
      });
      const list = await service.listDocuments('studstartup');
      expect(list.find((d) => d.id === 'doc-reg-1-0')?.status).toBe('archive');
      expect(list.find((d) => d.key === 'kb/fasie/studstartup/reg_v1.1.pdf')?.status).toBe('active');
    }
  });

  it('демо-сервис: при следующей дате статус меняется без новых загрузок (тот же список, другой день)', async () => {
    const before = resolveKbStatuses(DEMO_KB_RECORDS, '2026-11-12');
    const after = resolveKbStatuses(
      [{ ...DEMO_KB_RECORDS[0]!, id: 'doc-reg-2-0', version: '2.0', validFrom: '2026-12-01', hash: 'zz00…zz00' }, ...DEMO_KB_RECORDS],
      '2026-12-01',
    );
    expect(before.find((d) => d.id === 'doc-reg-1-0')?.status).toBe('active');
    expect(after.find((d) => d.id === 'doc-reg-1-0')?.status).toBe('archive');
    expect(after.find((d) => d.id === 'doc-reg-2-0')?.status).toBe('active');
  });

  it('resolveKbStatuses: будущая дата — «scheduled»; вступившие в силу — «active» или «archive»; при равной дате выигрывает первая запись', () => {
    const base: KbDocRecord = {
      id: 'x', programId: 'studstartup', title: 't', key: 'k', type: 'regulation', version: '1',
      validFrom: '2026-01-01', hash: 'h',
    };
    const future = resolveKbStatuses([{ ...base, id: 'f', validFrom: '2026-12-01' }, base], '2026-11-12');
    expect(future.map((d) => d.status)).toEqual(['scheduled', 'active']);

    const tie = resolveKbStatuses(
      [{ ...base, id: 'a', validFrom: '2026-03-01' }, { ...base, id: 'b', validFrom: '2026-03-01' }],
      '2026-11-12',
    );
    expect(tie.map((d) => d.status)).toEqual(['active', 'archive']);
  });

  it('правило файла: PDF и DOCX допустимы, JSON и прочие — нет; предел 50 МБ включительно', () => {
    expect(kbFileError({ name: 'reg.pdf', size: 1 })).toBeNull();
    expect(kbFileError({ name: 'REG.DOCX', size: 1 })).toBeNull();
    expect(kbFileError({ name: 'questions.json', size: 1 })).toBe('Допустимы только PDF и DOCX');
    expect(kbFileError({ name: 'reg.doc', size: 1 })).toBe('Допустимы только PDF и DOCX');
    expect(kbFileError({ name: 'reg.pdf', size: KB_MAX_FILE_BYTES })).toBeNull();
    expect(kbFileError({ name: 'reg.pdf', size: KB_MAX_FILE_BYTES + 1 })).toBe(
      'Файл больше 50 МБ. Загрузите файл меньшего размера.',
    );
  });
});
