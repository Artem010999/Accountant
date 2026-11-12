import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Files, type FilesProps } from './Files';
import type { FilesApi, UploadStatus } from './Files.model';

function renderFiles(props: FilesProps = {}) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Files plan="pro" {...props} />  {/* тесты сверяют эталон дизайна (тариф «Профессиональный», 10 файлов); по умолчанию — премиум, см. Files.default-plan.test.tsx */}
    </MemoryRouter>,
  );
}

function pdf(name: string, content: string) {
  return new File([content], name, { type: 'application/pdf' });
}

function apiReturning(status: UploadStatus): FilesApi {
  return { upload: async () => ({ status }) };
}

function pickInput() {
  return screen.getByLabelText('Файлы для загрузки') as HTMLInputElement;
}

function counter() {
  return screen.getByRole('progressbar', { name: 'Использовано файлов' });
}

function rowNames() {
  return screen.queryAllByRole('row').filter((r) => r.className.includes('files__row--item'));
}

/** Добавляет файлы по одному, пока счётчик не станет равен target (стартуем с трёх файлов из дизайна). */
async function fillTo(user: ReturnType<typeof userEvent.setup>, target: number) {
  for (let i = 3; i < target; i += 1) {
    await user.upload(pickInput(), pdf(`Файл-${i}.pdf`, `content-${i}`));
    await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', String(i + 1)));
  }
}

