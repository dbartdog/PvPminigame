import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,packages,games,tools}/**/*.test.ts'],
  },
});
