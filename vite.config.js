import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── 보안: Content Security Policy ─────────────────────────────
// GitHub Pages는 응답 헤더를 설정할 수 없어 <meta http-equiv>로 적용합니다.
// (개발 서버는 HMR용 인라인 스크립트·웹소켓이 필요해 빌드 결과물에만 주입)
// ※ frame-ancestors는 meta로는 동작하지 않으므로 클릭재킹 방어는 src/security.js에서 처리
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  [
    "connect-src 'self'",
    'https://api.github.com',
    'https://github-contributions-api.jogruber.de',
    'https://docs.google.com',
    'https://*.googleusercontent.com',
    'https://sheets.googleapis.com',
    'https://www.googleapis.com',
    'https://oauth2.googleapis.com',
    'https://accounts.google.com',
    'https://duckseul-auth.duckseul.workers.dev',
  ].join(' '),
  'frame-src https://accounts.google.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

const securityMeta = {
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml() {
    return [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
    ]
  },
}

// DUCKSEUL.github.io 는 사용자 페이지이므로 루트('/')에서 서비스됩니다.
export default defineConfig({
  plugins: [react(), securityMeta],
  base: '/',
})
