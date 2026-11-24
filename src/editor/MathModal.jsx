import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import Modal from '../components/Modal.jsx'

const SNIPPETS = [
  ['분수', '\\frac{a}{b}'],
  ['위첨자', 'x^{2}'],
  ['아래첨자', 'x_{i}'],
  ['루트', '\\sqrt{x}'],
  ['적분', '\\int_{a}^{b} f(x)\\,dx'],
  ['면적분', '\\iint_S \\mathbf{F}\\cdot d\\mathbf{S}'],
  ['합', '\\sum_{n=1}^{N}'],
  ['벡터', '\\mathbf{E}'],
  ['나블라', '\\nabla \\times \\mathbf{H}'],
  ['행렬', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'],
  ['그리스', '\\alpha \\beta \\omega \\epsilon \\mu'],
]

export default function MathModal({ state, onClose, onSubmit }) {
  const open = !!state
  const [latex, setLatex] = useState('')
  const [display, setDisplay] = useState(false)
  const taRef = useRef(null)

  useEffect(() => {
    if (!state) return
    setLatex(state.latex || '')
    setDisplay(!!state.display)
    setTimeout(() => taRef.current?.focus(), 30)
  }, [state])

  const preview = useMemo(() => {
    if (!latex.trim()) return { html: '<span class="math-empty">수식을 입력하면 여기에 미리보기가 나타나요</span>' }
    try {
      return { html: katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: 'ignore' }) }
    } catch (e) {
      return { error: e.message.replace(/^KaTeX parse error: /, '') }
    }
  }, [latex, display])

  const insertSnippet = (s) => {
    const ta = taRef.current
    const { selectionStart: a, selectionEnd: b } = ta
    const next = latex.slice(0, a) + s + latex.slice(b)
    setLatex(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(a + s.length, a + s.length)
    })
  }

  const submit = () => {
    if (!latex.trim() || preview.error) return
    onSubmit({ latex: latex.trim(), display, pos: state.pos ?? null })
  }

  const editing = state?.pos != null

  return (
    <Modal
      open={open}
      title={editing ? '수식 수정' : '수식 입력'}
      onClose={onClose}
      width={640}
      footer={
        <>
          <span className="modal-hint">Ctrl + Enter로 {editing ? '수정' : '삽입'}</span>
          <button className="btn btn-md btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-md btn-primary" onClick={submit} disabled={!latex.trim() || !!preview.error}>
            {editing ? '수정하기' : '삽입하기'}
          </button>
        </>
      }
    >
      <div className="seg" role="radiogroup" aria-label="수식 종류">
        <button role="radio" aria-checked={!display} className={!display ? 'is-active' : ''} onClick={() => setDisplay(false)}>
          인라인 수식
        </button>
        <button role="radio" aria-checked={display} className={display ? 'is-active' : ''} onClick={() => setDisplay(true)}>
          블록 수식
        </button>
      </div>
      <div className="snippets">
        {SNIPPETS.map(([label, s]) => (
          <button key={label} onClick={() => insertSnippet(s)} title={s}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={taRef}
        className="math-input"
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="예: \nabla \times \mathbf{E} = -j\omega\mu \mathbf{H}"
        spellCheck={false}
        rows={4}
        aria-label="LaTeX 수식"
      />
      <p className="math-label">미리보기</p>
      <div className={`math-preview ${display ? 'is-block' : ''} ${preview.error ? 'has-error' : ''}`}>
        {preview.error ? <span className="math-error">{preview.error}</span> : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </div>
    </Modal>
  )
}
