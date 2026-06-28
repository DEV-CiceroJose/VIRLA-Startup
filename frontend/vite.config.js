import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Força o Vite a resolver essas bibliotecas para uma única instância
    dedupe: ['react', 'react-dom', 'react-router-dom', '@emotion/react', '@emotion/cache']
  }
})
