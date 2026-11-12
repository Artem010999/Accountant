import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

function Harness({ onChange, mode }: { onChange: (id: string) => void; mode: 'tabs' | 'buttons' }) {
  const [value, setValue] = useState('a');
  return (
    <SegmentedControl
      mode={mode}
      ariaLabel="Выбор"
      options={[
        { id: 'a', label: 'Первый' },
        { id: 'b', label: 'Второй' },
      ]}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('в режиме tabs даёт роли tablist/tab и отмечает активную вкладку', async () => {
    const onChange = vi.fn();
    render(<Harness mode="tabs" onChange={onChange} />);
    expect(screen.getByRole('tablist', { name: 'Выбор' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Первый' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Второй' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: 'Второй' })).toHaveAttribute('aria-selected', 'true');
  });

  it('в режиме buttons даёт группу кнопок и переключает активный пункт', async () => {
    const onChange = vi.fn();
    render(<Harness mode="buttons" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Выбор' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Первый' })).toHaveClass('segmented__item--active');
    await userEvent.click(screen.getByRole('button', { name: 'Второй' }));
    expect(screen.getByRole('button', { name: 'Второй' })).toHaveClass('segmented__item--active');
  });
});
