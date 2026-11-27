// PowerPoint 스타일 시각적 행렬 편집기 (행렬이 들어 있는 수식을 더블 클릭하면 열림)
// - 괄호 모양([ ] / ( ) / | |)은 그대로 보이고, 원소마다 점선 입력 칸 — 행렬 앞뒤 수식(예: \mathbf S^{(x)} =)도 각각 별도 칸
// - Tab / Shift+Tab / 방향키로 칸 이동
// - 칸마다 Word/PPT식 Space 빌드업: '\mathrm{S}' + Space → 렌더링된 칩, Backspace로 원본 되돌리기 (BuildupField)
//   기존 원소는 렌더링된 칩으로 보여 줌 → 고칠 때는 클릭 또는 Backspace
// - 위쪽 미니 바: + 행 / − 행 / + 열 / − 열 / 괄호 전환 / 완료
// - Enter 또는 바깥 클릭 → LaTeX로 재조립해 확정 (Ctrl+Z로 되돌리기), Esc → 변경 취소
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isValidLatex, parseMatrix, serializeMatrix } from './mathTools.js'
import BuildupField, { fieldFrom, fieldLatex } from './BuildupField.jsx'

const BRACKETS = [
  { env: 'bmatrix', label: '[ ]', title: '대괄호 (bmatrix)' },
  { env: 'pmatrix', label: '( )', title: '소괄호 (pmatrix)' },
  { env: 'vmatrix', label: '| |', title: '행렬식 (vmatrix)' },
]

const EMPTY = () => ({ tokens: [], text: '' })

