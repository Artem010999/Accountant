import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Onboarding } from './Onboarding';

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/brief" element={<h1>Есть материалы о проекте?</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Заполняет обязательные поля, которых нет в предзаполнении эталона.
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Телефон/), '+7 900 000-00-00');
  await user.type(screen.getByLabelText(/^Вуз/), 'МГУ');
  await user.selectOptions(screen.getByLabelText(/^Уровень/), 'Бакалавриат');
  await user.selectOptions(screen.getByLabelText(/^Курс/), '1');
  await user.selectOptions(screen.getByLabelText(/^Регион/), 'Москва');
}

describe('Onboarding', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderOnboarding();
    expect(screen.getByRole('heading', { level: 1, name: 'Расскажите о себе' })).toBeInTheDocument();
  });

  it('рендерит ключевые тексты эталона', () => {
    renderOnboarding();
    expect(screen.getByText('Блок 1 паспорта')).toBeInTheDocument();
    expect(screen.getByText('Программа поддержки')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Один аккаунт — один проект' })).toBeInTheDocument();
    expect(screen.getByText('После создания проекта ФИО можно изменить только через поддержку.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument();
  });

  it('предзаполняет ФИО значениями эталона', () => {
    renderOnboarding();
    expect(screen.getByLabelText(/^Фамилия/)).toHaveValue('Иванов');
    expect(screen.getByLabelText(/^Имя/)).toHaveValue('Иван');
    expect(screen.getByLabelText(/^Отчество/)).toHaveValue('Иванович');
  });

  it('программа «Студенческий стартап» выбрана, остальные отключены', () => {
    renderOnboarding();
    expect(screen.getByRole('button', { name: /Студенческий стартап/ })).toHaveAttribute('aria-pressed', 'true');
    const start1 = screen.getByText('Старт-1').closest('[aria-disabled]');
    expect(start1).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Сколково').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  });

  it('«Понятно» отмечено по умолчанию', () => {
    renderOnboarding();
    expect(screen.getByRole('checkbox', { name: 'Понятно' })).toBeChecked();
  });

  describe('сценарии полей', () => {
    it('«Нет отчества» отключает поле и очищает значение; повторный клик возвращает его', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      const toggle = screen.getByRole('checkbox', { name: 'Нет отчества' });
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      const middle = screen.getByLabelText('Отчество');
      expect(middle).toBeDisabled();
      expect(middle).toHaveAttribute('placeholder', 'Не указывается');
      expect(middle).toHaveValue('');
      expect(middle).not.toBeRequired();

      await user.click(toggle);
      expect(screen.getByLabelText(/^Отчество/)).toHaveValue('Иванович');
      expect(screen.getByLabelText(/^Отчество/)).toBeRequired();
    });

    it('«Учусь в настоящее время» показывает панель вуза; снятие отметки прячет её и показывает предупреждение', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      expect(screen.getByLabelText(/^Вуз/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Уровень/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Курс/)).toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' }));
      expect(screen.queryByLabelText(/^Вуз/)).not.toBeInTheDocument();
      const status = screen.getByRole('status');
      expect(within(status).getByText(/Продолжить можно, но это попадёт в предупреждения итоговой проверки\./)).toBeInTheDocument();
    });

    it('уровень и курс — обязательные списки с пустым значением по умолчанию', () => {
      renderOnboarding();
      expect(screen.getByLabelText(/^Уровень/)).toHaveValue('');
      expect(screen.getByLabelText(/^Курс/)).toHaveValue('');
      expect(screen.getByLabelText(/^Регион/)).toHaveValue('');
    });
  });

  describe('валидация и переход', () => {
    it('без обязательных полей («Телефон», вуз, уровень, курс, регион) переход на бриф не происходит', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await user.click(screen.getByRole('button', { name: 'Продолжить' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Расскажите о себе' })).toBeInTheDocument();
      expect(screen.getByLabelText(/^Телефон/)).toBeInvalid();
    });

    it('частично заполненная форма тоже не уходит дальше', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await user.type(screen.getByLabelText(/^Телефон/), '+7 900 000-00-00');
      await user.click(screen.getByRole('button', { name: 'Продолжить' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Расскажите о себе' })).toBeInTheDocument();
      expect(screen.getByLabelText(/^Регион/)).toBeInvalid();
    });

    it('с заполненными обязательными полями «Продолжить» ведёт на бриф', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await fillRequired(user);
      await user.click(screen.getByRole('button', { name: 'Продолжить' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
    });

    it('вне учёбы вуз не нужен: предупреждение не блокирует переход', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      await user.click(screen.getByRole('checkbox', { name: 'Учусь в настоящее время' }));
      await user.type(screen.getByLabelText(/^Телефон/), '+7 900 000-00-00');
      await user.selectOptions(screen.getByLabelText(/^Регион/), 'Москва');
      await user.click(screen.getByRole('button', { name: 'Продолжить' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
    });
  });
});
