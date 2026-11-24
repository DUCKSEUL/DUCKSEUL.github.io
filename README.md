# DUCKSEUL.github.io

연구 대시보드 + 연구 일지 — https://duckseul.github.io

- Vite + React + react-router, TipTap 에디터, KaTeX 수식, GitHub Pages 배포
- 로컬 실행: `npm install` → `npm run dev` → http://localhost:5173
- 배포: `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다 (1~2분).

## 화면 구성
| 경로 | 내용 |
| --- | --- |
| `/` | 벤토 그리드 대시보드 (프로필, 연구 분야, 최근 일지, 프로젝트, 할 일/메모, 기록 현황, 바로가기) |
| `/journal` | 연구 일지 목록 (카테고리 필터, 관리자: 백업/불러오기/모두 발행) |
| `/journal/:id` | 일지 본문 (사진 확대, 네이버 블로그용 복사, 관리자: 수정/삭제) |
| `/write`, `/write/:id` | 글쓰기 / 수정 에디터 (관리자 전용) |

대시보드 내용은 `src/data/profile.js`에서 수정합니다. (소속·이메일 포함)

## 관리자 모드 (GitHub API 기반 CMS)
- 일반 방문자에게는 글쓰기·수정·삭제·불러오기 버튼이 보이지 않습니다. (`/write`는 "관리자 전용" 안내)
- 상단 메뉴 오른쪽 **Admin** → **GitHub로 로그인** → GitHub 승인 화면 → 사이트로 돌아오면 관리자 모드가 켜집니다.
  - GitHub App(`Contents: Read and write`, 이 저장소에만 설치) + Cloudflare Worker(`auth-worker/`)로 OAuth 토큰을 교환합니다.
    Client Secret은 Worker에만 있고, 토큰은 URL `#fragment`로 전달된 뒤 즉시 주소창에서 지워집니다.
  - `auth-worker/wrangler.toml`의 `ALLOWED_USERS`(기본 `DUCKSEUL`) 계정만 로그인할 수 있습니다.
  - 토큰은 이 브라우저의 `localStorage`(`admin-gh-token`)에만 저장되고 8시간 뒤 만료됩니다. 초록색 Admin 버튼을 누르면 로그아웃.
  - 예비 수단: 로그인 창의 "토큰으로 직접 로그인"에 Fine-grained PAT(이 저장소만, Contents: Read and write) 입력.
- Worker 배포/수정: `cd auth-worker && npx wrangler@4 deploy`, 비밀 키: `npx wrangler@4 secret put GITHUB_CLIENT_SECRET`.
- 화면을 숨기는 것은 편의 기능이고, 실제 쓰기 권한은 토큰이 결정합니다. 토큰이 없으면 아무도 저장소를 바꿀 수 없습니다.

## 연구 일지 저장 방식
- **공개 글**: `public/data/posts.json` (사이트에서 `/data/posts.json`으로 불러옴). 사진은 `public/journal/images/`.
- **발행(Publish)**: 관리자 모드에서 글쓰기/수정 → **발행** 또는 삭제를 누르면 브라우저가 GitHub REST API(Git Data API)로
  `posts.json` + 새 사진 + 더 이상 안 쓰는 사진 삭제를 **커밋 1개**로 묶어 `main`에 push합니다.
  → `.github/workflows/deploy.yml`이 자동으로 빌드·배포 (1~2분). 배포 전까지 관리자 화면에는 "배포 대기"로 표시됩니다.
- 발행이 실패하면(네트워크·토큰 만료 등) 글은 이 브라우저(IndexedDB)에 남고, 연구 일지 목록 상단의 **모두 발행**으로 다시 보낼 수 있습니다.
- **백업**: JSON(서식·사진·수식 모두 보존) 또는 Markdown으로 내보내기/불러오기. 불러온 글은 **모두 발행**으로 공개합니다.

## 에디터 기능 · 단축키
| 단축키 | 동작 |
| --- | --- |
| `Ctrl + E` | 가운데 정렬 (가운데 정렬된 문단에서 다시 누르면 왼쪽) |
| `Ctrl + L` / `Ctrl + R` | 왼쪽 / 오른쪽 정렬 (브라우저 기본 동작 차단) |
| `Alt + 1` / `Alt + 2` | 선택한 사진을 본문 폭의 1/2 / 1/3로 |
| `Alt + 3` | 커서 아래에 수식 입력 팝오버 (Enter 확정, Shift+Enter 줄바꿈, Esc 닫기) |
| `Ctrl + K` | 링크 삽입 |

- 글씨 크기 드롭다운 옆 **가− / 가+** 버튼으로 한 단계씩 크기 조절
- 툴바 **구분선** 메뉴: 기본 실선 · 굵은 실선 · 점선 · 짧은 중앙선 · 이중선 · 3점 장식선
- 사진: 끌어다 놓기 / Ctrl+V 붙여넣기, 클릭하면 네 모서리 핸들로 크기 조절 + 캡션 입력란 + 얇은 테두리 켜기/끄기
- 수식: 삽입된 수식을 더블클릭하면 그 자리에서 수정 팝오버가 열림
- 표: 셀을 클릭하면 표 위에 미니 툴바 (행/열 추가·삭제, 셀 배경색)
- 작성 중 내용은 2초마다 localStorage에 임시저장 (새로고침 시 복구 안내), 하단에 글자 수와 예상 읽기 시간 표시
- 글 상세: 소제목(H2/H3) 자동 목차 (넓은 화면은 오른쪽 여백, 좁은 화면은 접이식), 맨 위로 버튼, 사진 확대
