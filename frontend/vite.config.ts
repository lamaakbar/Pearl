import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = __dirname
const mediaDir = resolve(__dirname, '../Media')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@media': mediaDir,
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [rootDir, mediaDir],
    },
  },
})

