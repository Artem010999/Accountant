import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Generating } from './Generating';

const TICK_MS = 1800;

function renderGenerating() {
  return render(
    <MemoryRouter initialEntries={['/generating']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Generating />
    </MemoryRouter>,
  );
}

// Один тик за один act: следующий таймер планируется эффектом React после коммита.
function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
  }
}

// Подпись активного шага (строка списка с модификатором --active).
function activeStepTitle(): string | null {
  const list = screen.getByRole('list', { name: 'Этапы сборки' });
  const active = list.querySelector('.gen-step--active .gen-step__title');
  return active?.textContent ?? null;
}

describe('Generating', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('рендерит заголовок экрана из дизайна', () => {
    renderGenerating();
    expect(screen.getByRole('heading', { level: 1, name: 'Буха читает материалы' })).toBeInTheDocument();
    expect(screen.getByText(/Обычно это занимает 2–4 минуты/)).toBeInTheDocument();
  });

  it('стартует с третьего шага «Распознаём документы»; шаги 1–2 завершены', () => {
    renderGenerating();
    expect(activeStepTitle()).toBe('Распознаём документы');
    expect(screen.getByText('Проверяем тариф и лимиты')).toBeInTheDocument();
    expect(screen.getByText('Ищем пробелы')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Найдено утверждений' })).toBeInTheDocument();
  });

  it('счётчики утверждений на старте: всего 7', () => {
    renderGenerating();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Факт с документом').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Со слов команды').nextElementSibling).toHaveTextContent('1');
  });

  it('каждые 1800 мс шаг продвигается, счётчики растут', () => {
    renderGenerating();
    tick();
    expect(activeStepTitle()).toBe('Раскладываем по блокам 2–10');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('после шести шагов экран показывает готовый черновик с переходами к пробелам и паспорту', () => {
    renderGenerating();
    tick(4);
    expect(screen.getByRole('heading', { level: 1, name: 'Черновик паспорта готов' })).toBeInTheDocument();
    expect(screen.getByText('Заполнено 7 блоков из 9. Осталось ответить на 5 вопросов — без них паспорт не пройдёт проверку.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ответить на вопросы' })).toHaveAttribute('href', '/gaps');
    expect(screen.getByRole('link', { name: 'Сначала посмотреть паспорт' })).toHaveAttribute('href', '/passport');
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Буха читает материалы' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Обычно это занимает/)).not.toBeInTheDocument();
  });

  it('переход не происходит дальше шести шагов', () => {
    renderGenerating();
    tick(10);
    expect(screen.getByRole('heading', { level: 1, name: 'Черновик паспорта готов' })).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  describe('состояние ошибки', () => {
    it('«Прототип: показать ошибку» выводит блок ошибки и останавливает шаги', () => {
      renderGenerating();
      fireEvent.click(screen.getByRole('button', { name: 'Прототип: показать ошибку' }));

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Не получилось разобрать блоки');
      expect(alert).toHaveTextContent('Сервис ИИ не ответил. Загруженные файлы сохранены, повтор ничего не потеряет.');
      expect(screen.getByRole('button', { name: 'Прототип: убрать ошибку' })).toBeInTheDocument();
      expect(activeStepTitle()).toBeNull();

      tick(3);
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Черновик паспорта готов' })).not.toBeInTheDocument();
    });

    it('«Повторить» снимает ошибку и сборка продолжается с того же шага', () => {
      renderGenerating();
      fireEvent.click(screen.getByRole('button', { name: 'Прототип: показать ошибку' }));
      fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(activeStepTitle()).toBe('Распознаём документы');
      tick();
      expect(activeStepTitle()).toBe('Раскладываем по блокам 2–10');
    });
  });
});
