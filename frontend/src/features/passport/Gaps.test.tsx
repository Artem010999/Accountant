import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Gaps } from './Gaps';

const MVP_QUESTION = 'Какие функции демонстрируются в актуальном MVP и какая сейчас стадия разработки?';
const OWNER_QUESTION = 'Кто правообладатель программы «Монетрикс» (№ 2026618524) и совпадает ли он с заявителем?';
const MVP_GOOD = 'В MVP версии 0.3 работают финансовый профиль и ручной ввод операций. Импорт выписок и сценарные расчёты планируются на первом этапе гранта.';

function renderGaps() {
  return render(
    <MemoryRouter>
      <Gaps />
    </MemoryRouter>,
  );
}

function gapButton(title: string) {
  return screen.getByRole('button', { name: new RegExp(title) });
}

describe('Gaps', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderGaps();
    expect(screen.getByRole('heading', { level: 1, name: 'Закроем пробелы' })).toBeInTheDocument();
    expect(screen.getByText('Без этих сведений паспорт не пройдёт проверку программы.')).toBeInTheDocument();
    expect(screen.getByText('Закрыто 2 из 5')).toBeInTheDocument();
  });

  it('список пробелов: пять пунктов со статусами, текущий помечен aria-current="step"', () => {
    renderGaps();
    const list = screen.getByRole('list', { name: 'Список пробелов' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getAllByText('Закрыт')).toHaveLength(2);
    expect(within(list).getAllByText('Ожидает ответа')).toHaveLength(2);
    expect(within(list).getByText('Нужно 2 аналога')).toBeInTheDocument();
    expect(gapButton('Что работает в MVP')).toHaveAttribute('aria-current', 'step');
    expect(gapButton('Юридическое лицо')).toHaveAttribute('aria-current', 'false');
  });

  it('по умолчанию открыт первый незакрытый вопрос с текстом в поле ответа', () => {
    renderGaps();
    expect(screen.getByRole('heading', { level: 2, name: MVP_QUESTION })).toBeInTheDocument();
    expect(screen.getByText('Что проверяет фонд:')).toBeInTheDocument();
    expect(screen.getByLabelText('Ваш ответ')).toHaveValue('Ну MVP уже есть, всё работает.');
    expect(screen.getByRole('button', { name: 'Отправить ответ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Вернуться позже' })).toHaveAttribute('href', '/passport');
  });

  it('выбор пробела в списке переключает карточку вопроса', async () => {
    renderGaps();
    await userEvent.click(gapButton('Правообладатель'));
    expect(screen.getByRole('heading', { level: 2, name: OWNER_QUESTION })).toBeInTheDocument();
    expect(screen.getByLabelText('Ваш ответ')).toHaveValue('Наши права.');
    expect(gapButton('Правообладатель')).toHaveAttribute('aria-current', 'step');
  });

  it('отказ валидатора: причина в alert, в поле подставляется пример, отправка остаётся доступной', async () => {
    renderGaps();
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ответ пока не закрывает вопрос.');
    expect(alert).toHaveTextContent('Уточните, какие именно функции работают сейчас и какая версия. Фраза «всё работает» не проверяема.');
    expect(alert).toHaveTextContent('Мы подставили пример исправленного ответа.');
    expect(screen.getByLabelText('Ваш ответ')).toHaveValue(MVP_GOOD);
    expect(screen.getByRole('button', { name: 'Отправить ответ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Следующий вопрос' })).not.toBeInTheDocument();
  });

  it('принятый ответ: запись в паспорт и переход к следующему пробелу', async () => {
    renderGaps();
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Записано в паспорт')).toBeInTheDocument();
    expect(screen.getByText('В MVP версии 0.3 работают финансовый профиль и ручной ввод операций')).toBeInTheDocument();
    expect(screen.getByText('Серым — со слов команды, без документа. Синим — план. Тип можно поменять в паспорте.')).toBeInTheDocument();
    expect(screen.getByText('Закрыто 3 из 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить ответ' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Следующий вопрос' }));
    expect(screen.getByRole('heading', { level: 2, name: OWNER_QUESTION })).toBeInTheDocument();
    expect(gapButton('Что работает в MVP')).toHaveTextContent('Закрыт');
  });

  it('новизна: форма сравнения с аналогами и первая попытка', async () => {
    renderGaps();
    await userEvent.click(gapButton('Сравнение с аналогами'));

    expect(screen.getByRole('heading', { level: 2, name: 'Нужно сравнение минимум с двумя аналогами' })).toBeInTheDocument();
    expect(screen.getByText('Попытка 1 из 2')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Аналог' })).toBeInTheDocument();
    expect(screen.getByLabelText('Аналог 1')).toHaveValue('Приложение учёта расходов');
    expect(screen.getByLabelText('Аналог 2')).toHaveAttribute('placeholder', 'Название');
    expect(screen.getByLabelText('Как измерите отличие?')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Продолжить без сравнения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('новизна: после двух попыток доступны «Продолжить без сравнения» и уведомление', async () => {
    renderGaps();
    await userEvent.click(gapButton('Сравнение с аналогами'));
    await userEvent.click(screen.getByRole('button', { name: 'Проверить сравнение' }));
    expect(screen.getByText('Попытка 2 из 2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Продолжить без сравнения' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Проверить сравнение' }));
    expect(screen.getByRole('link', { name: 'Продолжить без сравнения' })).toHaveAttribute('href', '/result');
    expect(screen.getByRole('status')).toHaveTextContent('Сравнение всё ещё неполное.');
    expect(screen.getByText('На тарифе «Базовый» этот шаг пропускается, а в чек-листе появляется пометка о непроверенной новизне.')).toBeInTheDocument();
  });
});
