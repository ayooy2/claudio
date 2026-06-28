import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      },
      '/tts': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
    // 压缩选项
    target: 'es2020',
    minify: 'esbuild',
    // 资源内联阈值（4KB 以下的资源内联为 base64）
    assetsInlineLimit: 4096,
    // CSS 代码分割
    cssCodeSplit: true,
  },
});
