// PowerPoint [수식] 리본 — 수식 입력 모드 동안 에디터 상단 툴바 자리에 표시
// - 도구(완료 · 인라인/블록 · TeX 원문) | 기호 갤러리 | 구조(분수 · 첨자 · 근호 · 적분 · 대형 연산자 · 괄호 · 악센트 · 행렬) | 행렬 편집
// - 모든 버튼·드롭다운은 mousedown 기본 동작을 막아 본문 수식 칸의 포커스·커서 위치를 그대로 유지
// - 구조 템플릿은 점선 빈 칸(⬚, MathLive '#?')으로 삽입되고 첫 빈 칸이 선택됨
//   템플릿 표기: ins = LaTeX 원문 상자용('§' 커서 · '◊' 선택 글자 · '§a¦' 예시 선택) / ml = 구조 편집기용('#?' 빈 칸 · '#0' 선택 영역)
import { useEffect, useRef, useState } from 'react'
import { mathIcon } from './MathPalette.jsx'
import { matrixTemplate } from './mathLive.js'

const T = (label, ins, ml, preview) => ({ label, ins, ml, preview: preview ?? ins.replace(/[§¦◊]/g, '') })
const SYM = (tex, ch, label) => ({ label: label || tex, ins: `${tex} `, ml: tex, ch })

const SYMBOLS = [
  SYM('\\pm', '±', '플러스마이너스 \\pm'),
  SYM('\\infty', '∞', '무한대 \\infty'),
  SYM('\\neq', '≠', '같지 않음 \\neq'),
  SYM('\\approx', '≈', '근사 \\approx'),
  SYM('\\le', '≤', '작거나 같음 \\le'),
  SYM('\\ge', '≥', '크거나 같음 \\ge'),
  SYM('\\times', '×', '곱하기 \\times'),
  SYM('\\div', '÷', '나누기 \\div'),
  SYM('\\cdot', '·', '점 곱 \\cdot'),
  SYM('\\partial', '∂', '편미분 \\partial'),
  SYM('\\nabla', '∇', '나블라 \\nabla'),
  SYM('\\sum', '∑', '합 \\sum'),
  SYM('\\prod', '∏', '곱 \\prod'),
  SYM('\\int', '∫', '적분 \\int'),
  SYM('\\rightarrow', '→', '오른쪽 화살표 \\rightarrow'),
  SYM('\\leftarrow', '←', '왼쪽 화살표 \\leftarrow'),
  SYM('\\Rightarrow', '⇒', '이면 \\Rightarrow'),
  SYM('\\Leftrightarrow', '⇔', '동치 \\Leftrightarrow'),
  SYM('\\alpha', 'α'),
  SYM('\\beta', 'β'),
  SYM('\\gamma', 'γ'),
  SYM('\\delta', 'δ'),
  SYM('\\epsilon', 'ε'),
  SYM('\\theta', 'θ'),
  SYM('\\lambda', 'λ'),
  SYM('\\mu', 'μ'),
  SYM('\\pi', 'π'),
  SYM('\\rho', 'ρ'),
  SYM('\\sigma', 'σ'),
  SYM('\\tau', 'τ'),
  SYM('\\phi', 'φ'),
  SYM('\\omega', 'ω'),
  SYM('\\Delta', 'Δ'),
  SYM('\\Omega', 'Ω'),
]

