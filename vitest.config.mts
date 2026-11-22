import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    // Keep jsdom + V8 coverage within the CI worker budget; higher parallelism
    // intermittently starves the form tests and causes 5s user-event timeouts.
    maxWorkers: 2,
    coverage: {
      enabled: true,
      provider: 'v8',
      exclude: ['proxy.ts', 'lib/supabase/server.ts', 'lib/auth/request-path.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        "lib/auth/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        "lib/applications/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
      },
    },
  },
})
