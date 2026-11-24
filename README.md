# DUCKSEUL.github.io

연구 대시보드 + 연구 일지 — https://duckseul.github.io

- Vite + React + react-router, TipTap 에디터, KaTeX 수식, GitHub Pages 배포
- 로컬 실행: `npm install` → `npm run dev` → http://localhost:5173
- 배포: `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다 (1~2분).

## 화면 구성
| 경로 | 내용 |
| --- | --- |
| `/` | 벤토 그리드 대시보드 (프로필, 연구 분야, 최근 일지, 프로젝트, 할 일/메모, 기록 현황, 바로가기) |
| `/journal` | 연구 일지 목록 (카테고리 필터, 백업/불러오기) |
| `/journal/:id` | 일지 본문 (사진 확대, 네이버 블로그용 복사, 수정/삭제) |
| `/write`, `/write/:id` | 글쓰기 / 수정 에디터 |

대시보드 내용은 `src/data/profile.js`에서 수정합니다. (소속·이메일 포함)

## 연구 일지 저장 방식
- **브라우저에서 쓴 글**: 이 브라우저의 IndexedDB에 자동 저장됩니다. 다른 기기·방문자에게는 보이지 않습니다.
- **공개 글**: `src/data/journal.json`. 모든 방문자에게 보입니다.
- **공개하는 법**: 연구 일지 → 백업 → **게시용 journal.json 받기** → 받은 파일로 `src/data/journal.json` 교체 → commit & push.
- **백업**: JSON(서식·사진·수식 모두 보존) 또는 Markdown(글꼴·색상 제외)으로 내보내기/불러오기.

## 에디터 단축키
| 단축키 | 동작 |
| --- | --- |
| `Alt + 1` | 선택한 사진을 본문 폭의 1/2로 |
| `Alt + 2` | 선택한 사진을 본문 폭의 1/3로 |
| `Alt + 3` | 수식 입력창 열기 (삽입된 수식은 더블클릭으로 수정) |
| `Ctrl + K` | 링크 삽입 |
| `Ctrl + B / I / U` | 굵게 / 기울임 / 밑줄 |

사진은 탐색기에서 끌어다 놓거나 캡처 후 `Ctrl + V`로 붙여넣을 수 있고, 사진을 클릭하면 네 모서리의 점으로 크기를 조절할 수 있습니다.