export const STRUCTURES = [
  {
    id: 'frac',
    label: '분수',
    icon: '\\frac{x}{y}',
    items: [
      T('세로 분수', '\\frac{◊§}{}', '\\frac{#0}{#?}', '\\dfrac{\\square}{\\square}'),
      T('사선 분수', '{◊§}/{}', '{#0}/{#?}', '\\square/\\square'),
      T('편미분 분수', '\\frac{\\partial §}{\\partial }', '\\frac{\\partial #?}{\\partial #?}', '\\dfrac{\\partial\\square}{\\partial\\square}'),
      T('미분 분수', '\\frac{d§}{d}', '\\frac{d#?}{d#?}', '\\dfrac{d\\square}{d\\square}'),
    ],
  },
  {
    id: 'script',
    label: '첨자',
    icon: 'e^x',
    items: [
      T('위첨자', '{◊§}^{}', '{#0}^{#?}', '\\square^{\\square}'),
      T('아래첨자', '{◊§}_{}', '{#0}_{#?}', '\\square_{\\square}'),
      T('위·아래 첨자', '{◊§}_{}^{}', '{#0}_{#?}^{#?}', '\\square_{\\square}^{\\square}'),
    ],
  },
  {
    id: 'radical',
    label: '근호',
    icon: '\\sqrt[n]{x}',
    items: [
      T('제곱근', '\\sqrt{◊§}', '\\sqrt{#0}', '\\sqrt{\\square}'),
      T('n제곱근', '\\sqrt[§]{}', '\\sqrt[#?]{#0}', '\\sqrt[\\square]{\\square}'),
    ],
  },
  {
    id: 'integral',
    label: '적분',
    icon: '\\int_{-x}^{x}',
    items: [
      T('정적분', '\\int_{§}^{} ', '\\int_{#?}^{#?}#?', '\\displaystyle\\int_{\\square}^{\\square}\\square'),
      T('부정적분', '\\int § ', '\\int #?', '\\displaystyle\\int\\square'),
      T('이중적분', '\\iint_{§} ', '\\iint_{#?}#?', '\\displaystyle\\iint_{\\square}\\square'),
      T('선적분', '\\oint_{§} ', '\\oint_{#?}#?', '\\displaystyle\\oint_{\\square}\\square'),
    ],
  },
  {
    id: 'large',
    label: '대형 연산자',
    icon: '\\sum_{i=0}^{n}',
    items: [
      T('시그마 합', '\\sum_{§}^{} ', '\\sum_{#?}^{#?}#?', '\\displaystyle\\sum_{\\square}^{\\square}\\square'),
      T('곱', '\\prod_{§}^{} ', '\\prod_{#?}^{#?}#?', '\\displaystyle\\prod_{\\square}^{\\square}\\square'),
      T('극한', '\\lim_{§ \\to } ', '\\lim_{#?\\to #?}#?', '\\displaystyle\\lim_{\\square\\to\\square}\\square'),
    ],
  },
  {
    id: 'bracket',
    label: '괄호',
    icon: '\\{()\\}',
    items: [
      T('소괄호', '\\left( ◊§ \\right)', '\\left(#0\\right)', '\\left(\\square\\right)'),
      T('대괄호', '\\left[ ◊§ \\right]', '\\left[#0\\right]', '\\left[\\square\\right]'),
      T('중괄호', '\\left\\{ ◊§ \\right\\}', '\\left\\{#0\\right\\}', '\\left\\{\\square\\right\\}'),
      T('절댓값', '\\left| ◊§ \\right|', '\\left|#0\\right|', '\\left|\\square\\right|'),
      T('노름', '\\left\\| ◊§ \\right\\|', '\\left\\|#0\\right\\|', '\\left\\|\\square\\right\\|'),
    ],
  },
  {
    id: 'accent',
    label: '악센트',
    icon: '\\ddot{a}',
    items: [
      T('벡터 화살표', '\\vec{◊§}', '\\vec{#0}', '\\vec{\\square}'),
      T('햇', '\\hat{◊§}', '\\hat{#0}', '\\hat{\\square}'),
      T('바', '\\bar{◊§}', '\\bar{#0}', '\\bar{\\square}'),
      T('물결', '\\tilde{◊§}', '\\tilde{#0}', '\\tilde{\\square}'),
      T('점', '\\dot{◊§}', '\\dot{#0}', '\\dot{\\square}'),
      T('굵은 벡터', '\\mathbf{◊§}', '\\mathbf{#0}', '\\mathbf{A}'),
      T('정체(로만)', '\\mathrm{◊§}', '\\mathrm{#0}', '\\mathrm{S}'),
    ],
  },
  {
    id: 'matrix',
    label: '행렬',
    icon: '\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}',
    items: [
      T('2×2 행렬', '\\begin{bmatrix} §a¦ & b \\\\ c & d \\end{bmatrix}', matrixTemplate('bmatrix', 2, 2), '\\begin{bmatrix}\\square&\\square\\\\\\square&\\square\\end{bmatrix}'),
      T('3×3 행렬', '\\begin{bmatrix} §a¦ & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}', matrixTemplate('bmatrix', 3, 3), '\\begin{bmatrix}\\square&\\square&\\square\\\\\\square&\\square&\\square\\\\\\square&\\square&\\square\\end{bmatrix}'),
      T('2×1 열벡터', '\\begin{bmatrix} §x¦ \\\\ y \\end{bmatrix}', matrixTemplate('bmatrix', 2, 1), '\\begin{bmatrix}\\square\\\\\\square\\end{bmatrix}'),
      T('1×2 행벡터', '\\begin{bmatrix} §x¦ & y \\end{bmatrix}', matrixTemplate('bmatrix', 1, 2), '\\begin{bmatrix}\\square&\\square\\end{bmatrix}'),
      T('2×2 소괄호 행렬', '\\begin{pmatrix} §a¦ & b \\\\ c & d \\end{pmatrix}', matrixTemplate('pmatrix', 2, 2), '\\begin{pmatrix}\\square&\\square\\\\\\square&\\square\\end{pmatrix}'),
      T('행렬식', '\\begin{vmatrix} §a¦ & b \\\\ c & d \\end{vmatrix}', matrixTemplate('vmatrix', 2, 2), '\\begin{vmatrix}\\square&\\square\\\\\\square&\\square\\end{vmatrix}'),
      T(
        '조건식 (cases)',
        '\\begin{cases} §x¦, & \\text{if } x \\ge 0 \\\\ -x, & \\text{otherwise} \\end{cases}',
        '\\begin{cases} #?, & \\text{if } #? \\\\ #?, & \\text{otherwise} \\end{cases}',
        '\\begin{cases}\\square&\\square\\\\\\square&\\square\\end{cases}',
      ),
    ],
  },
]

