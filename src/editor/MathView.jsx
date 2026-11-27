// MS Word 방식 수식 상자
// - 수식 노드가 선택되면(삽입 직후 · 클릭 · ←/→/↑/↓로 진입) 그 자리에서 LaTeX 입력 상자로 바뀜
// - Enter / Esc / 바깥 클릭 → KaTeX로 확정, 커서는 수식 바로 오른쪽(블록 수식은 아래 줄)으로
// - 상자 테두리·핸들·드롭다운은 편집 화면 전용 → 저장 HTML(뷰어·네이버 복사)에는 data-latex만 남음
// - 행렬이 들어 있는 수식: 클릭하면 선택 표시만(LaTeX로 풀지 않음) → 더블 클릭 = 시각적 행렬 편집기, Enter = LaTeX 편집
// - '\pm' + Space → '±' 같은 수식 자동 고침 (저장 시 표준 LaTeX로)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import katex from 'katex'
import { renderLatex } from '../lib/math.js'
import MathPalette, { applyTemplate } from './MathPalette.jsx'
import MatrixEditor from './MatrixEditor.jsx'
import { autoCorrectSpace, hasMatrix, toLatex } from './mathTools.js'

export const MATH_PLACEHOLDER = '여기에 수식을 입력하세요.'

function parseError(latex, display) {
  try {
    katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: 'ignore' })
    return null
  } catch (e) {
    return e.message.replace(/^KaTeX parse error: /, '')
  }
}

