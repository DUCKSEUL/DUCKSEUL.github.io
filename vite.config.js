import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DUCKSEUL.github.io 는 사용자 페이지이므로 루트('/')에서 서비스됩니다.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
