import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('по умолчанию — контурный вариант с содержимым', () => {
    render(<Card><h3>Факт с документом</h3></Card>);
    const heading = screen.getByRole('heading', { name: 'Факт с документом' });
    expect(heading.parentElement).toHaveClass('card', 'card--outline');
  });

  it('вариант muted и dark', () => {
    const { rerender } = render(<Card variant="muted"><p>Скругления</p></Card>);
    expect(screen.getByText('Скругления').parentElement).toHaveClass('card--muted');
    rerender(<Card variant="dark"><p>Тон текста</p></Card>);
    expect(screen.getByText('Тон текста').parentElement).toHaveClass('card--dark');
  });
});
