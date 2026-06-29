import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import MarkdownReporter from './vitest-md-reporter.js'

// Configuração de testes do frontend (Vitest + Testing Library + jsdom).
// `npm test` roda tudo uma vez e gera o TEST-REPORT.md via reporter customizado.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mesma deduplicação do vite.config para evitar múltiplas cópias de React.
    dedupe: ['react', 'react-dom', 'react-router-dom', '@emotion/react', '@emotion/cache'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    reporters: ['default', new MarkdownReporter({ outputFile: 'TEST-REPORT.md' })],
  },
})
