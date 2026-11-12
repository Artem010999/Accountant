import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Profile, type ProfileData } from './Profile';

function renderProfile(initial?: ProfileData) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Profile initial={initial} />
    </MemoryRouter>,
  );
}

async function startEdit() {
  await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
}

describe('Profile', () => {
  it('рендерит заголовок, подзаголовок и данные основателя из дизайна', () => {
    renderProfile();
    expect(screen.getByRole('heading', { level: 1, name: 'Профиль' })).toBeInTheDocument();
    expect(
      screen.getByText('Данные основателя. Они попадают в блок 1 паспорта как есть: ИИ их не меняет.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Иванов Иван Иванович')).toBeInTheDocument();
    expect(screen.getByText('ivan@university.ru · аккаунт с 02.11.2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ошибка в ФИО? Напишите в поддержку' })).toHaveAttribute('href', '/support');
  });

  it('ФИО закреплено за проектом: замок с пояснением, поля ФИО для правки нет', async () => {
    renderProfile();
    expect(screen.getByText('закреплено за проектом')).toBeInTheDocument();
    expect(screen.getByText('Один аккаунт — один проект. ФИО и проект закреплены друг за другом.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/ФИО/)).not.toBeInTheDocument();

    await startEdit();
    expect(screen.queryByLabelText(/ФИО/)).not.toBeInTheDocument();
    expect(screen.getByText('Иванов Иван Иванович')).toBeInTheDocument();
    expect(screen.getByText('закреплено за проектом')).toBeInTheDocument();
  });

  it('режим просмотра: строки телефона, Telegram, обучения и региона', () => {
    renderProfile();
    expect(screen.getByText('+7 916 123-45-67')).toBeInTheDocument();
    expect(screen.getByText('@ivan_monetrix')).toBeInTheDocument();
    expect(screen.getByText('НИУ «Высшая школа экономики» · бакалавриат, 3 курс')).toBeInTheDocument();
    expect(screen.getByText('Москва')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Телефон/)).not.toBeInTheDocument();
  });

  it('режим правки: поля, чекбокс обучения, кнопки «Отмена» и «Сохранить»', async () => {
    renderProfile();
    await startEdit();

    expect(screen.getByLabelText(/^Телефон/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Telegram')).toHaveValue('@ivan_monetrix');
    expect(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/^Вуз/)).toHaveValue('НИУ «Высшая школа экономики»');
    expect(screen.getByLabelText(/^Уровень/)).toHaveValue('Бакалавриат');
    expect(screen.getByLabelText(/^Курс/)).toHaveValue('3');
    expect(screen.getByLabelText(/^Регион/)).toHaveValue('Москва');
    expect(screen.getByText('— обязательные поля', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
  });

  it('уровень обучения и курс — списки с вариантами из дизайна', async () => {
    renderProfile();
    await startEdit();
    const level = screen.getByLabelText(/^Уровень/);
    expect(within(level).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Бакалавриат',
      'Специалитет',
      'Магистратура',
      'Аспирантура',
    ]);
    expect(within(screen.getByLabelText(/^Курс/)).getAllByRole('option')).toHaveLength(6);
    expect(within(screen.getByLabelText(/^Регион/)).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Москва',
      'Санкт-Петербург',
      'Республика Татарстан',
    ]);
  });

  it('валидация: пустой телефон не сохраняется, поле помечено aria-invalid', async () => {
    renderProfile();
    await startEdit();
    await userEvent.clear(screen.getByLabelText(/^Телефон/));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByLabelText(/^Телефон/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Сохранено.', { exact: false })).not.toBeInTheDocument();
  });

  it('валидация: при обучении вуз обязателен', async () => {
    renderProfile();
    await startEdit();
    await userEvent.clear(screen.getByLabelText(/^Вуз/));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByLabelText(/^Вуз/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Сохранено.', { exact: false })).not.toBeInTheDocument();
  });

  it('ошибка под полем телефона: текст появляется при сохранении и исчезает после ввода', async () => {
    renderProfile();
    await startEdit();
    const phone = screen.getByLabelText(/^Телефон/);
    await userEvent.clear(phone);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByText('Укажите телефон.')).toBeInTheDocument();
    expect(phone).toHaveAccessibleDescription('Укажите телефон.');
    expect(phone).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(phone, '+7 900 000-00-00');
    expect(screen.queryByText('Укажите телефон.')).not.toBeInTheDocument();
    expect(phone).not.toHaveAttribute('aria-invalid');
  });

  it('ошибка под полем вуза: текст при пустом вузе, исчезает после ввода', async () => {
    renderProfile();
    await startEdit();
    const uni = screen.getByLabelText(/^Вуз/);
    await userEvent.clear(uni);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByText('Укажите вуз.')).toBeInTheDocument();
    expect(uni).toHaveAccessibleDescription('Укажите вуз.');

    await userEvent.type(uni, 'МГУ');
    expect(screen.queryByText('Укажите вуз.')).not.toBeInTheDocument();
  });

  it('ошибка не появляется, если поле вуза скрыто (не учусь)', async () => {
    renderProfile();
    await startEdit();
    await userEvent.clear(screen.getByLabelText(/^Телефон/));
    await userEvent.type(screen.getByLabelText(/^Телефон/), '+7 900 000-00-00');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.queryByText('Укажите вуз.')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено.');
  });

  it('сохранение: режим просмотра с новыми значениями и баннер «Сохранено» со ссылкой на паспорт', async () => {
    renderProfile();
    await startEdit();
    const telegram = screen.getByLabelText('Telegram');
    await userEvent.clear(telegram);
    await userEvent.type(telegram, '@new_handle');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Сохранено. Блок 1 паспорта обновлён.');
    expect(within(banner).getByRole('link', { name: 'Открыть паспорт' })).toHaveAttribute('href', '/passport');
    expect(screen.getByText('@new_handle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
  });

  it('отмена: правки отбрасываются, студенческий статус возвращается к сохранённому', async () => {
    renderProfile();
    await startEdit();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' }));
    expect(screen.getByText('Для «Студенческого стартапа» нужно учиться в вузе. Сохранить можно, но итоговая проверка покажет предупреждение.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.getByText('НИУ «Высшая школа экономики» · бакалавриат, 3 курс')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('не учусь: предупреждение «Для «Студенческого стартапа»…», поля вуза скрыты, сохранение разрешено', async () => {
    renderProfile();
    await startEdit();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' }));

    expect(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText(/^Вуз/)).not.toBeInTheDocument();
    expect(screen.getByText('Для «Студенческого стартапа» нужно учиться в вузе. Сохранить можно, но итоговая проверка покажет предупреждение.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByText('Сейчас не учусь — не подходит для программы')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено.');
  });

  it('блоки «Программа» и «Проект» с текстами из дизайна', () => {
    renderProfile();
    expect(screen.getByText('Студенческий стартап')).toBeInTheDocument();
    expect(screen.getByText('ФСИ · грант для студентов и аспирантов. «Старт-1» и Сколково появятся позже.')).toBeInTheDocument();
    expect(screen.getByText('Monetrix')).toBeInTheDocument();
  });
});
