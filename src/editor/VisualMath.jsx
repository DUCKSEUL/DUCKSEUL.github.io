// PowerPoint(Office Math)식 구조 수식 편집기 — MathLive <math-field>
// - 본문에는 외곽 프레임 + 점선 빈 칸(⬚)만 있는 '순수 수식 입력창' (팔레트·버튼은 상단 [수식] 리본으로: MathRibbon.jsx)
// - Space 전용 조립: 'η_{zz}' · 'x^{2}' · 'a/b' · '\frac{a}{b}' · '\mathrm{S}' · '\pm'은 Space를 누르기 전까지 글자 그대로,
//   Space를 누르는 순간에만 구조로 조립(커서는 구조 오른쪽 바깥) — 조립된 노드는 다시 코드로 풀리지 않음
// - ← → ↑ ↓ / Tab으로 분자↔분모, 첨자↔본문, 행렬 칸 사이 이동 · Backspace는 구조 한 단계씩
// - Enter · 바깥 클릭 → 표준 LaTeX로 확정(KaTeX 렌더링) / Esc → 확정 후 빠져나감
import { useEffect, useRef, useState } from 'react'
import { EMPTY_PAIRS, SHADOW_CSS, WRAP_BRACKETS, cleanLatex, linearToLatex, loadMathLive, toMathLiveTemplate } from './mathLive.js'
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

/* ── Space 전용 조립 (Strict Space-Only Build-up) ──
 * '_' '^' '/' '\' '{' '}'를 치면 커서 주변의 '아직 평범한 글자 줄'(예: sin(20∘))을 원문 칸(MathLive LaTeX 모드: 친 글자가 그대로 보임)으로
 * 풀고 그 자리에 친 글자를 그대로 넣음 → 'sin(20\circ)' 중간에 '^'를 넣어도 'sin(20^\circ)' 글자 그대로, 위첨자로 튀거나 사라지지 않음
 * 원문 칸 안에서는 ← → 로 자유롭게 이동·수정, Space를 누르는 순간 원문 전체(+ 첨자·분수면 바로 앞 노드)를 PowerPoint 선형 형식으로
 * 해석해 한 번에 조립 · 커서는 구조 오른쪽 바깥 / 이미 조립된 구조(분수·첨자 등)는 풀지 않음 */
const RAW_START = new Set(['_', '^', '/', '\\', '{', '}'])
// 원문 칸으로 풀어도 되는 '평범한' 원자: 글자·숫자·연산자·괄호·기호 (첨자·분수·근호 같은 구조는 제외)
const SIMPLE_TYPES = new Set(['mord', 'mbin', 'mrel', 'mopen', 'mclose', 'mpunct', 'minner'])
const isSimple = (a) =>
  !!a && SIMPLE_TYPES.has(a.type) && typeof a.value === 'string' && !a.subscript && !a.superscript && !(a.body && a.body.length) && !a.above && !a.below &&
  !a.style?.variantStyle && (!a.style?.variant || a.style.variant === 'normal') // 굵게·정체 등 서식 있는 글자는 풀지 않음(서식 보존)

const modelOf = (mf) => mf._mathfield?.model

const rawText = (mf) => {
  const g = modelOf(mf)?.atoms?.find((a) => a.type === 'latexgroup')
  return g ? (g.body || []).filter((a) => a.type === 'latex' && !a.isSuggestion).map((a) => a.value).join('') : null
}

/** 원문 칸 안에서 커서가 맨 앞/맨 끝인지 */
function rawEdge(mf) {
  const model = modelOf(mf)
  const g = model?.atoms?.find((a) => a.type === 'latexgroup')
  if (!g) return { start: true, end: true }
  const pos = model.position
  return { start: pos <= model.offsetOf(g.firstChild), end: pos >= model.offsetOf(g.lastChild) }
}

