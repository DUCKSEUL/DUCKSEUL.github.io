# DUCKSEUL.github.io

개인 연구 및 포트폴리오 사이트 — https://duckseul.github.io

- Vite + React (react-router), GitHub Pages 배포
- 소개/연구/프로젝트 내용 수정: `src/data/profile.js`
- 로컬 실행: `npm install` → `npm run dev` → http://localhost:5173
- 배포: `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다 (1~2분 소요).

## 연구 일지 쓰는 법

1. `src/journal/_template.md`를 복사해 `src/journal/YYYY-MM-DD-영문-제목.md`로 저장합니다.
   - 예: `2026-11-25-rwg-basis-test.md` → 주소 `https://duckseul.github.io/journal/2026-11-25-rwg-basis-test`
2. 맨 위 정보(frontmatter)를 채웁니다.
   ```yaml
   ---
   title: RWG 기저 함수 테스트
   date: 2026-11-25
   tags: [IE-MoM, 실험]
   summary: 목록에 보일 한두 줄 요약
   draft: false   # true면 사이트에 표시되지 않음
   ---
   ```
3. 본문은 Markdown으로 작성합니다.
   - 수식: 인라인 `$E = mc^2$`, 블록 `$$ ... $$` (KaTeX)
   - 표, 체크리스트(`- [ ]`), 코드 블록 지원
   - 이미지: `public/journal/` 폴더에 넣고 `![설명](/journal/파일명.png)`로 삽입
4. 커밋 후 push하면 자동으로 사이트에 올라갑니다.

> 컴퓨터가 없을 때는 GitHub 웹에서 `src/journal` 폴더 → **Add file → Create new file**로 바로 작성해도 됩니다.
