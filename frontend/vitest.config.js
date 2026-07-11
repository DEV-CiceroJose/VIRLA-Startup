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
    // O ambiente jsdom é lento nesta base; testes de página com muitas
    // interações userEvent (Cadastro, Solicitacoes) chegam perto dos 5s padrão
    // e falham por timeout de forma intermitente. 15s dá folga sem mascarar
    // travamentos reais (um teste realmente pendurado ainda estoura).
    testTimeout: 15000,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // O ambiente jsdom é lento nesta base; testes de página com muitas
    // interações userEvent (Cadastro, Solicitacoes, Chat) chegam perto dos 5s
    // padrão e falham por timeout de forma intermitente sob carga. 15s dá folga
    // sem mascarar travamentos reais (um teste realmente pendurado ainda estoura).
    testTimeout: 15000,
    // Execução sequencial entre arquivos: alguns testes mexem em globals do
    // jsdom (ex.: api.test.js redefine window.location) que vazam entre workers
    // quando os arquivos rodam em paralelo, causando falhas intermitentes.
    // Rodar um arquivo por vez torna a suíte determinística (custo desprezível
    // para ~32 testes).
    fileParallelism: false,
    reporters: ['default', new MarkdownReporter({ outputFile: 'TEST-REPORT.md' })],
  },
})