/** 원문 칸 시작: 커서 양옆의 평범한 글자 줄을 원문으로 풀고, 친 글자를 커서 자리에 그대로 */
function startRaw(mf, ch) {
  const model = modelOf(mf)
  let left = ''
  let right = ''
  if (model && model.selectionIsCollapsed) {
    const pos = model.position
    const cur = model.at(pos)
    // 왼쪽(이미 조립된 기호 η · 글자)은 절대 원문으로 되돌리지 않음 — Space 때 바로 앞 노드를 밑수·분자로 받아 결합
    // 오른쪽은 '_' '^' '/'를 중간에 끼워 넣을 때만 원문으로 풀어 함께 해석 (예: 20|∘) 에 '^' → 20 + '^\circ)')
    const L = 0
    let R = 0
    if (ch === '_' || ch === '^' || ch === '/') for (let a = cur?.rightSibling; isSimple(a); a = a.rightSibling) R++
    try {
      if (L) left = mf.getValue(pos - L, pos, 'latex')
      if (R) right = mf.getValue(pos, pos + R, 'latex')
      if (L || R) {
        mf.selection = { ranges: [[pos - L, pos + R]], direction: 'forward' }
        mf.executeCommand('deleteBackward')
      }
    } catch {
      left = right = ''
    }
  }
  mf.executeCommand(['switchMode', 'latex'])
  const join = (a, b) => a + (/\\[a-zA-Z]+$/.test(a) && /^[A-Za-z]/.test(b) ? ' ' : '') + b
  mf.insert(join(left, ch), { format: 'plain-text' })
  if (right) {
    mf.insert(join(ch, right).slice(ch.length), { format: 'plain-text' })
    const n = join(ch, right).length - ch.length
    for (let k = 0; k < n; k++) mf.executeCommand('moveToPreviousChar')
  }
}

/** 바로 앞의 피연산자 원자 개수 — 연속된 영문/숫자 한 글자 원자는 한 덩어리('ab/c' → \frac{ab}{c}), 그 밖에는 원자 1개 */
function operandSize(mf) {
  const model = modelOf(mf)
  if (!model) return 0
  let a = model.at(model.position)
  if (!a || a.type === 'first') return 0
  const simple = (x) => x && x.type === 'mord' && typeof x.value === 'string' && /^[A-Za-z0-9.]$/.test(x.value) && !x.subscript && !x.superscript
  if (!simple(a)) return 1
  let n = 0
  while (simple(a)) {
    n++
    a = a.leftSibling
  }
  return n
}

