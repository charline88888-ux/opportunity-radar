import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 本地优先：
// - base './' + HashRouter 保证 file:// 双击可用；
// - viteSingleFile 把 JS/CSS 全部内联进 dist/index.html，避免 file:// 下 ES module 被 CORS 拦截；
// - 无任何外网/CDN 资源。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 3000,
    modulePreload: false,
    reportCompressedSize: false,
  },
})
