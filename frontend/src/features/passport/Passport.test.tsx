import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Passport } from './Passport';

function renderPassport() {
  return render(
    <MemoryRouter>
      <Passport />
    </MemoryRouter>,
  );
}

// Статья поля паспорта по заголовку блока (h3).
function field(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Утверждение' });
}

describe('Passport', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderPassport();
    expect(screen.getByRole('heading', { level: 1, name: 'Паспорт проекта' })).toBeInTheDocument();
    expect(screen.getByText('На проверке')).toBeInTheDocument();
    expect(screen.getByText('Сохранено 2 минуты назад')).toBeInTheDocument();
  });

  it('шапка: кнопки экспорта и переход к итогу', () => {
    renderPassport();
    expect(screen.getByRole('button', { name: 'DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Итог проверки' })).toHaveAttribute('href', '/result');
  });

  it('легенда обозначений из пяти пунктов', () => {
    renderPassport();
    const legend = screen.getByRole('list', { name: 'Обозначения' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Факт с документом', 'Факт без документа', 'План', 'Гипотеза', 'Со слов команды',
    ]);
  });

  it('навигация по блокам 1–10; по умолчанию открыт блок 7', () => {
    renderPassport();
    const nav = screen.getByRole('navigation', { name: 'Блоки паспорта' });
    const items = within(nav).getAllByRole('button');
    expect(items.map((b) => b.querySelector('.passport__nav-label')?.textContent)).toEqual([
      'Основатель', 'Команда', 'Проблема', 'Продукт', 'Стадия',
      'Аналоги', 'Рынок', 'Юрлица', 'Права и РИД', 'Поддержка',
    ]);
    expect(screen.getByText('Блок 7')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Рынок, бизнес-модель, продажи и пилоты' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Рынок/ })).toHaveAttribute('aria-current', 'true');
  });

  it('переход между блоками переключает заголовок и текущий пункт', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Команда/ }));
    expect(screen.getByText('Блок 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Команда, роли, компетенции и опыт' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Команда/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Рынок/ })).toHaveAttribute('aria-current', 'false');
  });

  it('блок 1 — только чтение из профиля: данные основателя и ссылка в профиль', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Основатель/ }));
    expect(screen.getByText('Иванов Иван Иванович')).toBeInTheDocument();
    expect(screen.getByText('ivan@university.ru')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Изменить в профиле' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('button', { name: 'Править' })).not.toBeInTheDocument();
  });

  it('по умолчанию панель показывает выбранное утверждение «две фокус-группы»', () => {
    renderPassport();
    const p = panel();
    expect(within(p).getByText('Факт без документа')).toBeInTheDocument();
    expect(within(p).getByText('«две фокус-группы по 25 участников»')).toBeInTheDocument();
    expect(within(p).getByText('Документа нет. Эксперт фонда попросит подтверждение: протокол, акт, выписку или материалы исследования.')).toBeInTheDocument();
    expect(within(p).getByText('Комментарий к материалам')).toBeInTheDocument();
    expect(within(p).getByText('Уверенность ИИ в типе: 84%')).toBeInTheDocument();
  });

  it('клик по утверждению открывает панель с источником и цитатой', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('link', { name: 'выручку 10 000 рублей' }));
    const p = panel();
    expect(within(p).getByText('Факт с документом')).toBeInTheDocument();
    expect(within(p).getByText('Monetrix_presentation_02.11.pdf')).toBeInTheDocument();
    expect(within(p).getByText('Страница 10')).toBeInTheDocument();
    expect(within(p).getByText('«Выручка: 10 000 ₽»')).toBeInTheDocument();
    expect(within(p).getByText('Уверенность ИИ в типе: 92%')).toBeInTheDocument();
  });

  it('смена типа утверждения меняет подсветку и подпись в панели', async () => {
    const user = userEvent.setup();
    renderPassport();
    const claim = screen.getByRole('link', { name: 'две фокус-группы по 25 участников' });
    expect(claim).toHaveAttribute('data-kind', 'nodoc');

    const types = within(panel()).getByRole('group', { name: 'Тип сведений' });
    expect(within(types).getByRole('button', { name: 'Факт' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(types).getByRole('button', { name: 'План' }));

    expect(within(types).getByRole('button', { name: 'План' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(types).getByRole('button', { name: 'Факт' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel()).getByText('План', { selector: 'span' })).toBeInTheDocument();
    expect(claim).toHaveAttribute('data-kind', 'plan');
    expect(within(panel()).getByText(/План не считается достижением\./)).toBeInTheDocument();
  });

  it('режим эксперта приглушает всё, кроме рисков; выключение возвращает подсветку', async () => {
    const user = userEvent.setup();
    renderPassport();
    const toggle = screen.getByRole('button', { name: 'Глазами эксперта' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    const fact = screen.getByRole('link', { name: 'выручку 10 000 рублей' });   // факт с документом
    const plan = screen.getByRole('link', { name: 'В 2027 году планируются три платных пилота по 250 000 рублей' });
    const risk = screen.getByRole('link', { name: 'две фокус-группы по 25 участников' }); // факт без документа

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(fact).toHaveClass('passport-claim--muted');
    expect(plan).toHaveClass('passport-claim--muted');
    expect(risk).not.toHaveClass('passport-claim--muted');
    expect(risk).toHaveClass('passport-claim--risk');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(fact).not.toHaveClass('passport-claim--muted');
    expect(risk).not.toHaveClass('passport-claim--risk');
  });

  it('согласование: кнопка «Согласовать» переводит поле в «Согласовано»', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Проблема/ }));
    const audience = field('Целевая аудитория');
    expect(within(audience).getByText('Подтверждено')).toBeInTheDocument();
    await user.click(within(audience).getByRole('button', { name: 'Согласовать' }));
    expect(within(audience).getByText('Согласовано')).toBeInTheDocument();
    expect(within(audience).queryByText('Подтверждено')).not.toBeInTheDocument();
    expect(within(audience).queryByRole('button', { name: 'Согласовать' })).not.toBeInTheDocument();
  });

  it('поле «Нужна проверка» нельзя согласовать', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Аналоги/ }));
    const analogues = field('Сравнение с аналогами');
    expect(within(analogues).getByText('Нужна проверка')).toBeInTheDocument();
    expect(within(analogues).queryByRole('button', { name: 'Согласовать' })).not.toBeInTheDocument();
    expect(within(analogues).getByText(/проверка новизны пропущена после двух попыток/)).toBeInTheDocument();
  });

  it('правка согласованного поля предупреждает о снятии согласования и снимает его после сохранения', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Права и РИД/ }));
    const rid = field('Документы на РИД');
    expect(within(rid).getByText('Согласовано')).toBeInTheDocument();

    await user.click(within(rid).getByRole('button', { name: 'Править' }));
    expect(within(rid).getByText('Поле согласовано. Правка снимет согласование.')).toBeInTheDocument();
    expect(within(rid).getByRole('textbox')).toBeInTheDocument();

    await user.click(within(rid).getByRole('button', { name: 'Сохранить' }));
    expect(within(rid).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(rid).queryByText('Согласовано')).not.toBeInTheDocument();
    expect(within(rid).getByRole('button', { name: 'Править' })).toBeInTheDocument();
  });

  it('отмена правки закрывает редактор без изменений', async () => {
    const user = userEvent.setup();
    renderPassport();
    await user.click(screen.getByRole('button', { name: /Команда/ }));
    const competencies = field('Компетенции и опыт');
    await user.click(within(competencies).getByRole('button', { name: 'Править' }));
    expect(within(competencies).getByRole('textbox')).toBeInTheDocument();
    await user.click(within(competencies).getByRole('button', { name: 'Отмена' }));
    expect(within(competencies).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(competencies).getByText(/Опыт продуктовой аналитики в финтехе — 2 года/)).toBeInTheDocument();
  });

  it('правка «Продажи и пилоты»: потерянная привязка, удаление и возврат прежнего текста', async () => {
    const user = userEvent.setup();
    renderPassport();
    const traction = field('Продажи и пилоты');
    await user.click(within(traction).getByRole('button', { name: 'Править' }));
    await user.click(within(traction).getByRole('button', { name: 'Сохранить' }));

    // После сохранения поле «Нужна проверка», утверждение «две фокус-группы» потеряло привязку.
    expect(within(traction).getByText('Нужна проверка')).toBeInTheDocument();
    const alert = within(traction).getByRole('alert');
    expect(within(alert).getByText('1 утверждение потеряло привязку к тексту')).toBeInTheDocument();
    // Выбранное утверждение сброшено: панель в исходном состоянии.
    expect(screen.getByText('Нажмите на выделенный фрагмент текста — здесь появятся тип, источник и действия.')).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Удалить утверждение' }));
    expect(within(traction).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(traction).getByText(/Команда получила/)).toBeInTheDocument();

    // Снова правка → алерт → возврат прежнего текста снимает правку целиком.
    await user.click(within(traction).getByRole('button', { name: 'Править' }));
    await user.click(within(traction).getByRole('button', { name: 'Сохранить' }));
    await user.click(within(traction).getByRole('button', { name: 'Вернуть прежний текст' }));
    expect(within(traction).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(traction).queryByText('Нужна проверка')).not.toBeInTheDocument();
    expect(within(traction).getByText('Плановые продажи хранятся как план и не попадут в достижения.')).toBeInTheDocument();
  });
});
