// 수식 편집 도우미 (편집 화면 전용)
// - PowerPoint식 수식 자동 고침: '\pm' + Space → '±' (저장할 때는 다시 '\pm'으로)
// - 행렬 LaTeX 분해/재조립: 앞부분 · \begin{bmatrix} 셀들 \end{bmatrix} · 뒷부분
// - 본문 '$ … $' 수식 판별
import katex from 'katex'

/* ── 수식 자동 고침 기호표 ──
 * \epsilon/\varepsilon, \phi/\varphi는 KaTeX 모양이 달라 서로 다른 유니코드로 구분 (저장 시 정확히 되돌리기 위해) */
export const SYMBOLS = {
  pm: '±', mp: '∓', times: '×', cdot: '⋅', div: '÷', approx: '≈', neq: '≠', le: '≤', ge: '≥', infty: '∞',
  partial: '∂', nabla: '∇', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔',
  otimes: '⊗', oplus: '⊕', sum: '∑', int: '∫',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
}
const REVERSE = new Map(Object.entries(SYMBOLS).map(([k, v]) => [v, k]))
const SYM_RE = new RegExp(`[${[...REVERSE.keys()].join('')}]`, 'g')

/** 화면용 기호 → 표준 LaTeX (뒤에 영문자가 오면 명령이 이어 붙지 않게 공백) */
export function toLatex(s = '') {
  return s.replace(SYM_RE, (ch, i, str) => `\\${REVERSE.get(ch)}${/[A-Za-z]/.test(str[i + 1] || '') ? ' ' : ''}`)
}

/** 표준 LaTeX → 화면용 기호 (행렬 셀처럼 '보기 좋게' 편집하는 칸에 불러올 때) */
export function toSymbols(s = '') {
  return s.replace(/(?<!\\)\\([A-Za-z]+)(?![A-Za-z]) ?/g, (m, name) => SYMBOLS[name] || m)
}

/**
 * Space를 누른 순간 커서 앞이 '\기호명'이면 기호로 바꾼 결과 { value, caret }, 아니면 null
 * (Space 자체는 넣지 않음 — PowerPoint와 같은 감각)
 */
export function autoCorrectSpace(el) {
  const pos = el.selectionStart
  if (pos == null || pos !== el.selectionEnd) return null
  const before = el.value.slice(0, pos)
  const m = /\\([A-Za-z]+)$/.exec(before)
  if (!m || !SYMBOLS[m[1]] || before[m.index - 1] === '\\') return null
  const sym = SYMBOLS[m[1]]
  return { value: before.slice(0, m.index) + sym + el.value.slice(pos), caret: m.index + sym.length }
}

export function isValidLatex(latex, displayMode = false) {
  try {
    katex.renderToString(latex, { displayMode, throwOnError: true, strict: 'ignore' })
    return true
  } catch {
    return false
  }
}

/* ── 행렬 분해 / 재조립 ── */
const ENV_RE = /\\begin\{(bmatrix|pmatrix|vmatrix|Vmatrix|Bmatrix|matrix)\}/
export const hasMatrix = (latex = '') => ENV_RE.test(latex)

/** 중괄호 · 중첩 환경 밖의 행 구분(\\) 또는 열 구분(&)으로 나눔 */
function splitTop(s, kind) {
  const parts = []
  let cur = ''
  let depth = 0
  let env = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      if (s.startsWith('\\begin{', i)) env++
      else if (s.startsWith('\\end{', i)) env--
      if (kind === 'row' && s[i + 1] === '\\' && depth === 0 && env === 0) {
        parts.push(cur)
        cur = ''
        i++
        continue
      }
      cur += ch + (s[i + 1] ?? '') // \& \{ 같은 이스케이프는 두 글자 그대로
      i++
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (kind === 'col' && ch === '&' && depth === 0 && env === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

/** 첫 번째 행렬 환경을 { pre, env, rows: string[][], post }로 (행렬이 없거나 짝이 맞지 않으면 null) */
export function parseMatrix(latex = '') {
  const m = ENV_RE.exec(latex)
  if (!m) return null
  const bodyStart = m.index + m[0].length
  const re = /\\(begin|end)\{[A-Za-z*]+\}/g
  re.lastIndex = bodyStart
  let depth = 0
  let end = -1
  let endLen = 0
  for (let t; (t = re.exec(latex)); ) {
    if (t[1] === 'begin') depth++
    else if (depth === 0) {
      end = t.index
      endLen = t[0].length
      break
    } else depth--
  }
  if (end < 0) return null
  let rows = splitTop(latex.slice(bodyStart, end), 'row').map((r) => splitTop(r, 'col').map((c) => c.trim()))
  if (rows.length > 1 && rows[rows.length - 1].every((c) => !c)) rows.pop() // 끝에 붙은 \\ 정리
  const cols = Math.max(...rows.map((r) => r.length))
  rows = rows.map((r) => [...r, ...Array(cols - r.length).fill('')])
  return { pre: latex.slice(0, m.index).trim(), env: m[1], rows, post: latex.slice(end + endLen).trim() }
}

export function serializeMatrix({ pre = '', env, rows, post = '' }) {
  const body = rows.map((r) => r.map((c) => c.trim()).join(' & ')).join(' \\\\ ')
  return [pre.trim(), `\\begin{${env}} ${body} \\end{${env}}`, post.trim()].filter(Boolean).join(' ')
}

/* ── 본문 '$ … $' 판별 ──
 * - 여는 $ 바로 뒤, 닫는 $ 바로 앞은 공백이 아니어야 함 / 앞뒤로 $·\·영숫자가 붙어 있으면 제외 (US$5, \$ 등)
 * - '$100 …' 처럼 숫자로 시작해 공백이 이어지는 금액 표기는 제외
 * - KaTeX로 실제 해석되는 경우만 수식으로 */
export function acceptDollarMath(body) {
  if (!body || /^\s|\s$/.test(body)) return false
  if (/^\d[\d.,]*(\s|$)/.test(body)) return false
  return isValidLatex(body.replace(/\n/g, ' '))
}
export const DOLLAR_PASTE_RE = /(?<![$\\\w])\$([^$\s](?:[^$\n]*?[^$\s\\])?)\$(?![\d$])/g
