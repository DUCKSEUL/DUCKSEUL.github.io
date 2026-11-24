// 커서(또는 수식) 바로 아래에 뜨는 작은 인라인 수식 입력 팝오버
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import katex from 'katex'

const SNIPPETS = [
  ['a/b', '\\frac{a}{b}'],
  ['x²', 'x^{2}'],
  ['xᵢ', 'x_{i}'],
  ['√', '\\sqrt{x}'],
  ['∫', '\\int_{a}^{b}'],
  ['∬', '\\iint_S'],
  ['Σ', '\\sum_{n=1}^{N}'],
  ['∇×', '\\nabla \\times'],
  ['𝐄', '\\mathbf{E}'],
  ['[ ]', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'],
  ['αβω', '\\alpha \\beta \\omega'],
]

const WIDTH = 440

export default function MathPopover({ state, onClose, onSubmit }) {
  const [latex, setLatex] = useState('')
  const [display, setDisplay] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const boxRef = useRef(null)
  const taRef = useRef(null)

  useEffect(() => {
    if (!state) return
    setLatex(state.latex || '')
    setDisplay(!!state.display)
  }, [state])

  useLayoutEffect(() => {
    if (!state) return
    const a = state.anchor
    const vw = document.documentElement.clientWidth
    const width = Math.min(WIDTH, vw - 24)
    const left = Math.max(12, Math.min(a.left, vw - width - 12)) + window.scrollX
    setPos({ left, top: a.bottom + window.scrollY + 8, width })
    requestAnimationFrame(() => {
      // 아래 공간(하단 글자 수 바 제외)이 부족하면 커서 위쪽으로 뒤집어 표시
      const h = boxRef.current?.offsetHeight || 260
      const room = window.innerHeight - 52 - a.bottom
      if (room < h + 12 && a.top - h - 8 > 70) {
        setPos({ left, top: a.top + window.scrollY - h - 8, width })
      } else if (room < h + 12) {
        boxRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      taRef.current?.focus()
      const len = taRef.current?.value.length || 0
      taRef.current?.setSelectionRange(len, len)
    })
  }, [state])

  useEffect(() => {
    if (!state) return
    const off = (e) => {
      if (!boxRef.current?.contains(e.target)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', off), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', off)
    }
  }, [state, onClose])

  const preview = useMemo(() => {
    if (!latex.trim()) return { html: '<span class="math-empty">LaTeX를 입력하면 미리보기가 나타나요</span>' }
    try {
      return { html: katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: 'ignore' }) }
    } catch (e) {
      return { error: e.message.replace(/^KaTeX parse error: /, '') }
    }
  }, [latex, display])

  if (!state) return null

  const submit = () => {
    if (!latex.trim() || preview.error) return
    onSubmit({ latex: latex.trim(), display, pos: state.pos ?? null })
  }

  const insertSnippet = (s) => {
    const ta = taRef.current
    const { selectionStart: a, selectionEnd: b } = ta
    setLatex(latex.slice(0, a) + s + latex.slice(b))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(a + s.length, a + s.length)
    })
  }

  const editing = state.pos != null

  return createPortal(
    <div
      ref={boxRef}
      className="math-pop"
      style={{ left: pos.left, top: pos.top, width: pos.width }}
      role="dialog"
      aria-label={editing ? '수식 수정' : '수식 입력'}
    >
      <div className="math-pop-head">
        <div className="seg sm" role="radiogroup" aria-label="수식 종류">
          <button role="radio" aria-checked={!display} className={!display ? 'is-active' : ''} onClick={() => setDisplay(false)}>
            인라인
          </button>
          <button role="radio" aria-checked={display} className={display ? 'is-active' : ''} onClick={() => setDisplay(true)}>
            블록
          </button>
        </div>
        <span className="math-pop-title">{editing ? '수식 수정' : '수식 입력'}</span>
      </div>
      <div className="math-pop-snips">
        {SNIPPETS.map(([label, s]) => (
          <button key={s} onClick={() => insertSnippet(s)} title={s}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={taRef}
        className="math-pop-input"
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        rows={Math.min(5, Math.max(1, latex.split('\n').length))}
        placeholder="\nabla \times \mathbf{E} = -j\omega\mu\mathbf{H}"
        spellCheck={false}
        aria-label="LaTeX 수식"
      />
      <div className={`math-pop-preview ${preview.error ? 'has-error' : ''}`} aria-live="polite">
        {preview.error ? <span className="math-error">{preview.error}</span> : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </div>
      <div className="math-pop-foot">
        <span>
          <kbd>Enter</kbd> 확정 · <kbd>Shift</kbd>+<kbd>Enter</kbd> 줄바꿈 · <kbd>Esc</kbd> 닫기
        </span>
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={!latex.trim() || !!preview.error}>
          {editing ? '수정' : '삽입'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
