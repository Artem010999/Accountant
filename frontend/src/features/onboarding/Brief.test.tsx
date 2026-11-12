import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Brief } from './Brief';

function renderBrief() {
  return render(
    <MemoryRouter initialEntries={['/brief']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/brief" element={<Brief />} />
        <Route path="/onboarding" element={<h1>Расскажите о себе</h1>} />
        <Route path="/generating" element={<h1>Буха читает материалы</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const QUESTION_LABELS = [
  /1\. Какую проблему решает проект и для кого\?/,
  /2\. Что делает продукт\?/,
  /3\. Что уже сделано, а что в планах\?/,
  /4\. Кто в команде и чем занимается\?/,
];

describe('Brief', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderBrief();
    expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
  });

  it('ветка «есть файлы?»: зона загрузки и ответ «У меня нет файлов» видны сразу', () => {
    renderBrief();
    expect(screen.getByRole('button', { name: /Перетащите файлы сюда/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'У меня нет файлов' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Файлов пока нет?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/onboarding');
  });

  it('переключатель прототипа: по умолчанию «Профи»', () => {
    renderBrief();
    expect(screen.getByRole('button', { name: 'Профи' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Базовый' })).toHaveAttribute('aria-pressed', 'false');
  });

  describe('ветка «файлы»', () => {
    it('после загрузки показывает список файлов, счётчик и кнопку сборки по файлам', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: /Перетащите файлы сюда/ }));

      expect(screen.getByRole('heading', { level: 1, name: 'Материалы загружены' })).toBeInTheDocument();
      expect(screen.getByText('Monetrix_presentation_02.11.pdf')).toBeInTheDocument();
      expect(screen.getByText('Svidetelstvo_RID_scan.pdf')).toBeInTheDocument();
      expect(screen.getByText('Monetrix_presentation_02.11 (1).pdf')).toBeInTheDocument();
      expect(screen.getByText('Текст распознан')).toBeInTheDocument();
      expect(screen.getByText('Распознаём скан')).toBeInTheDocument();
      expect(screen.getByText('Этот файл уже загружен — повторно не разбираем и в лимит не считаем')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Добавить ещё файл/ })).toHaveTextContent('· использовано 2 из 10');
      expect(screen.getByRole('button', { name: 'Собрать паспорт по файлам' })).toBeInTheDocument();
      expect(screen.queryByText('Расскажите о проекте')).not.toBeInTheDocument();
    });

    it('«Убрать» у дубликата не меняет счётчик; «Удалить файл» уменьшает его', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: /Перетащите файлы сюда/ }));

      await user.click(screen.getByRole('button', { name: 'Убрать' }));
      expect(screen.queryByText('Monetrix_presentation_02.11 (1).pdf')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Добавить ещё файл/ })).toHaveTextContent('· использовано 2 из 10');

      await user.click(screen.getAllByRole('button', { name: 'Удалить файл' })[0]);
      expect(screen.queryByText('Monetrix_presentation_02.11.pdf')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Добавить ещё файл/ })).toHaveTextContent('· использовано 1 из 10');
    });

    it('«Собрать паспорт по файлам» ведёт на генерацию', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: /Перетащите файлы сюда/ }));
      await user.click(screen.getByRole('button', { name: 'Собрать паспорт по файлам' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Буха читает материалы' })).toBeInTheDocument();
    });

    it('«Назад» из файлов возвращает к вопросу «Есть материалы»', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: /Перетащите файлы сюда/ }));
      await user.click(screen.getByRole('button', { name: 'Назад' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
    });
  });

  describe('ветка «анкета»', () => {
    it('«У меня нет файлов» открывает четыре вопроса и свободное поле', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));

      expect(screen.getByRole('heading', { level: 1, name: 'Расскажите о проекте' })).toBeInTheDocument();
      for (const label of QUESTION_LABELS) {
        expect(screen.getByLabelText(label)).toBeRequired();
      }
      expect(screen.getByLabelText('Что ещё важно знать о проекте?')).not.toBeRequired();
      expect(screen.getAllByText('Как обычно отвечают')).toHaveLength(4);
      expect(screen.getByRole('button', { name: 'Собрать паспорт' })).toBeInTheDocument();
      expect(screen.getByText(/обязательные вопросы/)).toBeInTheDocument();
    });

    it('«Нашлись файлы? Загрузить» возвращает к ветке файлов', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));
      await user.click(screen.getByRole('button', { name: 'Нашлись файлы? Загрузить' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
    });

    it('без ответов на обязательные вопросы сборка не запускается', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));
      await user.click(screen.getByRole('button', { name: 'Собрать паспорт' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Расскажите о проекте' })).toBeInTheDocument();
      expect(screen.getByLabelText(QUESTION_LABELS[0])).toBeInvalid();
    });

    it('с ответами на все четыре вопроса «Собрать паспорт» ведёт на генерацию', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));
      for (const label of QUESTION_LABELS) {
        await user.type(screen.getByLabelText(label), 'Ответ');
      }
      await user.click(screen.getByRole('button', { name: 'Собрать паспорт' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Буха читает материалы' })).toBeInTheDocument();
    });

    it('«Назад» из анкеты возвращает к вопросу «Есть материалы»', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));
      await user.click(screen.getByRole('button', { name: 'Назад' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Есть материалы о проекте?' })).toBeInTheDocument();
    });
  });

  describe('тариф «Базовый»', () => {
    it('вместо зоны загрузки показывает пейволл с переходом к тарифу; анкета доступна', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'Базовый' }));

      expect(screen.getByRole('button', { name: 'Базовый' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: /Перетащите файлы сюда/ })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Разбор документов — на тарифе «Профессиональный»' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Подключить за 990 ₽' })).toHaveAttribute('href', '/billing');
      expect(screen.getByRole('button', { name: 'У меня нет файлов' })).toBeInTheDocument();
    });

    it('в анкете на Базовом нет ссылки «Нашлись файлы?»', async () => {
      const user = userEvent.setup();
      renderBrief();
      await user.click(screen.getByRole('button', { name: 'Базовый' }));
      await user.click(screen.getByRole('button', { name: 'У меня нет файлов' }));
      expect(screen.queryByRole('button', { name: 'Нашлись файлы? Загрузить' })).not.toBeInTheDocument();
      expect(screen.getByText(/Отвечайте как получится, коротко/)).toBeInTheDocument();
    });
  });
});
