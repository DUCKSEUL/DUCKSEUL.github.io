// PowerPoint(Office Math)식 구조 수식 편집기 — MathLive <math-field>
// - 본문에는 외곽 프레임 + 점선 빈 칸(⬚)만 있는 '순수 수식 입력창' (팔레트·버튼은 상단 [수식] 리본으로: MathRibbon.jsx)
// - 실시간 조립: a/b → 분수, x^2 · S_11 → 첨자, '\mathrm{S}' · '\alpha' · '\pm' + Space → 기호/서체, Space = 현재 칸 밖으로
// - ← → ↑ ↓ / Tab으로 분자↔분모, 첨자↔본문, 행렬 칸 사이 이동 · Backspace는 구조 한 단계씩
// - Enter · 바깥 클릭 → 표준 LaTeX로 확정(KaTeX 렌더링) / Esc → 확정 후 빠져나감
import { useEffect, useRef, useState } from 'react'
import { SHADOW_CSS, cleanLatex, loadMathLive, toMathLiveTemplate } from './mathLive.js'
import { isValidLatex } from './mathTools.js'
import { clearMathRibbon, publishMathRibbon } from './mathRibbonStore.js'

/** 커서가 행렬 안이면 그 환경 이름 (커서 위치 원소에서 부모 쪽으로 올라가며 행렬(array) 찾기) */
function matrixEnvAtCaret(mf) {
  try {
    const model = mf._mathfield?.model
    for (let a = model?.at(model.position); a; a = a.parent) {
      if (a.type === 'array' && /matrix$/.test(a.environmentName || '')) return a.environmentName
    }
  } catch {
    /* 내부 구조가 바뀐 경우: 행렬 편집 버튼만 비활성 (우클릭 메뉴로도 행·열 조절 가능) */
  }
  return null
}

/** 커서가 첨자·분자/분모·근호 등 칸 안이면 1 이상, 수식 맨 바깥이면 0 */
function caretDepth(mf) {
  try {
    const model = mf._mathfield?.model
    let d = 0
    for (let a = model?.at(model.position)?.parent; a && a.type !== 'root'; a = a.parent) d++
    return d
  } catch {
    return 1 // 알 수 없으면 기본 동작(칸 밖으로)
  }
}

export default function VisualMath({ latex, display, enterSide, apiRef, onCommit, onRaw }) {
  const boxRef = useRef(null)
  const hostRef = useRef(null)
  const mfRef = useRef(null)
  const done = useRef(false)
  const owner = useRef({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [matrixEnv, setMatrixEnv] = useState(null)

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

  const run = (cmd) => {
    const mf = mfRef.current
    if (!mf) return
    mf.focus()
    mf.executeCommand(cmd)
    setMatrixEnv(matrixEnvAtCaret(mf))
  }

  const insertTemplate = (item) => {
    const mf = mfRef.current
    if (!mf) return
    mf.focus()
    mf.insert(item.ml || toMathLiveTemplate(item.ins), { format: 'latex', selectionMode: 'placeholder', focus: true })
    setError(null)
    setMatrixEnv(matrixEnvAtCaret(mf))
  }

  // 리본에서 부르는 동작은 항상 최신 렌더의 함수로 (클로저 고정 방지)
  const live = useRef(null)
  live.current = {
    finish: () => finish('after'),
    insert: insertTemplate,
    run,
    toggleMode: () => {
      done.current = true
      onRaw(current())
    },
  }

  // 상단 툴바 → PowerPoint [수식] 리본으로 전환 (행렬 안/밖이 바뀔 때마다 갱신)
  useEffect(() => {
    if (!ready) return
    publishMathRibbon({
      owner: owner.current,
      kind: 'visual',
      matrixEnv,
      finish: () => live.current.finish(),
      insert: (it) => live.current.insert(it),
      run: (cmd) => live.current.run(cmd),
      toggleMode: () => live.current.toggleMode(),
    })
  }, [ready, matrixEnv])
  useEffect(() => () => clearMathRibbon(owner.current), [])

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
      // 새로 치는 글자가 앞 노드의 서체(\mathbf · \mathrm …)를 물려받지 않게 — '\mathbf{\eta}' 뒤 '_12'의 12는 보통 글꼴 (PowerPoint와 같음)
      mf.onInsertStyle = () => ({})
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
        const plain = !e.altKey && !e.ctrlKey && !e.metaKey
        // PowerPoint식 선형 입력 보정 (LaTeX 명령 입력 중('\…')에는 MathLive 기본 동작 그대로)
        //  - '{' '}': 묶음은 칸 구조가 대신하므로 글자 괄호로 넣지 않음 → '_{12}' = '_12', '}' = 현재 칸 밖으로
        //  - Space: 첨자·분모 등 칸 안이면 그 칸 밖으로(조립된 노드는 그대로 유지), 맨 바깥이면 아무것도 안 함(상자가 닫히지 않게)
        if (plain && mf.mode !== 'latex' && (e.key === '{' || e.key === '}' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
          if (e.key !== '{' && caretDepth(mf) > 0) mf.executeCommand('moveAfterParent')
          return
        }
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
      const onSel = () => setMatrixEnv(matrixEnvAtCaret(mf))
      const onInput = () => setError(null)
      const onFocusOut = (e) => {
        // 다른 창으로 전환했거나, 상단 리본 등 편집기 안으로 포커스가 옮겨 가면 그대로
        // 바로 확정해야 함: 에디터가 선택을 바꿔 이 편집기가 사라지기 전에
        if (!document.hasFocus()) return
        if (e.relatedTarget && (boxRef.current?.contains(e.relatedTarget) || e.relatedTarget.closest?.('.math-ribbon'))) return
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
          if (inLatex) mf.executeCommand('complete')
          else if (caretDepth(mf) > 0) mf.executeCommand('moveAfterParent')
          inLatex = false
        } else if (!inLatex && (ch === '{' || ch === '}')) {
          if (ch === '}' && caretDepth(mf) > 0) mf.executeCommand('moveAfterParent')
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

  return (
    <span
      ref={boxRef}
      className={`ml-box ${display ? 'is-block' : ''} ${error ? 'has-error' : ''}`}
      title="Enter 확정 · Esc 닫기 · 상단 [수식] 리본에서 구조·기호 삽입"
      onMouseDown={(e) => {
        // 프레임 여백을 눌러도 수식 칸 포커스 유지
        if (e.target === mfRef.current) return
        e.preventDefault()
        mfRef.current?.focus()
      }}
    >
      <span ref={hostRef} className="ml-host" />
      {!ready && <span className="ml-loading">수식 편집기 준비 중…</span>}
      {error && (
        <span className="math-box-error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
