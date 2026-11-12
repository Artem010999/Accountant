import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClaimMark, type ClaimKind } from './ClaimMark';

describe('ClaimMark', () => {
  it('выводит текст утверждения с типом в data-kind', () => {
    render(<ClaimMark kind="fact-doc">выручка 10 000 ₽</ClaimMark>);
    const mark = screen.getByText('выручка 10 000 ₽');
    expect(mark).toHaveAttribute('data-kind', 'fact-doc');
    expect(mark).toHaveClass('claim', 'claim--fact-doc');
  });

  it('поддерживает все шесть типов из раздела «Язык утверждений»', () => {
    const kinds: ClaimKind[] = ['fact-doc', 'fact-no-doc', 'plan', 'hypothesis', 'hearsay', 'lost'];
    render(
      <>
        {kinds.map((k) => (
          <ClaimMark key={k} kind={k}>{k}</ClaimMark>
        ))}
      </>,
    );
    for (const k of kinds) {
      expect(screen.getByText(k)).toHaveClass(`claim--${k}`);
    }
  });
});
