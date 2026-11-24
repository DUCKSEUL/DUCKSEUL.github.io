// ─────────────────────────────────────────────────────────────
// 사이트에 표시되는 모든 내용은 이 파일에서 수정합니다.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'DUCKSEUL',
  role: 'Computational Electromagnetics Researcher',
  tagline: '전자기 문제를 수치적으로 풀고, 그 과정을 코드로 남깁니다.',
  intro:
    '적분방정식 기반 모멘트법(MoM)을 중심으로 3차원 전자기 산란·복사 문제를 연구하고 있습니다. ' +
    'MATLAB과 Python으로 수치해석 코드를 직접 구현하며, AI 도구를 연구 워크플로에 적극적으로 활용하는 방법도 실험하고 있습니다.',
  github: 'https://github.com/DUCKSEUL',
  githubHandle: 'DUCKSEUL',
}

export const stats = [
  { value: '3D', label: 'IE-MoM 해석' },
  { value: 'MATLAB', label: '주력 수치해석 도구' },
  { value: 'Python', label: '데이터 · 자동화' },
]

export const research = [
  {
    icon: 'wave',
    title: '적분방정식 & 모멘트법',
    body: '표면/체적 적분방정식을 이산화하여 3차원 도체·유전체 구조의 전자기 산란 및 복사 특성을 해석합니다.',
    tags: ['EFIE / MFIE', 'RWG Basis', 'Green’s Function'],
  },
  {
    icon: 'antenna',
    title: '빔포밍 & 배열 신호처리',
    body: '배열 안테나의 빔 형성 기법을 수치적으로 모델링하고, 성능을 시뮬레이션으로 검증합니다.',
    tags: ['Beamforming', 'Array Antenna', 'Simulation'],
  },
  {
    icon: 'spark',
    title: 'AI 보조 연구 워크플로',
    body: 'Claude, GPT 등 LLM을 활용해 수치해석 코드 작성, 검증, 문서화 과정을 가속하는 방법을 탐구합니다.',
    tags: ['LLM', 'Code Generation', 'Reproducibility'],
  },
]

export const projects = [
  {
    title: '3D IE-MoM Solver',
    repo: '261026_3D_IE_MoM_by_Claude',
    description: '3차원 적분방정식 기반 모멘트법 솔버를 Claude와 함께 구현한 연구용 코드.',
    lang: 'MATLAB',
    year: '2026',
  },
  {
    title: 'EDBF with GPT',
    repo: 'EDBF_with_GPT',
    description: 'GPT를 활용해 빔포밍 알고리즘을 구현하고 검증한 실험 프로젝트.',
    lang: 'Research',
    year: '2026',
  },
  {
    title: 'Python Study · Codetree',
    repo: 'PythonStudy_Codetree',
    description: 'Codetree 문제 풀이를 통해 Python 알고리즘 기본기를 다지는 학습 기록.',
    lang: 'Python',
    year: '2026',
  },
  {
    title: 'ClaudeRoom Website',
    repo: 'ClaudeRoom_Website',
    description: '연구 목적의 웹사이트 실험 저장소.',
    lang: 'Web',
    year: '2026',
  },
]

export const skills = [
  { group: 'Numerical Methods', items: ['Method of Moments', 'Integral Equations', 'Linear Algebra', 'Numerical Integration'] },
  { group: 'Languages', items: ['MATLAB', 'Python', 'JavaScript'] },
  { group: 'Tools', items: ['Git / GitHub', 'Claude Code', 'VS Code', 'LaTeX'] },
]

export const timeline = [
  { period: '2026.11', title: '개인 연구 포트폴리오 사이트 공개', detail: 'Vite + React 기반, GitHub Pages 배포' },
  { period: '2026.10', title: '3D IE-MoM 솔버 구현', detail: 'MATLAB 기반 3차원 적분방정식 해석 코드' },
  { period: '2026.10', title: 'EDBF 실험 프로젝트', detail: 'LLM 보조 빔포밍 알고리즘 구현' },
]