/** 원문 칸 조립: true = 조립함 */
function flushRaw(mf) {
  if (mf.mode !== 'latex') return false
  const raw = rawText(mf)
  mf.executeCommand(['complete', 'reject']) // 원문 칸 제거 (조립은 아래에서 직접)
  if (!raw) return true
  let prev = ''
  if (/^[_^/]/.test(raw)) {
    const n = operandSize(mf)
    for (let k = 0; k < n; k++) mf.executeCommand('extendSelectionBackward')
    if (n) prev = mf.getValue(mf.selection, 'latex')
  }
  const tex = linearToLatex(prev + raw)
  mf.insert(tex, { format: 'latex', selectionMode: /\{\}|#\?|\placeholder/.test(tex) ? 'placeholder' : 'after', focus: true })
  return true
}

/** 수식 칸에서 Space: 바로 앞이 빈 괄호 쌍 '()' '[]' '||' '<>'이면 큰 괄호 + 가운데 점선 칸으로 */
function buildPair(mf) {
  const model = modelOf(mf)
  const b = model?.at(model.position)
  const a = b?.leftSibling
  if (!isSimple(a) || !isSimple(b)) return false
  const ch = (x) => x.command || x.value // '|'는 value가 '∣'(U+2223)라 command로 비교
  const pair = EMPTY_PAIRS.find(([k]) => k === `${ch(a)}${ch(b)}`)
  if (!pair) return false
  mf.executeCommand('extendSelectionBackward')
  mf.executeCommand('extendSelectionBackward')
  mf.insert(pair[1], { format: 'latex', selectionMode: 'placeholder', focus: true })
  return true
}

/** Ctrl+B 굵게(\mathbf) · Ctrl+I 기울임 해제/적용(정체 \mathrm ↔ 기본 기울임) — 선택 영역, 없으면 커서 바로 앞 글자 */
function toggleStyle(mf, variantStyle) {
  if (mf.mode === 'latex') flushRaw(mf)
  const model = modelOf(mf)
  const collapsed = model ? model.selectionIsCollapsed : true
  if (collapsed) {
    const prev = model?.at(model.position)
    if (!prev || prev.type === 'first') return
    mf.executeCommand('extendSelectionBackward')
  }
  // 굵게 · 기울임을 서로 지우지 않고 조합: 보통(기울임) ↔ 정체(\mathrm), 굵은 정체(\mathbf) ↔ 굵은 기울임(\boldsymbol)
  const r = modelOf(mf)?.selection?.ranges?.[0]
  const cur = (r && modelOf(mf).at(Math.min(r[0], r[1]) + 1)?.style?.variantStyle) || ''
  const NEXT = {
    bold: { '': 'bold', up: 'bold', bold: '', bolditalic: '' },
    up: { '': 'up', up: '', bold: 'bolditalic', bolditalic: 'bold' },
  }
  const next = NEXT[variantStyle][cur] ?? variantStyle
  if (next) mf.applyStyle({ variantStyle: next }, { operation: 'set' })
  else if (cur) mf.applyStyle({ variantStyle: cur }, { operation: 'toggle' }) // 서식 해제
  if (collapsed) mf.executeCommand('moveToNextChar')
}

/**
 * 글자 하나 처리 — true면 여기서 처리함(기본 동작 막기), false면 MathLive 기본 입력
 * - 원문 칸 안: Space = 조립, '}'는 글자로만(자동 조립 막기), 나머지 글자는 그대로 쌓임
 * - 수식 칸: 수식을 선택한 채 여는 괄호 = 큰 괄호로 감싸기 / '_' '^' '/' '\' '{' '}' = 원문 칸 시작 /
 *   Space = 빈 괄호 쌍이면 [⬚] 조립, 칸 안이면 밖으로, 맨 바깥이면 아무것도 안 함(상자가 닫히지 않게)
 */
function typeChar(mf, ch) {
  if (mf.mode === 'latex') {
    if (ch === '}') {
      // MathLive는 '\frac{1}{2}'처럼 필수 인자의 '}'가 닫히는 순간 바로 조립함 → 글자로만 넣고 Space를 기다림
      mf.insert('}', { format: 'plain-text' })
      return true
    }
    if (ch !== ' ') return false
    flushRaw(mf)
    return true
  }
  const model = modelOf(mf)
  if (model && !model.selectionIsCollapsed && WRAP_BRACKETS[ch]) {
    mf.insert(WRAP_BRACKETS[ch], { format: 'latex', selectionMode: 'after', focus: true })
    return true
  }
  if (RAW_START.has(ch)) {
    startRaw(mf, ch)
    return true
  }
  if (ch === '|') {
    // MathLive는 '||'를 곧바로 '\|'(노름)로 바꿈 → 글자 '|' 그대로 넣고 Space 때 '||' → |⬚| 조립
    mf.insert('|', { format: 'latex', selectionMode: 'after' })
    return true
  }
  if (ch === ' ') {
    if (buildPair(mf)) return true
    if (caretDepth(mf) > 0) mf.executeCommand('moveAfterParent')
    return true
  }
  return false
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

  const current = () => {
    const mf = mfRef.current
    if (mf && mf.mode === 'latex') flushRaw(mf) // 원문 칸이 남아 있으면 조립한 뒤 읽기 (Enter · 바깥 클릭 · 리본)
    return cleanLatex(mf?.getValue('latex') ?? latex)
  }
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
    flushRaw(mf)
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
      // 키 하나 칠 때마다 바뀌는 자동 변환 끄기: 'pi' → π · 'sqrt' 같은 인라인 단축어, 위첨자 숫자 자동 탈출 (마운트 뒤에만 설정 가능)
      mf.inlineShortcuts = {}
      // '\cd' → '\cdot' 같은 자동 완성 제안 끄기: 제안 글자가 원문 칸에 끼어 → 키로 받아들여지며 원문이 조립돼 버림
      mf.popoverPolicy = 'off'
      mf.smartSuperscript = false
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
        if (plain && e.key.length === 1 && typeChar(mf, e.key)) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        // Ctrl+B 굵게 · Ctrl+I 기울임(정체 ↔ 기울임) — 본문 서식 명령으로 새지 않게 여기서 처리
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[bi]$/i.test(e.key)) {
          e.preventDefault()
          e.stopPropagation()
          toggleStyle(mf, e.key.toLowerCase() === 'b' ? 'bold' : 'up')
          return
        }
        // 원문 칸: ← → 는 원문 안에서 자유롭게 이동(조립하지 않음) · 원문 끝을 벗어나거나 ↑ ↓ Tab이면 먼저 조립
        if (mf.mode === 'latex' && !e.shiftKey && /^(Arrow(Left|Right|Up|Down)|Tab)$/.test(e.key)) {
          e.preventDefault()
          e.stopPropagation()
          const edge = rawEdge(mf)
          // MathLive 기본 이동은 원문 끝 한 칸 전에 원문을 빠져나가며 자체 조립해 버림 → 원문 안 이동은 직접
          if (e.key === 'ArrowLeft' && !edge.start) mf.position = modelOf(mf).position - 1
          else if (e.key === 'ArrowRight' && !edge.end) mf.position = modelOf(mf).position + 1
          else flushRaw(mf)
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
      // 모아 둔 글자를 실제로 친 것처럼 재생 (키 입력과 같은 규칙)
      for (const ch of queue) if (!typeChar(mf, ch)) mf.executeCommand(['typedText', ch])
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