export default function MathView({ node, editor, getPos, selected }) {
  const display = node.type.name === 'mathBlock'
  const latex = node.attrs.latex || ''
  const editing = selected && editor.isEditable
  const html = useMemo(() => (latex ? renderLatex(latex, display) : ''), [latex, display])

  const [value, setValue] = useState(latex)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const done = useRef(false) // 한 번의 편집에서 확정이 두 번(Enter 후 blur) 일어나지 않게
  const boxRef = useRef(null)
  const pendingSel = useRef(null) // 팔레트로 삽입한 뒤 옮길 입력 커서/선택 범위
  const enterSide = useRef(null)
  // 'raw' = LaTeX 입력 상자 / 'selected' = 행렬 수식 선택 표시 / 'matrix' = 시각적 행렬 편집기
  const [modeState, setMode] = useState(null) // null = 자동(행렬이면 'selected', 아니면 'raw') — 첫 렌더부터 정확히
  const isMatrix = hasMatrix(latex)
  const mode = modeState ?? (isMatrix ? 'selected' : 'raw')
  const wrapRef = useRef(null)

  // 행렬 수식 더블 클릭 → 시각적 행렬 편집기 (노드 뷰 안이라 React 합성 이벤트 대신 DOM 이벤트로)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onDbl = (e) => {
      if (!editor.isEditable || !hasMatrix(node.attrs.latex) || e.target.closest?.('.mx-editor, .math-box')) return
      e.preventDefault()
      const pos = getPos()
      if (typeof pos === 'number' && !(editor.state.selection instanceof NodeSelection && editor.state.selection.from === pos)) {
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
      }
      setMode('matrix')
    }
    el.addEventListener('dblclick', onDbl)
    return () => el.removeEventListener('dblclick', onDbl)
  })

  // 퀵 팔레트: 현재 커서(선택) 위치에 템플릿 삽입 → 첫 입력 자리로 커서 이동, 포커스 유지
  const insertTemplate = (ins) => {
    const el = inputRef.current
    if (!el) return
    const s = el.selectionStart ?? el.value.length
    const e = el.selectionEnd ?? s
    const r = applyTemplate(el.value, s, e, ins)
    done.current = false
    setValue(r.value)
    setError(null)
    pendingSel.current = [r.selStart, r.selEnd]
  }
  useLayoutEffect(() => {
    const sel = pendingSel.current
    const el = inputRef.current
    if (!sel || !el) return
    pendingSel.current = null
    el.focus({ preventScroll: true })
    el.setSelectionRange(sel[0], sel[1])
  }, [value])

  // 편집 시작: 원본 LaTeX를 불러옴. 행렬 수식은 LaTeX로 풀지 않고 선택 표시부터
  useLayoutEffect(() => {
    if (!editing) {
      setMode(null)
      return
    }
    done.current = false
    setValue(latex)
    setError(null)
    enterSide.current = editor.storage.mathNav?.enterSide
    if (editor.storage.mathNav) editor.storage.mathNav.enterSide = null
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  // LaTeX 입력 상자가 열리면 바로 포커스
  useLayoutEffect(() => {
    if (!editing || mode !== 'raw') return
    done.current = false
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      const side = enterSide.current
      const at = side === 'end' || side == null ? el.value.length : 0
      el.setSelectionRange(at, at)
    })
  }, [editing, mode])

  // 행렬 수식 선택 상태: Enter → LaTeX 편집, Esc → 선택 해제 (나머지 키는 에디터 기본 동작: 방향키 이동 · Backspace 삭제)
  useEffect(() => {
    if (!editing || mode !== 'selected') return
    const onKey = (e) => {
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        setMode('raw')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        done.current = false
        commit('after', latex)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  /**
   * 확정: 값이 있으면 latex 갱신, 비었으면 수식 삭제.
   * move: 'after' | 'before' | 'up' | 'down' | null(커서 이동 없음 — 바깥 클릭으로 빠져나갈 때)
   */
  const commit = (move = 'after', override) => {
    if (done.current) return
    done.current = true
    const pos = getPos()
    if (typeof pos !== 'number') return
    const { state, view } = editor
    const cur = state.doc.nodeAt(pos)
    if (!cur || cur.type !== node.type) return
    // 화면용 기호(±, α …)는 표준 LaTeX 명령으로 되돌려 저장
    const text = override ?? toLatex(inputRef.current?.value ?? value).trim()
    let tr = state.tr
    if (!text) {
      tr = tr.delete(pos, pos + cur.nodeSize)
      if (move) tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
    } else {
      if (text !== cur.attrs.latex) tr = tr.setNodeMarkup(pos, undefined, { ...cur.attrs, latex: text })
      if (move) {
        const end = pos + cur.nodeSize
        if (!display) {
          tr = tr.setSelection(TextSelection.create(tr.doc, move === 'before' || move === 'up' ? pos : end))
        } else if (move === 'before' || move === 'up') {
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos), -1))
        } else {
          // 블록 수식 아래: 다음 문단이 없으면 새 빈 줄을 만들어 커서를 둠
          const next = tr.doc.resolve(end).nodeAfter
          if (!next || !next.isTextblock) tr = tr.insert(end, state.schema.nodes.paragraph.create())
          tr = tr.setSelection(TextSelection.create(tr.doc, end + 1))
        }
      }
    }
    if (move) tr = tr.scrollIntoView()
    view.dispatch(tr)
    if (move) view.focus()
  }

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    if (e.key === ' ') {
      // 수식 자동 고침: '\pm' + Space → '±'
      const r = autoCorrectSpace(el)
      if (r) {
        e.preventDefault()
        setValue(r.value)
        pendingSel.current = [r.caret, r.caret]
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const err = el.value.trim() ? parseError(toLatex(el.value).trim(), display) : null
      if (err) {
        setError(err) // 문법 오류: 상자에 머물며 오류만 표시
        return
      }
      commit('after')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      commit('after')
    } else if (e.key === 'ArrowLeft' && atStart && !e.shiftKey) {
      e.preventDefault()
      commit('before')
    } else if (e.key === 'ArrowRight' && atEnd && !e.shiftKey) {
      e.preventDefault()
      commit('after')
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      commit(e.key === 'ArrowUp' ? 'up' : 'down')
    } else if (e.key === 'Backspace' && !el.value) {
      e.preventDefault()
      commit('before') // 빈 상자에서 Backspace → 수식 삭제
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit(e.shiftKey ? 'before' : 'after')
    }
  }

  // 인라인 ↔ 블록 전환: 노드를 바꾼 뒤 새 노드를 다시 선택해 편집 상자 유지
  const toggleDisplay = () => {
    const pos = getPos()
    if (typeof pos !== 'number') return
    const text = toLatex(inputRef.current?.value ?? value).trim()
    const typeName = display ? 'mathInline' : 'mathBlock'
    done.current = true
    if (editor.storage.mathNav) editor.storage.mathNav.enterSide = 'end'
    editor.chain().insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: typeName, attrs: { latex: text } }).run()
    const { state, view } = editor
    let at = null
    let best = Infinity
    state.doc.descendants((n, p) => {
      if (n.type.name === typeName && n.attrs.latex === text && Math.abs(p - pos) < best) {
        best = Math.abs(p - pos)
        at = p
      }
    })
    if (at != null) view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, at)))
  }

  // Alt+3을 상자 안에서 다시 누르면 인라인 ↔ 블록 전환 (Write의 단축키 처리기가 이벤트로 알려 줌)
  useEffect(() => {
    if (!editing || mode !== 'raw') return
    const on = () => toggleDisplay()
    window.addEventListener('math-toggle-display', on)
    return () => window.removeEventListener('math-toggle-display', on)
  })

  return (
    <NodeViewWrapper
      as={display ? 'div' : 'span'}
      className={`math-node ${display ? 'is-block' : 'is-inline'} ${editing ? 'is-editing' : ''} ${!latex && !editing ? 'is-empty' : ''}`}
      data-type={display ? 'math-block' : 'math-inline'}
      title={editing && mode !== 'selected' ? undefined : isMatrix ? '더블 클릭: 행렬 편집기 · 클릭 후 Enter: LaTeX 편집' : '클릭하거나 ←/→ 키로 들어가 수식 수정'}
      ref={wrapRef}
    >
      {editing && mode === 'matrix' ? (
        <MatrixEditor
          latex={latex}
          display={display}
          onCommit={(text, move) => {
            done.current = false
            commit(move, text)
          }}
          onCancel={(move = 'after') => {
            done.current = false
            commit(move, latex)
          }}
        />
      ) : editing && mode === 'raw' ? (
        <>
        <span
          ref={boxRef}
          className={`math-box ${error ? 'has-error' : ''}`}
          title="Enter 확정 · Esc 닫기 · Alt+3 인라인/블록 전환"
          onMouseDown={(e) => {
            if (e.target === inputRef.current) return
            e.preventDefault() // 상자 여백·배지를 눌러도 입력 포커스 유지 (커서는 끝으로)
            const el = inputRef.current
            el?.focus()
            el?.setSelectionRange(el.value.length, el.value.length)
          }}
        >
          <input
            ref={inputRef}
            className="math-box-input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => (done.current = false)}
            onBlur={() => {
              // 다른 창/탭으로 전환한 경우는 확정하지 않음 (돌아오면 계속 편집)
              if (document.hasFocus()) commit(null)
            }}
            placeholder={MATH_PLACEHOLDER}
            spellCheck={false}
            autoComplete="off"
            aria-label="LaTeX 수식 입력 (Enter 확정)"
            style={{ width: `${value ? Math.max(2, value.length + 1) : MATH_PLACEHOLDER.length * 1.95}ch` }}
          />
          <span className="math-box-hint" aria-hidden>
            Enter ↵
          </span>
          {error && (
            <span className="math-box-error" role="alert">
              {error}
            </span>
          )}
        </span>
        <MathPalette anchorRef={boxRef} onInsert={insertTemplate} deps={`${value}|${error}`} />
        </>
      ) : (
        <>
          <span className={`math-render ${editing ? 'is-picked' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
          {editing && mode === 'selected' && (
            <span className="math-pick-hint" aria-hidden>
              더블 클릭: 행렬 편집 · Enter: LaTeX
            </span>
          )}
        </>
      )}
    </NodeViewWrapper>
  )
}
