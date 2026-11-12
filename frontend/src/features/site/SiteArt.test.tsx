import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Mascot } from './SiteArt';

describe('Mascot', () => {
  it('вариант tile рисует белую плашку, bare — нет', () => {
    const { container, rerender } = render(<Mascot size={40} variant="tile" />);
    expect(container.querySelector('.mascot__tile')).not.toBeNull();
    rerender(<Mascot size={40} variant="bare" />);
    expect(container.querySelector('.mascot__tile')).toBeNull();
  });
});
