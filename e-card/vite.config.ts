import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 相対パスにしておくと GitHub Pages のサブディレクトリ配信でもそのまま動く
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
})
