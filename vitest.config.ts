import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: [
      'src/tests/node/**',
      'dist-node-tests/**',
      '**/*.node.test.ts',
      '**/*.node.test.js'
    ]
  }
});