const BRACKETS = [
  { env: 'bmatrix', label: '[ ]', title: '대괄호 행렬' },
  { env: 'pmatrix', label: '( )', title: '소괄호 행렬' },
  { env: 'vmatrix', label: '| |', title: '행렬식' },
]

const keep = (e) => e.preventDefault()

function Icon({ tex }) {
  return <span className="mr-katex" aria-hidden dangerouslySetInnerHTML={{ __html: mathIcon(tex) }} />
}

/** 구조 드롭다운: 큰 아이콘 버튼 + 아래로 펼쳐지는 템플릿 갤러리 */
function StructMenu({ group, open, onToggle, onPick }) {
  const ref = useRef(null)
  return (
    <div className={`mr-struct ${open ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="mr-big" onClick={onToggle} aria-expanded={open} aria-haspopup="true" title={group.label} data-struct={group.id}>
        <Icon tex={group.icon} />
        <span className="mr-big-label">
          {group.label} <span className="mr-caret">▾</span>
        </span>
      </button>
      {open && (
        <div className="mr-drop" role="menu" aria-label={group.label}>
          {group.items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className="mr-drop-item" title={it.label} onClick={() => onPick(it)}>
              <Icon tex={it.preview} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MathRibbon({ api }) {
  const [openId, setOpenId] = useState(null)
  const rootRef = useRef(null)

  // 드롭다운 바깥을 누르면 닫기
  useEffect(() => {
    if (!openId) return
    const off = (e) => !rootRef.current?.contains(e.target) && setOpenId(null)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [openId])

  const visual = api.kind === 'visual'
  const inMatrix = visual && !!api.matrixEnv
  const pick = (it) => {
    setOpenId(null)
    api.insert(it)
  }

  return (
    <div className="toolbar math-ribbon" role="toolbar" aria-label="수식 도구 리본" ref={rootRef} onMouseDown={keep}>
      <div className="mr-group">
        <div className="mr-tools">
          <button type="button" className="mr-done" onClick={() => api.finish()} title="수식 확정 (Enter)">
            ✓ 완료
          </button>
          <button type="button" className="mr-small" onClick={() => window.dispatchEvent(new Event('math-toggle-display'))} title="인라인 ↔ 블록(가운데 한 줄) 전환 (Alt+3)">
            인라인/블록
          </button>
          <button type="button" className="mr-small" onClick={() => api.toggleMode()} title={visual ? 'LaTeX 원문으로 편집' : '구조 편집(점선 칸)으로 돌아가기'}>
            {visual ? 'TeX 원문' : '⬚ 구조'}
          </button>
        </div>
        <span className="mr-cap">도구</span>
      </div>

      <div className="mr-group mr-symbols-group">
        <div className="mr-symbols" role="group" aria-label="기호">
          {SYMBOLS.map((s) => (
            <button key={s.ml} type="button" className="mr-sym" title={s.label} aria-label={s.label} onClick={() => api.insert(s)}>
              {s.ch}
            </button>
          ))}
        </div>
        <span className="mr-cap">기호</span>
      </div>

      <div className="mr-group">
        <div className="mr-structs">
          {STRUCTURES.map((g) => (
            <StructMenu key={g.id} group={g} open={openId === g.id} onToggle={() => setOpenId((o) => (o === g.id ? null : g.id))} onPick={pick} />
          ))}
        </div>
        <span className="mr-cap">구조</span>
      </div>

      {visual && (
        <div className={`mr-group mr-matrix ${inMatrix ? '' : 'is-off'}`}>
          <div className="mr-matrix-btns">
            <button type="button" disabled={!inMatrix} onClick={() => api.run('addRowAfter')} title="현재 칸 아래에 행 추가">+ 행</button>
            <button type="button" disabled={!inMatrix} onClick={() => api.run('removeRow')} title="현재 행 삭제">− 행</button>
            <button type="button" disabled={!inMatrix} onClick={() => api.run('addColumnAfter')} title="현재 칸 오른쪽에 열 추가">+ 열</button>
            <button type="button" disabled={!inMatrix} onClick={() => api.run('removeColumn')} title="현재 열 삭제">− 열</button>
            {BRACKETS.map((b) => (
              <button
                key={b.env}
                type="button"
                disabled={!inMatrix}
                className={api.matrixEnv === b.env ? 'is-on' : ''}
                onClick={() => api.run(['setEnvironment', b.env])}
                title={b.title}
              >
                {b.label}
              </button>
            ))}
          </div>
          <span className="mr-cap">{inMatrix ? '행렬 편집' : '행렬 편집 (행렬 안에서)'}</span>
        </div>
      )}
    </div>
  )
}
