// PowerPoint(Office Math)식 구조 수식 편집기 — MathLive <math-field>
// - 점선 빈 칸(⬚) · 실시간 조립: a/b → 분수, x^2 · S_11 → 첨자, '\mathrm{S}' · '\alpha' + Space → 기호/서체, Space = 현재 칸 밖으로
// - ← → ↑ ↓ / Tab으로 분자↔분모, 첨자↔본문, 행렬 칸 사이 이동 · Backspace는 구조 한 단계씩
// - 행렬 안에 커서가 있으면 위쪽 미니 바: + 행 / − 행 / + 열 / − 열 / [ ] ( ) | | (우클릭 메뉴에도 같은 기능)
// - Enter · 바깥 클릭 → 표준 LaTeX로 확정(KaTeX 렌더링) / Esc → 확정 후 빠져나감 / 'TeX' 버튼 → LaTeX 원문 편집
import { useEffect, useRef, useState } from 'react'
import MathPalette from './MathPalette.jsx'
import { SHADOW_CSS, cleanLatex, loadMathLive, toMathLiveTemplate } from './mathLive.js'
import { isValidLatex } from './mathTools.js'

const BRACKETS = [
  { env: 'bmatrix', label: '[ ]', title: '대괄호 행렬' },
  { env: 'pmatrix', label: '( )', title: '소괄호 행렬' },
  { env: 'vmatrix', label: '| |', title: '행렬식' },
]

/** 커서가 행렬 안이면 그 환경 이름 (커서 위치 원소에서 부모 쪽으로 올라가며 행렬(array) 찾기) */
function matrixEnvAtCaret(mf) {
  try {
    const model = mf._mathfield?.model
    for (let a = model?.at(model.position); a; a = a.parent) {
      if (a.type === 'array' && /matrix$/.test(a.environmentName || '')) return a.environmentName
    }
  } catch {
    /* 내부 구조가 바뀐 경우: 미니 바만 숨김 (우클릭 메뉴로도 행·열 조절 가능) */
  }
  return null
}

