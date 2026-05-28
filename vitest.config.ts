import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.smoke.test.ts'],
    // Serial file mode: lookup.test.ts + queue.test.ts both DELETE FROM links
    // unconditionally, which races with queries.test.ts in CI under load.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
