import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('hero: показывает «Буха» и «Паспорт»', () => {
    render(<Logo variant="hero" />);
    expect(screen.getByText('Буха')).toBeInTheDocument();
    expect(screen.getByText('Паспорт')).toBeInTheDocument();
  });

  it('cabinet с to: ссылка на главную с доступным именем', () => {
    render(
      <MemoryRouter>
        <Logo variant="cabinet" to="/" ariaLabel="Буха — на главную" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Буха — на главную' });
    expect(link).toHaveAttribute('href', '/');
    expect(screen.queryByText('Паспорт')).not.toBeInTheDocument();
  });

  it('admin: показывает бейдж «админ»', () => {
    render(<Logo variant="admin" />);
    expect(screen.getByText('админ')).toBeInTheDocument();
  });

  it('без to не рендерит ссылку', () => {
    render(<Logo variant="hero" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
