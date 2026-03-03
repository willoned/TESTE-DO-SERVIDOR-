import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Define os caminhos relativos para os ficheiros (necessário para os assets carregarem bem)
  base: './',
  plugins: [
    react(),
    // O plugin do Electron foi removido daqui!
  ],
  build: {
    // Desativa mapas de código em produção para segurança e performance
    sourcemap: false, 
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
    // Garante que o servidor fica exposto para a rede local (acesso via IP)
    host: true, 
  },
})