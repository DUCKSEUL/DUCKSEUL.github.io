// MathLive(<math-field>) 로더 · 공통 설정 — PowerPoint(Office Math)식 구조 수식 편집기
// - 수식 상자를 처음 열 때만 불러옴(지연 로딩) → 글 읽기·다른 화면에는 영향 없음
// - 저장은 표준 LaTeX(KaTeX로 렌더링) 그대로 → 기존 글·상세 보기·네이버 복사와 100% 호환
let loading = null

export function loadMathLive() {
  if (!loading) {
    loading = import('mathlive').then((m) => {
      const { MathfieldElement } = m
      // 글꼴: 이미 문서에 로드된 KaTeX 글꼴(katex.min.css, 같은 KaTeX_* 이름)을 그대로 사용 / 효과음 끔
      MathfieldElement.fontsDirectory = null
      MathfieldElement.soundsDirectory = null
      return m
    })
  }
  return loading
}

/** 편집기 안 글꼴을 연구 일지 수식 스타일(STIX Two Text)과 통일 — 기호·큰 연산자·괄호는 KaTeX 전용 글꼴 유지 */
export const SHADOW_CSS = `
  .ML__mathit { font-family: 'STIX Two Text', 'Times New Roman', KaTeX_Math, serif; font-style: italic; }
  .ML__cmr { font-family: 'STIX Two Text', 'Times New Roman', KaTeX_Main, serif; }
  .ML__mathbf, .ML__bold { font-family: 'STIX Two Text', 'Times New Roman', KaTeX_Main, serif; font-weight: 700; }
  .ML__text { font-family: 'STIX Two Text', 'Times New Roman', serif; }
  .ML__content { padding: 2px 4px; }
`

/** MathLive 출력 LaTeX → 저장용 표준 LaTeX (빈 칸 자리표시는 빈 그룹으로) */
export function cleanLatex(s = '') {
  return s
    .replace(/\\placeholder(\[[^\]]*\])?\{[^{}]*\}/g, '{}')
    .replace(/\\mleft/g, '\\left')
    .replace(/\\mright/g, '\\right')
    // 굵은 그리스 문자 + 첨자: MathLive는 '\bm{\eta_{12}}'(첨자까지 굵게)로 내보냄 → 밑수만 굵게 '\boldsymbol{\eta}_{12}'
    .replace(/\\bm\{(\\[a-zA-Z]+|[^\\{}_^])((?:[_^](?:\{[^{}]*\}|[^{}\\\s]))+)\}/g, '\\boldsymbol{$1}$2')
    .trim()
}

/** 퀵 팔레트 템플릿(§ ◊ ¦ 표기) → MathLive 삽입 문법(#? 빈 칸, #0 선택 영역) */
export function toMathLiveTemplate(ins) {
  return ins
    .replace(/§[^¦§]*¦/g, '#?') // 예시 값(a, i=1 …) 자리 → 빈 칸
    .replace(/◊§/g, '#0') // 선택한 글자 감싸기(없으면 빈 칸)
    .replace(/§/g, '#?')
    .replace(/\{\}/g, '{#?}') // 남은 빈 그룹도 칸으로
    .trim()
}

/** r×c 행렬 템플릿 (모든 원소가 빈 칸) */
export const matrixTemplate = (env, r, c) =>
  `\\begin{${env}} ${Array.from({ length: r }, () => Array(c).fill('#?').join(' & ')).join(' \\\\ ')} \\end{${env}}`
