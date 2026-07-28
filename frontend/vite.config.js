import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // Permitir acesso de qualquer IP
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '192.168.0.200',
      'redblackspy.ddns.net'
    ],
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'http://redblackspy.ddns.net:8181' 
          : 'http://localhost:8181',
        changeOrigin: true,
        secure: false
      },
      // Proxy para arquivos estáticos do backend
      '/uploads': {
        target: process.env.NODE_ENV === 'production' 
          ? 'http://redblackspy.ddns.net:8181' 
          : 'http://localhost:8181',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '192.168.0.200',
      'redblackspy.ddns.net'
    ]
  }
})
