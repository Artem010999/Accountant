import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest без globals: RTL не чистит DOM сам, делаем это явно после каждого теста.
afterEach(() => {
  cleanup();
});
