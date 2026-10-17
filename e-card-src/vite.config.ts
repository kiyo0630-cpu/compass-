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
  build: {
    // 公開用の静的ファイルは ../e-card に出力し、GitHub Pages で
    // https://<user>.github.io/<repo>/e-card/ として配信する
    outDir: '../e-card',
    emptyOutDir: true,
  },
})