export default function VisualMath({ latex, display, enterSide, apiRef, onCommit, onRaw }) {
  const boxRef = useRef(null)
  const hostRef = useRef(null)
  const mfRef = useRef(null)
  const done = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [matrixEnv, setMatrixEnv] = useState(null)
  const [tick, setTick] = useState(0) // 팔레트 위치 다시 계산용

  const current = () => cleanLatex(mfRef.current?.getValue('latex') ?? latex)
  if (apiRef) apiRef.current = { get: current }

  /** move: 'after' | 'before' | 'up' | 'down' | null(바깥 클릭 — 커서 그대로) */
  const finish = (move) => {
    if (done.current) return
    const text = current()
    if (text && !isValidLatex(text, display)) {
      if (move === null) {
        done.current = true
        onCommit(latex, null) // 문법 오류인 채로 바깥을 누르면 원래 수식 유지
      } else setError('수식을 해석할 수 없어요. 빈 칸이나 괄호를 확인해 주세요.')
      return
    }
    done.current = true
    onCommit(text, move)
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    let alive = true
    done.current = false // (개발 모드 StrictMode의 재마운트 대비)
    // 편집기가 포커스를 받기 전(불러오는 짧은 순간)에 친 글자는 본문으로 새지 않게 모아 두었다가 넘겨줌
    const queue = []
    const buffer = (e) => {
      if (mfRef.current && document.activeElement === mfRef.current) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      if (e.key.length === 1 || ['Enter', 'Backspace', 'Tab'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        if (e.key.length === 1) queue.push(e.key)
      }
    }
    window.addEventListener('keydown', buffer, true)
    loadMathLive().then(({ MathfieldElement }) => {
      if (!alive || !hostRef.current) return
      const mf = new MathfieldElement()
      mf.smartFence = false // \left( \right)를 자동으로 만들지 않음 (KaTeX 호환 · 예측 가능한 괄호)
      mf.smartMode = false
      mf.mathVirtualKeyboardPolicy = 'manual'
      mf.defaultMode = 'math'
      mf.className = 'ml-field'
      hostRef.current.appendChild(mf)
      mf.value = latex
      if (mf.shadowRoot && !mf.shadowRoot.querySelector('style[data-dk]')) {
        const st = document.createElement('style')
        st.dataset.dk = '1'
        st.textContent = SHADOW_CSS
        mf.shadowRoot.appendChild(st)
      }
      mfRef.current = mf

      const onKey = (e) => {
        if (e.isComposing) return
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          finishRef.current('after')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finishRef.current('after')
        } else if (e.key === 'Backspace' && !mf.getValue('latex').trim()) {
          e.preventDefault()
          e.stopPropagation()
          finishRef.current('before') // 빈 상자에서 Backspace → 수식 삭제
        }
      }
      const onMoveOut = (e) => {
        const d = e.detail?.direction
        e.preventDefault()
        finishRef.current(d === 'backward' ? 'before' : d === 'upward' ? 'up' : d === 'downward' ? 'down' : 'after')
      }
      const onSel = () => {
        setMatrixEnv(matrixEnvAtCaret(mf))
      }
      const onInput = () => {
        setError(null)
        setTick((t) => t + 1)
      }
      const onFocusOut = (e) => {
        // 다른 창으로 전환했거나, 팔레트·미니 바 등 편집기 안으로 포커스가 옮겨 가면 그대로
        // 바로 확정해야 함: 에디터가 선택을 바꿔 이 편집기가 사라지기 전에
        if (!document.hasFocus() || (e.relatedTarget && boxRef.current?.contains(e.relatedTarget))) return
        finishRef.current(null)
      }
      mf.addEventListener('keydown', onKey, { capture: true })
      mf.addEventListener('move-out', onMoveOut)
      mf.addEventListener('selection-change', onSel)
      mf.addEventListener('input', onInput)
      mf.addEventListener('focusout', onFocusOut)
      setReady(true)
      mf.focus({ preventScroll: true })
      mf.executeCommand(enterSide === 'start' ? 'moveToMathfieldStart' : 'moveToMathfieldEnd')
      window.removeEventListener('keydown', buffer, true)
      // 모아 둔 글자를 실제로 친 것처럼 재생: '\' → LaTeX 명령 입력, Space → 명령 완료(또는 현재 칸 밖으로)
      let inLatex = false
      for (const ch of queue) {
        if (ch === '\\' && !inLatex) {
          mf.executeCommand(['switchMode', 'latex'])
          mf.executeCommand(['typedText', '\\'])
          inLatex = true
        } else if (ch === ' ') {
          mf.executeCommand(inLatex ? 'complete' : 'moveAfterParent')
          inLatex = false
        } else mf.executeCommand(['typedText', ch])
      }
      onSel()
    })
    return () => {
      alive = false
      window.removeEventListener('keydown', buffer, true)
      done.current = true // 노드 교체(인라인↔블록 전환 등)로 사라질 때 늦게 오는 blur 확정 막기
      mfRef.current?.remove()
      mfRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = (cmd) => {
    const mf = mfRef.current
    if (!mf) return
    mf.focus()
    mf.executeCommand(cmd)
    setMatrixEnv(matrixEnvAtCaret(mf))
    setTick((t) => t + 1)
  }

  const insertTemplate = (ins, item) => {
    const mf = mfRef.current
    if (!mf) return
    mf.focus()
    mf.insert(item?.ml || toMathLiveTemplate(ins), { format: 'latex', selectionMode: 'placeholder', focus: true })
    setError(null)
    setTick((t) => t + 1)
  }

  return (
    <>
      <span
        ref={boxRef}
        className={`ml-box ${display ? 'is-block' : ''} ${error ? 'has-error' : ''}`}
        onMouseDown={(e) => {
          // 프레임 여백·버튼을 눌러도 수식 칸 포커스 유지
          if (e.target === mfRef.current) return
          e.preventDefault()
          mfRef.current?.focus()
        }}
      >
        {matrixEnv && (
          <span className="ml-matrix-bar" role="toolbar" aria-label="행렬 편집">
            <button type="button" onClick={() => run('addRowAfter')} title="현재 칸 아래에 행 추가">+ 행</button>
            <button type="button" onClick={() => run('removeRow')} title="현재 행 삭제">− 행</button>
            <button type="button" onClick={() => run('addColumnAfter')} title="현재 칸 오른쪽에 열 추가">+ 열</button>
            <button type="button" onClick={() => run('removeColumn')} title="현재 열 삭제">− 열</button>
            <span className="mx-sep" />
            {BRACKETS.map((b) => (
              <button key={b.env} type="button" className={matrixEnv === b.env ? 'is-on' : ''} onClick={() => run(['setEnvironment', b.env])} title={b.title}>
                {b.label}
              </button>
            ))}
          </span>
        )}
        <span ref={hostRef} className="ml-host" />
        {!ready && <span className="ml-loading">수식 편집기 준비 중…</span>}
        <button
          type="button"
          className="ml-tex"
          title="LaTeX 원문으로 편집"
          onClick={() => {
            done.current = true
            onRaw(current())
          }}
        >
          TeX
        </button>
        <span className="math-box-hint" aria-hidden>
          Enter ↵
        </span>
        {error && (
          <span className="math-box-error" role="alert">
            {error}
          </span>
        )}
      </span>
      {ready && <MathPalette anchorRef={boxRef} onInsert={insertTemplate} deps={`${tick}|${matrixEnv}|${error}`} />}
    </>
  )
}
