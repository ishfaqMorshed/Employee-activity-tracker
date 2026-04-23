import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':       'http://localhost:8000',
      '/employee':   'http://localhost:8000',
      '/employees':  'http://localhost:8000',
      '/manager':    'http://localhost:8000',
      '/report':     'http://localhost:8000',
      '/agent':      'http://localhost:8000',
      '/screenshot': 'http://localhost:8000',
    }
  }
})
