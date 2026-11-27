// 수식 입력 상자 아래에 뜨는 콤팩트 퀵 팔레트 (편집 화면 전용 — 저장 HTML·뷰어·네이버 복사와 무관)
// - 버튼을 눌러도 입력 상자 포커스가 유지되도록 팔레트 전체에서 mousedown 기본 동작을 막음
// - 템플릿 문법: '§' = 삽입 후 커서 자리, '§a¦' = 'a'를 선택 상태로(바로 덮어쓰기), '◊' = 입력 상자에서 선택한 글자를 감쌀 자리
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import katex from 'katex'
import { matrixTemplate } from './mathLive.js'

const T = (label, ins, preview) => ({ label, ins, preview: preview ?? ins.replace(/[§¦◊]/g, '') })
// 구조 편집기(MathLive)용 삽입 문법을 따로 가진 템플릿 (행렬 원소를 모두 빈 칸 #?로)
const M = (label, ins, ml) => ({ ...T(label, ins), ml })
const S = (tex) => T(tex, `${tex} `, tex) // 기호: 뒤에 공백을 붙여 다음 글자와 명령이 붙지 않게
const W = (cmd) => T(`${cmd}{}`, `${cmd}{◊§}`, `${cmd}{${/math(bf|rm)/.test(cmd) ? 'Ab' : 'x'}}`) // 감싸기: 선택한 글자가 있으면 그 글자를 감쌈

export const PALETTE = [
  {
    id: 'matrix',
    label: '행렬·괄호',
    groups: [
      {
        items: [
          M('2×2 대괄호 행렬', '\\begin{bmatrix} §a¦ & b \\\\ c & d \\end{bmatrix}', matrixTemplate('bmatrix', 2, 2)),
          M('3×3 대괄호 행렬', '\\begin{bmatrix} §a¦ & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}', matrixTemplate('bmatrix', 3, 3)),
          M('2×2 소괄호 행렬', '\\begin{pmatrix} §a¦ & b \\\\ c & d \\end{pmatrix}', matrixTemplate('pmatrix', 2, 2)),
          M('행렬식 (det)', '\\begin{vmatrix} §a¦ & b \\\\ c & d \\end{vmatrix}', matrixTemplate('vmatrix', 2, 2)),
          M('열벡터 (2×1)', '\\begin{bmatrix} §x¦ \\\\ y \\end{bmatrix}', matrixTemplate('bmatrix', 2, 1)),
          M('조건식 (cases)', '\\begin{cases} §x¦, & \\text{if } x \\ge 0 \\\\ -x, & \\text{otherwise} \\end{cases}', '\\begin{cases} #?, & \\text{if } #? \\\\ #?, & \\text{otherwise} \\end{cases}'),
        ],
      },
    ],
  },
  {
    id: 'struct',
    label: '구조',
    groups: [
      {
        items: [
          T('분수 \\frac{}{}', '\\frac{◊§}{}', '\\dfrac{a}{b}'),
          T('제곱 ^{}', '^{§}', '\\large x^{2}'),
          T('아래첨자 _{}', '_{§}', '\\large x_{i}'),
          T('루트 \\sqrt{}', '\\sqrt{◊§}', '\\large\\sqrt{x}'),
          T('합 \\sum_{i=1}^{N}', '\\sum_{§i=1¦}^{N} ', '\\displaystyle\\sum_{i=1}^{N}'),
          T('적분 \\int_{a}^{b}', '\\int_{§a¦}^{b} ', '\\displaystyle\\int_{a}^{b}'),
          T('편미분 \\frac{\\partial }{\\partial }', '\\frac{\\partial §}{\\partial }', '\\dfrac{\\partial f}{\\partial x}'),
          T('극한 \\lim_{x \\to \\infty}', '\\lim_{§x \\to \\infty¦} ', '\\displaystyle\\lim_{x \\to \\infty}'),
          T('곱 \\prod_{i=1}^{N}', '\\prod_{§i=1¦}^{N} ', '\\displaystyle\\prod_{i=1}^{N}'),
          T('이중적분 \\iint_{D}', '\\iint_{§D¦} ', '\\displaystyle\\iint_{D}'),
          T('선적분 \\oint_{C}', '\\oint_{§C¦} ', '\\displaystyle\\oint_{C}'),
          T('소괄호 \\left( \\right)', '\\left( ◊§ \\right)', '\\left( x \\right)'),
          T('대괄호 \\left[ \\right]', '\\left[ ◊§ \\right]', '\\left[ x \\right]'),
          T('중괄호 \\left\\{ \\right\\}', '\\left\\{ ◊§ \\right\\}', '\\left\\{ x \\right\\}'),
          T('절댓값 \\left| \\right|', '\\left| ◊§ \\right|', '\\left| x \\right|'),
          T('노름 \\left\\| \\right\\|', '\\left\\| ◊§ \\right\\|', '\\left\\| x \\right\\|'),
        ],
      },
    ],
  },
  {
    id: 'symbol',
    label: '기호·그리스',
    groups: [
      { title: '벡터·서체', items: ['\\mathbf', '\\mathrm', '\\vec', '\\hat', '\\tilde', '\\bar'].map(W) },
      {
        title: '연산자·관계',
        items: ['\\nabla', '\\times', '\\cdot', '\\otimes', '\\approx', '\\neq', '\\le', '\\ge', '\\infty', '\\rightarrow', '\\Leftrightarrow'].map(S),
      },
      {
        title: '그리스 문자',
        items: [
          '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon', '\\theta', '\\lambda', '\\mu',
          '\\pi', '\\rho', '\\sigma', '\\tau', '\\phi', '\\varphi', '\\omega', '\\Delta', '\\Omega',
        ].map(S),
      },
    ],
  },
]

