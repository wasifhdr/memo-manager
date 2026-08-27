import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      // See tests/helpers/server-only-stub.ts for why this alias exists.
      'server-only': path.resolve(__dirname, 'tests/helpers/server-only-stub.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
})
