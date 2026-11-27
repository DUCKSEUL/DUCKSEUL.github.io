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
  .ML__content { padding: 0 1px; min-height: 0; }
  :host, .ML__container { min-height: 0 !important; padding: 0 !important; }
`

/** MathLive 출력 LaTeX → 저장용 표준 LaTeX (빈 칸 자리표시는 빈 그룹으로) */
export function cleanLatex(s = '') {
  return s
    .replace(/\\placeholder(\[[^\]]*\])?\{[^{}]*\}/g, '{}')
    .replace(/\\mleft/g, '\\left')
    .replace(/\\mright/g, '\\right')
    // 굵은 기울임: MathLive '\mathbf{\mathbfit{x}}' · '\mathbfit{x}'는 KaTeX에 없음 → '\boldsymbol{x}'
    .replace(/\\mathbf\{\\mathbfit\{([^{}]*)\}\}/g, '\\boldsymbol{$1}')
    .replace(/\\mathbfit\{/g, '\\boldsymbol{')
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

/**
 * PowerPoint 선형 형식 → LaTeX (Space를 누른 순간 한 덩어리를 조립할 때)
 * - 'a/b' → \frac{a}{b}, '(a+b)/c' → \frac{a+b}{c} (괄호 묶음은 벗김), '\eta_zz' · 'x^12' → 첨자 묶음 {zz} {12}
 * - '\frac{a}{b}', '\sqrt{x}', '\mathrm{S}' 같은 LaTeX는 그대로
 */
export function linearToLatex(s = '') {
  let i = 0
  const units = [] // { tex, wrap: '{' | '(' | null, scripted } | { op: '/' } | { raw }
  const readGroup = (open, close) => {
    let d = 0
    let j = i
    for (; j < s.length; j++) {
      if (s[j] === '\\') {
        j++
        continue
      }
      if (s[j] === open) d++
      else if (s[j] === close && --d === 0) break
    }
    const g = s.slice(i, j + 1)
    i = j + 1
    return g
  }
  const readScriptArg = () => {
    if (s[i] === '{') return readGroup('{', '}')
    if (s[i] === '(') return `{${readGroup('(', ')').slice(1, -1)}}`
    const cmd = /^\\(?:[a-zA-Z]+|.)/.exec(s.slice(i))
    if (cmd) {
      i += cmd[0].length
      return `{${cmd[0]}}`
    }
    const run = /^[A-Za-z0-9.]+/.exec(s.slice(i))
    if (run) {
      i += run[0].length
      return `{${run[0]}}`
    }
    if (i < s.length) return `{${s[i++]}}`
    return '{}'
  }
  while (i < s.length) {
    const c = s[i]
    if (c === '/') {
      units.push({ op: '/' })
      i++
      continue
    }
    if (c === ' ') {
      i++
      continue
    }
    let tex
    let wrap = null
    // 빈 괄호 쌍 → PowerPoint처럼 늘어나는 큰 괄호 + 가운데 점선 칸 ('[]' + Space → [⬚])
    const pair = EMPTY_PAIRS.find(([k]) => s.startsWith(k, i))
    if (pair) {
      tex = pair[1]
      i += pair[0].length
    } else if (c === '{') {
      tex = readGroup('{', '}')
      wrap = '{'
    } else if (c === '(') {
      tex = readGroup('(', ')')
      wrap = '('
    } else if (c === '\\') {
      const m = /^\\(?:[a-zA-Z]+|.)/.exec(s.slice(i))
      tex = m[0]
      i += tex.length
      if (/^\\[a-zA-Z]+$/.test(tex)) {
        while (s[i] === '[') tex += readGroup('[', ']')
        while (s[i] === '{') tex += readGroup('{', '}')
      }
    } else if (/[A-Za-z0-9.]/.test(c)) {
      tex = /^[A-Za-z0-9.]+/.exec(s.slice(i))[0]
      i += tex.length
      if (FUNCS.has(tex)) tex = `\\${tex}` // sin · cos · log … → 함수 이름(정체)
    } else if (c === '_' || c === '^') {
      tex = ''
    } else {
      units.push({ raw: c })
      i++
      continue
    }
    let scripted = false
    while (s[i] === '_' || s[i] === '^') {
      tex += s[i++] + readScriptArg()
      scripted = true
    }
    units.push({ tex, wrap, scripted })
  }
  const strip = (u) => (!u ? '' : !u.scripted && u.wrap ? u.tex.slice(1, -1) : u.tex)
  const out = []
  for (let k = 0; k < units.length; k++) {
    const u = units[k]
    if (!u.op) {
      out.push(u)
      continue
    }
    let num = out.pop()
    if (num && num.tex === undefined) {
      out.push(num)
      num = null
    }
    const next = units[k + 1]
    const den = next && next.tex !== undefined ? units[++k] : null
    out.push({ tex: `\\frac{${strip(num)}}{${strip(den)}}` })
  }
  // 이어 붙일 때 '\alpha' 뒤에 영문자가 오면 명령이 붙지 않게 공백
  return out.reduce((acc, u) => {
    const t = u.raw ?? u.tex
    return acc + (/\\[a-zA-Z]+$/.test(acc) && /^[A-Za-z]/.test(t) ? ' ' : '') + t
  }, '')
}

const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'arg', 'deg'])
/** 빈 괄호 쌍 → 큰 괄호 + 점선 칸(#?) */
export const EMPTY_PAIRS = [
  ['()', '\\left(#?\\right)'],
  ['[]', '\\left[#?\\right]'],
  ['{}', '\\left\\{#?\\right\\}'],
  ['\\{\\}', '\\left\\{#?\\right\\}'],
  ['||', '\\left|#?\\right|'],
  ['<>', '\\left\\langle#?\\right\\rangle'],
]
/** 선택한 수식을 감싸는 큰 괄호 (여는 괄호 키 → 템플릿) */
export const WRAP_BRACKETS = {
  '(': '\\left(#0\\right)',
  '[': '\\left[#0\\right]',
  '{': '\\left\\{#0\\right\\}',
  '|': '\\left|#0\\right|',
  '<': '\\left\\langle#0\\right\\rangle',
}