export default function MatrixEditor({ latex, display, onCommit, onCancel }) {
  const [state, setState] = useState(() => {
    const m = parseMatrix(latex)
    return { pre: fieldFrom(m.pre), post: fieldFrom(m.post), env: m.env, rows: m.rows.map((r) => r.map((c) => fieldFrom(c))) }
  })
  const [error, setError] = useState(null)
  const refs = useRef({}) // 'pre' | 'post' | 'r-c' → { current: input }
  const refOf = (key) => (refs.current[key] ||= { current: null })
  const focusKey = useRef('0-0')
  const pending = useRef(null) // 다음 렌더 후 포커스할 { key, caret }
  const boxRef = useRef(null)
  const done = useRef(false)

  const { rows, env } = state
  const nRows = rows.length
  const nCols = rows[0]?.length || 1
  const order = ['pre', ...rows.flatMap((r, ri) => r.map((_, ci) => `${ri}-${ci}`)), 'post']

  const focus = (key, caret = 'end') => {
    const el = refs.current[key]?.current
    if (!el) return
    el.focus({ preventScroll: true })
    const at = caret === 'start' ? 0 : caret === 'end' ? el.value.length : caret
    el.setSelectionRange(at, at)
    focusKey.current = key
  }
  useLayoutEffect(() => {
    if (!pending.current) return
    const { key, caret } = pending.current
    pending.current = null
    focus(key, caret)
  })
  // 열리면 첫 번째 원소에 포커스
  useEffect(() => {
    requestAnimationFrame(() => focus('0-0', 'end'))
  }, [])

  const setField = (key, value) =>
    setState((s) => {
      if (key === 'pre' || key === 'post') return { ...s, [key]: value }
      const [r, c] = key.split('-').map(Number)
      return { ...s, rows: s.rows.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row)) }
    })

  const build = () =>
    serializeMatrix({
      pre: fieldLatex(state.pre),
      post: fieldLatex(state.post),
      env: state.env,
      rows: state.rows.map((r) => r.map(fieldLatex)),
    })

  /** move: 'after' = 커서를 수식 오른쪽으로(Enter·완료) / null = 커서 이동 없음(바깥 클릭 — 클릭한 자리 그대로) */
  const commit = (move = 'after') => {
    if (done.current) return
    const text = build()
    if (!isValidLatex(text, display)) {
      if (move) setError('수식 문법을 확인해 주세요.')
      else {
        done.current = true
        onCancel(null) // 문법 오류인 채로 바깥을 누르면 원래 수식 유지
      }
      return
    }
    done.current = true
    onCommit(text, move)
  }
  const cancel = () => {
    if (done.current) return
    done.current = true
    onCancel()
  }

  const cur = () => {
    const k = focusKey.current
    if (k === 'pre') return [0, 0]
    if (k === 'post') return [nRows - 1, nCols - 1]
    return k.split('-').map(Number)
  }
  const ops = {
    addRow: () => {
      const [r, c] = cur()
      setState((s) => ({ ...s, rows: [...s.rows.slice(0, r + 1), Array.from({ length: nCols }, EMPTY), ...s.rows.slice(r + 1)] }))
      pending.current = { key: `${r + 1}-${c}`, caret: 'end' }
    },
    delRow: () => {
      if (nRows <= 1) return
      const [r, c] = cur()
      setState((s) => ({ ...s, rows: s.rows.filter((_, i) => i !== r) }))
      pending.current = { key: `${Math.min(r, nRows - 2)}-${c}`, caret: 'end' }
    },
    addCol: () => {
      const [r, c] = cur()
      setState((s) => ({ ...s, rows: s.rows.map((row) => [...row.slice(0, c + 1), EMPTY(), ...row.slice(c + 1)]) }))
      pending.current = { key: `${r}-${c + 1}`, caret: 'end' }
    },
    delCol: () => {
      if (nCols <= 1) return
      const [r, c] = cur()
      setState((s) => ({ ...s, rows: s.rows.map((row) => row.filter((_, i) => i !== c)) }))
      pending.current = { key: `${r}-${Math.min(c, nCols - 2)}`, caret: 'end' }
    },
    bracket: (next) => {
      setState((s) => ({ ...s, env: next }))
      pending.current = { key: focusKey.current, caret: 'end' }
    },
  }

  const onKeyDown = (key) => (e) => {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    const idx = order.indexOf(key)
    const move = (to, caret) => {
      e.preventDefault()
      if (to) focus(to, caret)
    }
    // Space 빌드업 · 칩 되돌리기는 BuildupField가 먼저 처리
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Tab') {
      move(order[idx + (e.shiftKey ? -1 : 1)], 'end')
    } else if (e.key === 'ArrowLeft' && atStart && !e.shiftKey) {
      move(order[idx - 1], 'end')
    } else if (e.key === 'ArrowRight' && atEnd && !e.shiftKey) {
      move(order[idx + 1], 'start')
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && key.includes('-')) {
      const [r, c] = key.split('-').map(Number)
      const nr = r + (e.key === 'ArrowUp' ? -1 : 1)
      move(nr >= 0 && nr < nRows ? `${nr}-${c}` : e.key === 'ArrowUp' ? 'pre' : 'post', 'end')
    }
    if (error && e.key.length === 1) setError(null)
  }

  // 바깥 클릭(포커스가 편집기 밖으로) → 즉시 확정 (에디터가 선택을 바꿔 편집기가 닫히기 전에)
  // 칸 사이 이동(relatedTarget이 편집기 안)이나 다른 창으로 전환한 경우는 그대로 둠
  const onBlur = (e) => {
    if (done.current || !document.hasFocus()) return
    if (e.relatedTarget && boxRef.current?.contains(e.relatedTarget)) return
    commit(null)
  }

  const input = (key, field, cls, placeholder) => (
    <BuildupField
      key={key}
      field={field}
      inputRef={refOf(key)}
      className={cls}
      inputClassName="mx-input"
      placeholder={placeholder}
      minCh={placeholder ? 3 : 2}
      onChange={(f) => setField(key, f)}
      onKeyDown={onKeyDown(key)}
      onFocus={() => (focusKey.current = key)}
      aria-label={key === 'pre' ? '행렬 앞 수식' : key === 'post' ? '행렬 뒤 수식' : `${Number(key.split('-')[0]) + 1}행 ${Number(key.split('-')[1]) + 1}열`}
    />
  )

  return (
    <span ref={boxRef} className={`mx-editor ${display ? 'is-block' : ''} ${error ? 'has-error' : ''}`} onBlur={onBlur}>
      <span className="mx-bar" role="toolbar" aria-label="행렬 편집" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" onClick={ops.addRow} title="현재 칸 아래에 행 추가">+ 행</button>
        <button type="button" onClick={ops.delRow} disabled={nRows <= 1} title="현재 행 삭제">− 행</button>
        <button type="button" onClick={ops.addCol} title="현재 칸 오른쪽에 열 추가">+ 열</button>
        <button type="button" onClick={ops.delCol} disabled={nCols <= 1} title="현재 열 삭제">− 열</button>
        <span className="mx-sep" />
        {BRACKETS.map((b) => (
          <button key={b.env} type="button" className={env === b.env ? 'is-on' : ''} onClick={() => ops.bracket(b.env)} title={b.title}>
            {b.label}
          </button>
        ))}
        <span className="mx-sep" />
        <button type="button" className="mx-done" onClick={() => commit()} title="확정 (Enter)">완료 ↵</button>
      </span>
      {input('pre', state.pre, 'mx-side', '앞')}
      <span className={`mx-mat is-${env}`} style={{ gridTemplateColumns: `repeat(${nCols}, auto)` }}>
        {rows.map((row, ri) => row.map((v, ci) => input(`${ri}-${ci}`, v, 'mx-cell')))}
      </span>
      {input('post', state.post, 'mx-side', '뒤')}
      {error && (
        <span className="mx-error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
