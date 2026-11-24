// 관리자 모드(GitHub API) 설정
export const REPO = {
  owner: 'DUCKSEUL',
  name: 'DUCKSEUL.github.io',
  branch: 'main',
}
// 저장소 안의 경로
export const POSTS_PATH = 'public/data/posts.json'
export const IMAGE_DIR = 'public/journal/images'
// 사이트에서의 URL (public/ 아래 파일은 루트에서 서비스됨)
export const POSTS_URL = '/data/posts.json'
export const IMAGE_URL = '/journal/images'
// GitHub 로그인 중계 Worker 주소 (auth-worker/ 를 배포한 뒤 채움). 비어 있으면 토큰 입력 방식만 표시
export const AUTH_URL = 'https://duckseul-auth.duckseul.workers.dev'
