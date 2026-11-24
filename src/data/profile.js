// ─────────────────────────────────────────────────────────────
// 대시보드에 표시되는 정보는 이 파일에서 수정합니다.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'DUCKSEUL',
  // TODO: 실제 소속으로 바꿔 주세요 (예: OO대학교 전자공학과 전자파 연구실)
  affiliation: 'Computational Electromagnetics Lab',
  tagline: '전자기 문제를 수치적으로 풀고, 그 과정을 코드와 일지로 남깁니다.',
  status: '3D IE-MoM 솔버 고도화 중',
  // 이메일을 공개하려면 아래에 주소를 넣으세요. 비워 두면 버튼이 숨겨집니다.
  email: '',
  github: 'https://github.com/DUCKSEUL',
  githubHandle: 'DUCKSEUL',
}

export const researchAreas = [
  { title: '적분방정식 & 모멘트법', desc: '3차원 도체·유전체 전자기 산란/복사 해석' },
  { title: '빔포밍 & 배열 신호처리', desc: '배열 안테나 빔 형성 기법 모델링' },
  { title: 'AI 보조 연구 워크플로', desc: 'LLM으로 수치해석 코드 작성·검증 가속' },
]

export const keywords = [
  'Method of Moments',
  'EFIE / MFIE',
  'RWG Basis',
  "Green's Function",
  'Beamforming',
  'Array Antenna',
  'MATLAB',
  'Python',
  'LLM',
]

// 주요 프로젝트 / 논문 하이라이트 (type: 'Project' | 'Paper')
export const highlights = [
  {
    type: 'Project',
    title: '3D IE-MoM Solver',
    desc: '3차원 적분방정식 기반 모멘트법 솔버 구현',
    meta: 'MATLAB · 2026',
    href: 'https://github.com/DUCKSEUL/261026_3D_IE_MoM_by_Claude',
  },
  {
    type: 'Project',
    title: 'EDBF with GPT',
    desc: 'LLM을 활용한 빔포밍 알고리즘 구현 실험',
    meta: 'Research · 2026',
    href: 'https://github.com/DUCKSEUL/EDBF_with_GPT',
  },
  {
    type: 'Project',
    title: 'Python Study · Codetree',
    desc: 'Python 알고리즘 기본기 학습 기록',
    meta: 'Python · 2026',
    href: 'https://github.com/DUCKSEUL/PythonStudy_Codetree',
  },
]

// 할 일 위젯의 기본 목록 (방문자에게 보이는 초기값, 수정 내용은 각 브라우저에 저장)
export const defaultTodos = [
  { id: 't1', text: '3D IE-MoM 솔버 코드 정리', done: false },
  { id: 't2', text: '참고 논문 읽고 일지에 요약하기', done: false },
  { id: 't3', text: '연구 일지 공간 만들기', done: true },
]
