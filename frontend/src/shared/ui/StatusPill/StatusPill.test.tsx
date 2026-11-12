import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
  it('выводит текст статуса и тон', () => {
    render(<StatusPill tone="warning">Нужна проверка</StatusPill>);
    const pill = screen.getByText('Нужна проверка');
    expect(pill).toHaveAttribute('data-tone', 'warning');
    expect(pill).toHaveClass('pill', 'pill--warning', 'pill--sm');
  });

  it('размер md для шапки паспорта', () => {
    render(<StatusPill tone="info" size="md">На проверке</StatusPill>);
    expect(screen.getByText('На проверке')).toHaveClass('pill--md');
  });

  it('покрывает три статуса поля и три статуса допуска из дизайна', () => {
    render(
      <>
        <StatusPill tone="warning">Нужна проверка</StatusPill>
        <StatusPill tone="info">Подтверждено</StatusPill>
        <StatusPill tone="success">Согласовано</StatusPill>
        <StatusPill tone="success">Можно готовить заявку</StatusPill>
        <StatusPill tone="warning">Нужно уточнить</StatusPill>
        <StatusPill tone="danger">Есть стоп-факторы</StatusPill>
      </>,
    );
    expect(screen.getByText('Подтверждено')).toHaveAttribute('data-tone', 'info');
    expect(screen.getByText('Есть стоп-факторы')).toHaveAttribute('data-tone', 'danger');
  });
});
