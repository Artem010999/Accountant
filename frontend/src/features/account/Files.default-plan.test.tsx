import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Files } from './Files';

describe('Files: тариф по умолчанию', () => {
  it('без пропа plan лимит — премиум (50 файлов), как решил владелец', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Files />
      </MemoryRouter>,
    );
    expect(screen.getByText(/из 50/)).toBeInTheDocument();
  });
});
