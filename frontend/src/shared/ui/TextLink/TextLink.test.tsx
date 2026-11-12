import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TextLink } from './TextLink';

describe('TextLink', () => {
  it('без to рендерит якорь с href', () => {
    render(<TextLink href="#">Текстовая ссылка</TextLink>);
    expect(screen.getByRole('link', { name: 'Текстовая ссылка' })).toHaveAttribute('href', '#');
  });

  it('с to рендерит маршрут react-router', () => {
    render(
      <MemoryRouter>
        <TextLink to="/pricing">Тарифы</TextLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/pricing');
  });
});
