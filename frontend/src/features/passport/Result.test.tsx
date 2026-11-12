import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Result } from './Result';

const STOP_TEXT = 'Новизна не подтверждена: указан 1 аналог из 2, нет измеримого отличия.';
const WARNING_TEXT = 'Проверка новизны пропущена после двух попыток.';
const NO_STOPS_TEXT = 'Формальных стоп-факторов не найдено';

function renderResult() {
  return render(
    <MemoryRouter>
      <Result />
    </MemoryRouter>,
  );
}

describe('Result', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderResult();
    expect(screen.getByRole('heading', { level: 1, name: 'Итог проверки' })).toBeInTheDocument();
    expect(screen.getByText('«Студенческий стартап» · проверено 8 ноября 2026 в 14:20')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Вариант статуса для прототипа' })).toBeInTheDocument();
  });

  it('по умолчанию — «Нужно уточнить»: стоп-факторов нет, три предупреждения', () => {
    renderResult();
    expect(screen.getByRole('heading', { level: 2, name: 'Нужно уточнить' })).toBeInTheDocument();
    expect(screen.getByText(NO_STOPS_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(STOP_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
    expect(screen.getByText('В паспорте 3 факта без подтверждающих документов.')).toBeInTheDocument();
  });

  it('вариант «Допуск»: можно готовить заявку, предупреждений нет', async () => {
    renderResult();
    await userEvent.click(screen.getByRole('button', { name: 'Допуск' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Можно готовить заявку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Допуск' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(NO_STOPS_TEXT)).toBeInTheDocument();
  });

  it('вариант «Стоп»: два стоп-фактора со ссылками на блоки, без пометки «не найдено»', async () => {
    renderResult();
    await userEvent.click(screen.getByRole('button', { name: 'Стоп' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Есть стоп-факторы' })).toBeInTheDocument();
    expect(screen.getByText(STOP_TEXT)).toBeInTheDocument();
    expect(screen.getByText('Правообладатель РИД не совпадает с заявителем, порядок передачи прав не указан.')).toBeInTheDocument();
    expect(screen.queryByText(NO_STOPS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it('чек-лист: счётчик и отметка пунктов', async () => {
    renderResult();
    expect(screen.getByText('Сделано 1 из 5')).toBeInTheDocument();
    const second = screen.getByRole('checkbox', { name: 'Приложить материалы двух фокус-групп и подтверждение выручки 10 000 ₽' });
    expect(second).not.toBeChecked();

    await userEvent.click(second);
    expect(second).toBeChecked();
    expect(screen.getByText('Сделано 2 из 5')).toBeInTheDocument();

    await userEvent.click(second);
    expect(second).not.toBeChecked();
    expect(screen.getByText('Сделано 1 из 5')).toBeInTheDocument();
  });

  it('согласование паспорта: кнопка заменяется отметкой о согласовании', async () => {
    renderResult();
    expect(screen.getByText(/Любая правка потом снимет согласование/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Согласовать паспорт' }));
    expect(screen.getByText('Согласован 8 ноября, версия 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Согласовать паспорт' })).not.toBeInTheDocument();
  });

  it('ссылки ведут на маршруты дизайна: перепроверка — генерация, разделы — паспорт', () => {
    renderResult();
    expect(screen.getByRole('link', { name: 'Проверить заново' })).toHaveAttribute('href', '/generating');
    expect(screen.getByRole('link', { name: 'Открыть паспорт' })).toHaveAttribute('href', '/passport');
    expect(screen.getAllByRole('link', { name: 'Блок 6' })[0]).toHaveAttribute('href', '/passport');
  });

  it('кнопки скачивания из дизайна присутствуют', () => {
    renderResult();
    expect(screen.getByRole('button', { name: 'Скачать DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать PDF' })).toBeInTheDocument();
    expect(screen.getByText('Скачивание не означает подачу. Заявка подаётся в системе фонда.')).toBeInTheDocument();
  });
});