describe('Files', () => {
  it('рендерит заголовок, лимиты и три файла из дизайна', () => {
    renderFiles();
    expect(screen.getByRole('heading', { level: 1, name: 'Материалы проекта' })).toBeInTheDocument();
    expect(screen.getByText('Всё, из чего Буха собирает паспорт. Каждый факт в паспорте ссылается на файл и страницу отсюда.')).toBeInTheDocument();
    expect(counter()).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('из 10')).toBeInTheDocument();
    expect(screen.getByText('Monetrix_presentation_02.11.pdf')).toBeInTheDocument();
    expect(screen.getByText('Svidetelstvo_RID_scan.pdf')).toBeInTheDocument();
    expect(screen.getByText('Biznes-plan_Monetrix.docx')).toBeInTheDocument();
    expect(screen.getByText('Скан распознан · 3 утверждения')).toBeInTheDocument();
    expect(screen.getByText('18 утверждений')).toBeInTheDocument();
  });

  it('по умолчанию загрузка доступна: инлайн-карточек о тарифе и лимите нет', () => {
    renderFiles();
    expect(screen.getByText('Перетащите файлы сюда или', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Загрузка документов — на платном тарифе' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Лимит файлов исчерпан/ })).not.toBeInTheDocument();
  });

  it('загрузка нового файла добавляет строку «Разбираем…», растит счётчик и показывает тост', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'pismo-1'));
    await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', '4'));
    expect(screen.getByText('Разбираем…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pismo_o_pilote.pdf загружен. Буха разбирает его — новые факты появятся в паспорте через пару минут.',
    );
  });

  it('тот же файл по sha256 не добавляется: «уже загружен»', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'same-bytes'));
    await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', '4'));
    await user.upload(pickInput(), pdf('Копия.pdf', 'same-bytes'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Копия.pdf уже загружен — повторно не разбираем и в лимит не считаем.',
      ),
    );
    expect(counter()).toHaveAttribute('aria-valuenow', '4');
  });

  it('файл с тем же именем, но другим хешем сохраняется как новый источник', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'version-a'));
    await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', '4'));
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'version-b'));
    await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', '5'));
    expect(screen.getAllByText('Pismo_o_pilote.pdf')).toHaveLength(2);
  });

  it('лимит 10 файлов: одиннадцатый отклоняется с сообщением о лимите (429)', async () => {
    const user = userEvent.setup();
    renderFiles();
    for (let i = 1; i <= 7; i += 1) {
      await user.upload(pickInput(), pdf(`Файл-${i}.pdf`, `content-${i}`));
      await waitFor(() => expect(counter()).toHaveAttribute('aria-valuenow', String(3 + i)));
    }
    await user.upload(pickInput(), pdf('Лишний.pdf', 'content-extra'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Лимит файлов исчерпан. Удалите ненужный файл или перейдите на «Премиум».',
      ),
    );
    expect(counter()).toHaveAttribute('aria-valuenow', '10');
    expect(screen.queryByText('Лишний.pdf')).not.toBeInTheDocument();
  });

  it('429 от данных: при 10 из 10 появляется карточка «Лимит файлов исчерпан» с переходом на тарифы', async () => {
    const user = userEvent.setup();
    renderFiles();
    await fillTo(user, 10);
    const notice = screen.getByRole('region', { name: 'Лимит файлов исчерпан: 10 из 10' });
    expect(within(notice).getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/billing');
    expect(within(notice).getByText('Повторно загруженные копии в лимит не считаются.', { exact: false })).toBeInTheDocument();
  });

  it('тариф «Премиум»: лимит 50 из данных тарифа, карточки лимита нет при меньшем числе файлов', () => {
    renderFiles({ plan: 'premium' });
    expect(screen.getByText('из 50')).toBeInTheDocument();
    expect(counter()).toHaveAttribute('aria-valuemax', '50');
    expect(screen.getByText('Тариф «Премиум»')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Нужно больше/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Лимит файлов исчерпан/ })).not.toBeInTheDocument();
  });

  it('пейволл Free (402) от сервера: тост с текстом тарифа и переходом на /billing', async () => {
    const user = userEvent.setup();
    renderFiles({ api: apiReturning('PLAN_UPGRADE_REQUIRED') });
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'free-plan'));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Загрузка документов — на платном тарифе');
    expect(within(status).getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/billing');
    expect(counter()).toHaveAttribute('aria-valuenow', '3');
  });

  it('402 при выключенной функции тарифа (имитация флага через props): карточка вместо зоны загрузки', async () => {
    const api = { upload: vi.fn(async () => ({ status: 'accepted' as const })) };
    const user = userEvent.setup();
    renderFiles({ api, aiParsingEnabled: false });

    const notice = screen.getByRole('region', { name: 'Загрузка документов — на платном тарифе' });
    expect(within(notice).getByText('На Базовом тарифе паспорт собирается по анкете. Чтобы разобрать презентацию и привязать факты к страницам, подключите «Профессиональный».')).toBeInTheDocument();
    expect(within(notice).getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/billing');
    expect(screen.queryByText('Перетащите файлы сюда или', { exact: false })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Добавить файлы' }));
    await user.upload(pickInput(), pdf('Pismo_o_pilote.pdf', 'free-plan'));
    expect(await screen.findByRole('status')).toHaveTextContent('Загрузка документов — на платном тарифе');
    expect(api.upload).not.toHaveBeenCalled();
    expect(counter()).toHaveAttribute('aria-valuenow', '3');
  });

  it('BLOCKED_PROJECT_SWAP: файл другого проекта не сохраняется; карточка ошибки закрывается', async () => {
    const user = userEvent.setup();
    renderFiles({ api: apiReturning('BLOCKED_PROJECT_SWAP') });
    await user.upload(pickInput(), pdf('Startup_X_pitch.pdf', 'other-project'));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Похоже, это материалы другого проекта.');
    expect(status).toHaveTextContent('Файл «Startup_X_pitch.pdf» не совпадает по смыслу с описанием Monetrix.');
    expect(counter()).toHaveAttribute('aria-valuenow', '3');
    expect(screen.queryByText('Startup_X_pitch.pdf')).not.toBeInTheDocument();

    const alert = screen.getByRole('alert', { name: 'Похоже, это материалы другого проекта' });
    expect(within(alert).getByText('Файл не сохранён: один аккаунт — один проект. Если это ошибка, напишите в поддержку.')).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('кнопка «Добавить файлы» открывает выбор файла', async () => {
    const user = userEvent.setup();
    renderFiles();
    const input = pickInput();
    const spy = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Добавить файлы' }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('«Открыть» показывает просмотр файла, «Закрыть» его убирает', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.click(screen.getAllByRole('button', { name: 'Открыть' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Просмотр файла' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Monetrix_presentation_02.11.pdf' })).toBeInTheDocument();
    expect(within(dialog).getByText('Буха нашла 18 утверждений')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Открыть факты в паспорте' })).toHaveAttribute('href', '/passport');
    await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Просмотр файла' })).not.toBeInTheDocument();
  });

  it('«Удалить» спрашивает подтверждение; «Оставить» не удаляет файл', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.click(screen.getAllByRole('button', { name: 'Удалить файл' })[0]);
    const dialog = screen.getByRole('alertdialog', { name: 'Удаление файла' });
    expect(dialog).toHaveTextContent('Monetrix_presentation_02.11.pdf пропадёт из материалов. 18 утверждений из него в паспорте останутся');
    await user.click(within(dialog).getByRole('button', { name: 'Оставить' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(rowNames()).toHaveLength(3);
  });

  it('подтверждённое удаление убирает файл и показывает тост со ссылкой на паспорт', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.click(screen.getAllByRole('button', { name: 'Удалить файл' })[0]);
    const dialog = screen.getByRole('alertdialog', { name: 'Удаление файла' });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить файл' }));
    expect(counter()).toHaveAttribute('aria-valuenow', '2');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Файл удалён. 18 утверждений остались без источника.');
    expect(within(status).getByRole('link', { name: 'Проверить в паспорте' })).toHaveAttribute('href', '/passport');
  });

  it('«Скачать файл» показывает тост «Скачивание началось.»', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.click(screen.getAllByRole('button', { name: 'Скачать файл' })[0]);
    expect(screen.getByRole('status')).toHaveTextContent('Скачивание началось.');
  });

  it('тост закрывается кнопкой «Закрыть»', async () => {
    const user = userEvent.setup();
    renderFiles();
    await user.click(screen.getAllByRole('button', { name: 'Скачать файл' })[0]);
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
