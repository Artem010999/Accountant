import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('связывает подпись и поле', () => {
    render(<TextField label="Поле ввода" defaultValue="Иванов Иван Иванович" />);
    const input = screen.getByLabelText('Поле ввода');
    expect(input).toHaveValue('Иванов Иван Иванович');
  });

  it('принимает ввод с клавиатуры', async () => {
    render(<TextField label="Фамилия" />);
    const input = screen.getByLabelText('Фамилия');
    await userEvent.type(input, 'Петров');
    expect(input).toHaveValue('Петров');
  });

  it('state=focus добавляет класс состояния «В фокусе»', () => {
    render(<TextField label="В фокусе" state="focus" defaultValue="Фокус — персиковое кольцо" />);
    expect(screen.getByLabelText('В фокусе')).toHaveClass('field__input--focus');
  });
});
