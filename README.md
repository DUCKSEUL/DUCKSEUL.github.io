# DUCKSEUL.github.io

연구 대시보드 + 연구 일지 — https://duckseul.github.io

- Vite + React + react-router, TipTap 에디터, KaTeX 수식, GitHub Pages 배포
- 로컬 실행: `npm install` → `npm run dev` → http://localhost:5173
- 배포: `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다 (1~2분).

## 화면 구성
| 경로 | 내용 |
| --- | --- |
| `/` | 2열 벤토 홈 — 1행: 내 소개 · 연구 실적 / 2행: 캘린더(전체 너비, 이번 주 + D-Day) / 3행: 최근 연구 일지 · 논문 레이더 |
| `/about` | 내 소개 — 학력, 소속 연구실, 연구 관심사, 기술 스택 (관리자: 수정) |
| `/journal`, `/journal/:id` | 연구 일지 목록 / 본문 (관리자: 글마다 삭제 · 백업/불러오기/모두 발행) |
| `/publications` | 연구 실적 — Journal · Conference · Patent · Projects 필터, DOI/PDF/코드 링크 (관리자: 추가/수정/삭제) |
| `/radar` | 논문 레이더 — Google Sheets 실시간 연동, 카드/테이블 보기, 키워드 필터, 검색 (관리자: 시트 연결 설정) |
| `/calendar` | 캘린더 — 월간 달력 + 다가오는 일정. 방문자: 공개 일정만 / 관리자 + Google 연결: 내 캘린더도 (이 브라우저에만) |
| `/write`, `/write/:id` | 글쓰기 / 수정 에디터 (관리자 전용) |

## 공개 데이터 (`public/data/`)
| 파일 | 내용 | 수정 |
| --- | --- | --- |
| `about.json` | 내 소개 | 내 소개 → 수정 |
| `publications.json` | 연구 실적 | 연구 실적 → 실적 추가 / ✏️ |
| `events.json` | 공개 일정 (모든 방문자에게 보임) | 캘린더 → 공개 일정 추가 / ✏️ |
| `radar.json` | 논문 레이더 Google Sheets 링크·탭 이름 | 논문 레이더 → 시트 연결 설정 |
| `posts.json` | 연구 일지 | 글쓰기 → 발행 |

관리자 모드에서 저장하면 해당 JSON이 GitHub 저장소에 커밋되고 Actions가 자동 배포합니다(1~2분).

## 논문 레이더 — Google Sheets
- **정렬**: 기록일(Date) 내림차순 — 시트 아래 행에 새 논문을 계속 추가해도 사이트에서는 **최신 기록이 맨 위**, 가장 오래된 초기 자료가 맨 아래.
  같은 날짜면 시트에서 나중에 추가된 행이 위, 기록일이 없는 행은 맨 아래. 상단 토글로 「오래된순」 전환. 홈 위젯도 같은 순서로 상위 4건.
- **헤더**(첫 행): `기록일` `제목` `저자` `저널/학회` `발행연도` `키워드/태그` `한줄요약` `DOI/원문 링크` `중요도` `읽음상태` — 영어/다른 이름도 자동 인식,
  안 맞으면 설정의 **컬럼 매핑**에서 직접 지정. 날짜는 `2026-11-24`, `2026.11.24`, `2026/11/24`, `2026. 11. 24` 모두 인식.
  중요도에 `★★★`, `높음`, `high`, `Y`, `3` 이상 등을 적으면 ★ 중요 하이라이트.
- **화면**: 리서치 카드 그리드 ↔ 데이터 테이블, 키워드·저널·연도·중요 필터 칩, 실시간 검색, 원문 바로가기.
- **데이터 소스**(논문 레이더 → Google Sheets API 설정, 관리자):
  | 모드 | 대상 | 방식 |
  | --- | --- | --- |
  | 샘플 | 연결 전 | 고전 논문 6편 (맨 아래 3편이 초기 자료) |
  | 링크 공유 | 공개 시트 | 키 없이 `gviz/tq?tqx=out:json` |
  | API Key | 공개 시트 | `sheets.googleapis.com/v4/spreadsheets/{ID}/values/{RANGE}?key=` — 브라우저용 공개 키라 radar.json에 저장되므로 반드시 제한 |
  | OAuth | 비공개 시트 | GIS Token Client, `spreadsheets.readonly` — 관리자 브라우저에서만 표시, 방문자에게는 잠금 안내 |
- **보안 잠금**: API Key → 애플리케이션 제한사항 *웹사이트(HTTP 리퍼러)* 에 `https://duckseul.github.io/*`, `http://localhost:5173/*`만,
  API 제한사항은 *Google Sheets API*만. OAuth Client ID → 승인된 JavaScript 원본에 `https://duckseul.github.io`, `http://localhost:5173`만.
  Client Secret은 사용하지 않으며, OAuth 토큰은 메모리 + sessionStorage에만 보관(localStorage·저장소 X).

