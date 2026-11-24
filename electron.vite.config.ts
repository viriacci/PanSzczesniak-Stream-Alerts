import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    server: { host: '127.0.0.1' },
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'pssa-development-csp',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace("connect-src 'self'", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*")
      }
    }]
  }
})
