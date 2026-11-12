import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PillLink } from './PillLink';

describe('PillLink', () => {
  it('рендерит ссылку на маршрут с вариантом и размером', () => {
    render(
      <MemoryRouter>
        <PillLink to="/auth" variant="outline" size="sm">Начать бесплатно</PillLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Начать бесплатно' });
    expect(link).toHaveAttribute('href', '/auth');
    expect(link).toHaveClass('pill-link', 'pill-link--outline', 'pill-link--sm');
  });
});
