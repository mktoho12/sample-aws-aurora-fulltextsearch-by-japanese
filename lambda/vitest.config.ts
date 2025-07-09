import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '../../utils/middy': path.resolve(__dirname, './test/__mocks__/createHandler.js'),
      '../database/connection': path.resolve(__dirname, './test/__mocks__/database/connection.js'),
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/migrations/**',
        '**/test/**'
      ]
    }
  }
})