// 미리보기 아이콘은 한 번만 렌더링해 재사용
const iconCache = new Map()
function icon(tex) {
  if (!iconCache.has(tex)) {
    iconCache.set(tex, katex.renderToString(tex, { throwOnError: false, strict: 'ignore', displayMode: false }))
  }
  return iconCache.get(tex)
}

/** 템플릿을 입력값의 선택 범위 [s, e)에 삽입 → { value, selStart, selEnd } */
export function applyTemplate(value, s, e, ins) {
  const picked = value.slice(s, e)
  let text = ins.replace('◊', picked)
  // 감쌀 글자가 있었으면 커서는 감싼 글자 뒤(닫는 괄호 앞)로
  let caret = text.indexOf('§')
  text = text.replace('§', '')
  let end = text.indexOf('¦')
  if (end >= 0) text = text.replace('¦', '')
  else end = caret
  if (caret < 0) caret = end = text.length
  return { value: value.slice(0, s) + text + value.slice(e), selStart: s + caret, selEnd: s + end }
}

/** 호버 툴팁: 이름 + LaTeX 문법 (이름에 문법이 이미 들어 있으면 이름만) */
const tip = (it) => {
  const tex = it.ins.replace(/[§¦◊]/g, '').trim()
  return it.label.includes(tex) ? it.label : `${it.label}\n${tex}`
}

const COLLAPSE_KEY ='math-palette-collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export default function MathPalette({ anchorRef, onInsert, deps }) {
  const [tab, setTab] = useState('matrix')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [place, setPlace] = useState(null)
  const [node, setNode] = useState(null)

  // 입력 상자 바로 아래(공간이 없으면 위)에, 화면 좌우 밖으로 나가지 않게 배치
  useLayoutEffect(() => {
    const measure = () => {
      const a = anchorRef.current
      if (!a || !node) return
      const r = a.getBoundingClientRect()
      const { width, height } = node.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const left = Math.min(Math.max(r.left, 12), Math.max(12, vw - 12 - width))
      const below = r.bottom + 8 + height <= window.innerHeight - 8 || r.top - 8 - height < 70
      const top = below ? r.bottom + 8 : r.top - 8 - height
      setPlace((p) => (p && p.left === left && p.top === top ? p : { left, top }))
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [anchorRef, node, tab, collapsed, deps])

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })
  }

  const current = PALETTE.find((t) => t.id === tab)
  return createPortal(
    <div
      ref={setNode}
      className={`math-pal ${collapsed ? 'is-collapsed' : ''}`}
      role="toolbar"
      aria-label="수식 템플릿·기호"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
      onMouseDown={(e) => e.preventDefault()} // 버튼을 눌러도 수식 입력 상자 포커스 유지
    >
      <div className="math-pal-head">
        {collapsed ? (
          <span className="math-pal-title">수식 도구</span>
        ) : (
          <div className="math-pal-tabs" role="tablist">
            {PALETTE.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                className={`math-pal-tab ${t.id === tab ? 'is-on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="math-pal-fold" onClick={toggle} title={collapsed ? '펼치기' : '접기'} aria-label={collapsed ? '수식 도구 펼치기' : '수식 도구 접기'}>
          {collapsed ? '▾' : '▴'}
        </button>
      </div>
      {!collapsed && (
        <div className={`math-pal-body is-${tab}`} role="tabpanel">
          {current.groups.map((g, gi) => (
            <div key={gi} className="math-pal-group">
              {g.title && <div className="math-pal-gtitle">{g.title}</div>}
              <div className="math-pal-grid">
                {g.items.map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    className="math-pal-btn"
                    title={tip(it)}
                    aria-label={it.label}
                    onClick={() => onInsert(it.ins, it)}
                  >
                    <span className="math-pal-icon" dangerouslySetInnerHTML={{ __html: icon(it.preview) }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
