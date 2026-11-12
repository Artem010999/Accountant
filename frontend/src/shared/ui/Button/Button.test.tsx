import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('по умолчанию — type=button и вариант primary', () => {
    render(<Button>Главное действие</Button>);
    const btn = screen.getByRole('button', { name: 'Главное действие' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveClass('btn', 'btn--primary');
  });

  it('вызывает onClick по клику', async () => {
    const onClick = vi.fn();
    render(<Button variant="secondary" onClick={onClick}>Второстепенное</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Второстепенное' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('размер sm добавляет модификатор', () => {
    render(<Button variant="outline" size="sm">Малая</Button>);
    expect(screen.getByRole('button', { name: 'Малая' })).toHaveClass('btn--outline', 'btn--sm');
  });

  it('поддерживает все варианты из дизайн-системы', () => {
    const variants = ['primary', 'secondary', 'inverse', 'outline'] as const;
    render(
      <>
        {variants.map((v) => (
          <Button key={v} variant={v}>{v}</Button>
        ))}
      </>,
    );
    for (const v of variants) {
      expect(screen.getByRole('button', { name: v })).toHaveClass(`btn--${v}`);
    }
  });
});
