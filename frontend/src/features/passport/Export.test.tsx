import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Passport } from './Passport';
import { Result } from './Result';

// Скачивание открывается только когда все блоки одобрены (CJM, шаг 6; COMPLETED.export_ready).
describe('Скачивание паспорта', () => {
  it('экран паспорта: DOCX и PDF недоступны, пока не все блоки одобрены', () => {
    render(
      <MemoryRouter>
        <Passport />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'DOCX' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled();
  });

  it('экран паспорта: после одобрения всех блоков кнопки активны', () => {
    render(
      <MemoryRouter>
        <Passport exportReady />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'DOCX' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
  });

  it('итог проверки: «Скачать DOCX» и «Скачать PDF» недоступны до одобрения, подсказка объясняет почему', () => {
    render(
      <MemoryRouter>
        <Result />
      </MemoryRouter>,
    );
    const docx = screen.getByRole('button', { name: 'Скачать DOCX' });
    expect(docx).toBeDisabled();
    expect(docx).toHaveAttribute('title', 'Скачать можно, когда все 10 блоков одобрены');
    expect(screen.getByRole('button', { name: 'Скачать PDF' })).toBeDisabled();
  });

  it('итог проверки: при готовности кнопки активны', () => {
    render(
      <MemoryRouter>
        <Result exportReady />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Скачать DOCX' })).toBeEnabled();
  });
});
