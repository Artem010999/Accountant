import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystem } from './DesignSystem';

describe('DesignSystem', () => {
  it('рендерит заголовок и разделы из дизайна', () => {
    render(<DesignSystem />);
    expect(screen.getByRole('heading', { level: 1, name: 'Дизайн-система' })).toBeInTheDocument();
    for (const title of ['Цвета бренда', 'Язык утверждений', 'Типографика · Onest', 'Кнопки и формы']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it('показывает логотип с «Буха» и «Паспорт»', () => {
    render(<DesignSystem />);
    expect(screen.getByText('Буха')).toBeInTheDocument();
    expect(screen.getByText('Паспорт', { selector: '.logo__product' })).toBeInTheDocument();
  });

  it('показывает все шесть типов утверждений и статусы', () => {
    render(<DesignSystem />);
    expect(document.querySelectorAll('[data-kind]')).toHaveLength(6);
    expect(screen.getByText('Потеряна привязка')).toBeInTheDocument();
    expect(screen.getByText('Нужна проверка')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByText('Можно готовить заявку')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByText('Есть стоп-факторы')).toHaveAttribute('data-tone', 'danger');
  });

  it('кнопки всех вариантов и поле в состоянии фокуса', () => {
    render(<DesignSystem />);
    expect(screen.getByRole('button', { name: 'Главное действие' })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: 'Второстепенное' })).toHaveClass('btn--secondary');
    expect(screen.getByRole('button', { name: 'На оранжевом фоне' })).toHaveClass('btn--inverse');
    expect(screen.getByRole('button', { name: 'Малая' })).toHaveClass('btn--outline');
    expect(screen.getByLabelText('В фокусе')).toHaveClass('field__input--focus');
  });
});
