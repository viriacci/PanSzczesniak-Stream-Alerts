import {resolve} from 'node:path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {build:{sourcemap:'hidden',rollupOptions:{input:{index:resolve('src/main/index.ts'),agent:resolve('src/main/agent/entry.ts'),'read-worker':resolve('src/main/runtime/read-worker.ts')}}}},
  preload: {build:{sourcemap:'hidden'}},
  renderer: {
    build:{sourcemap:'hidden'},
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