## 캘린더 — Google Calendar (읽기 전용)
- Google Identity Services **Token Client** 방식, 공개용 OAuth Client ID만 사용 (Client Secret 없음). 권한은 `calendar.readonly` 하나.
- Access Token은 **메모리 + sessionStorage**에만 보관(탭 닫기/1시간 후 소멸), localStorage·저장소에는 저장하지 않음. 관리자 로그아웃 시 즉시 폐기.
- Google Cloud Console에서 OAuth 클라이언트(웹 애플리케이션)를 만들고 **승인된 JavaScript 원본**에 `https://duckseul.github.io`, `http://localhost:5173`만 등록.
  Calendar API 사용 설정, 동의 화면은 테스트 모드 + 내 계정만 테스트 사용자로.
- Client ID는 캘린더 → **Google 캘린더 연결** 설정 창에 입력(이 브라우저에 저장)하거나 `src/config.js`의 `GOOGLE_CLIENT_ID`에 넣으면 됩니다.

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
- **저장 (`Ctrl + S`)**: 나만 보이는 저장. 이 브라우저(IndexedDB)에만 저장되고 저장소에는 커밋하지 않습니다(저장소가 public이므로).
  목록에 "나만 보기" 배지로 표시되며, 이미 발행한 글을 저장하면 방문자에게는 발행된 이전 내용이 그대로 보입니다.
- **발행(Publish)**: 관리자 모드에서 글쓰기/수정 → **발행** 또는 삭제를 누르면 브라우저가 GitHub REST API(Git Data API)로
  `posts.json` + 새 사진 + 더 이상 안 쓰는 사진 삭제를 **커밋 1개**로 묶어 `main`에 push합니다.
  → `.github/workflows/deploy.yml`이 자동으로 빌드·배포 (1~2분). 배포 전까지 관리자 화면에는 "배포 대기"로 표시됩니다.
- 발행이 실패하면(네트워크·토큰 만료 등) 글은 이 브라우저(IndexedDB)에 남고, 연구 일지 목록 상단의 **모두 발행**으로 다시 보낼 수 있습니다.
- **백업**: JSON(서식·사진·수식 모두 보존) 또는 Markdown으로 내보내기/불러오기. 불러온 글은 **모두 발행**으로 공개합니다.

## 에디터 기능 · 단축키
| 단축키 | 동작 |
| --- | --- |
| `Ctrl + S` | 저장 (나만 보기) 후 연구 일지 목록으로 이동, 제목 입력 중에도 동작 |
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
- 저장하지 않은 내용이 있을 때 다른 메뉴로 이동하거나 뒤로 가기를 누르면 확인 팝업(저장하고 나가기 / 계속 쓰기 / 저장 안 하고 나가기), 새로고침·탭 닫기는 브라우저 기본 확인창
- 작성 중 내용은 2초마다 localStorage에 임시저장 (새로고침 시 복구 안내), 하단에 글자 수와 예상 읽기 시간 표시
- 글 상세: 소제목(H2/H3) 자동 목차 (넓은 화면은 오른쪽 여백, 좁은 화면은 접이식), 맨 위로 버튼, 사진 확대
