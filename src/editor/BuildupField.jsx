// Word / PowerPoint 수식 입력기식 'Space 빌드업' 입력 칸
// - 입력 칸 = [렌더링된 토큰 칩들][지금 입력 중인 LaTeX 텍스트]
// - Space: 마지막 칩 뒤에 입력한 텍스트가 완결된 수식이면(중괄호 짝 · 끝이 \ ^ _ 아님 · KaTeX 해석 가능) 바로 KaTeX 칩으로
//   → 입력 모드는 그대로, 커서는 칩 오른쪽. 완결되지 않았으면 '\pm' 같은 기호 자동 고침, 그것도 아니면 보통 공백
// - Backspace / ← (텍스트 맨 앞에서): 직전 칩을 원본 LaTeX로 되돌려 다시 편집 / 칩 클릭: 그 칩부터 원본으로
// - 최종 LaTeX = 칩들 + 남은 텍스트 (fieldLatex)
import { useLayoutEffect, useRef } from 'react'
import katex from 'katex'
import { autoCorrectSpace, isValidLatex, toLatex } from './mathTools.js'

const chipCache = new Map()
function chipHtml(tex) {
  if (!chipCache.has(tex)) chipCache.set(tex, katex.renderToString(tex, { throwOnError: false, strict: 'ignore' }))
  return chipCache.get(tex)
}

function balanced(s) {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      i++ // \{ \} 같은 이스케이프 건너뜀
      continue
    }
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth < 0) return false
  }
  return depth === 0
}

/** Space로 빌드업할 수 있는 완결된 수식인지 */
export function canBuild(text) {
  const t = text.trim()
  if (!t || !balanced(t) || /[\\^_&]$/.test(t)) return false
  return isValidLatex(toLatex(t))
}

/** 칸 내용 → 표준 LaTeX (칩 사이는 공백으로 이어 '\alpha' + 'x'가 '\alphax'가 되지 않게) */
export function fieldLatex({ tokens = [], text = '' }) {
  return toLatex([...tokens, text].map((s) => s.trim()).filter(Boolean).join(' '))
}

/** 저장된 LaTeX를 칸 상태로: 해석 가능한 수식이면 칩 하나로(보이는 그대로), 아니면 텍스트 */
export function fieldFrom(latex = '', asChip = true) {
  const t = latex.trim()
  if (asChip && t && canBuild(t)) return { tokens: [t], text: '' }
  return { tokens: [], text: t }
}

export default function BuildupField({ field, onChange, inputRef, onKeyDown, className = '', inputClassName = '', placeholder, minCh = 2, ...rest }) {
  const ownRef = useRef(null)
  const ref = inputRef || ownRef
  const pendingCaret = useRef(null)
  const { tokens, text } = field

  useLayoutEffect(() => {
    const at = pendingCaret.current
    const el = ref.current
    if (at == null || !el) return
    pendingCaret.current = null
    el.focus({ preventScroll: true })
    el.setSelectionRange(at, at)
  })

  /** i번째 칩부터 끝까지를 원본 LaTeX 텍스트로 되돌림 (커서는 i번째 칩 원본의 끝) */
  const unbuildFrom = (i) => {
    const back = tokens.slice(i)
    const merged = [...back, text].filter(Boolean).join(' ')
    pendingCaret.current = back[0].length
    onChange({ tokens: tokens.slice(0, i), text: merged })
  }

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    if (e.key === ' ' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (atEnd && canBuild(text)) {
        e.preventDefault()
        pendingCaret.current = 0
        onChange({ tokens: [...tokens, text.trim()], text: '' })
        return
      }
      const r = autoCorrectSpace(el)
      if (r) {
        e.preventDefault()
        pendingCaret.current = r.caret
        onChange({ tokens, text: r.value })
        return
      }
    } else if ((e.key === 'Backspace' || (e.key === 'ArrowLeft' && !e.shiftKey)) && atStart && tokens.length) {
      e.preventDefault()
      unbuildFrom(tokens.length - 1)
      return
    }
    onKeyDown?.(e)
  }

  return (
    <span className={`bu-field ${className}`}>
      {tokens.map((t, i) => (
        <span
          key={`${i}:${t}`}
          className="bu-chip"
          title={`${t}\n클릭하거나 Backspace로 원본 수정`}
          onMouseDown={(e) => {
            e.preventDefault() // 입력 칸 포커스 유지
            unbuildFrom(i)
          }}
          dangerouslySetInnerHTML={{ __html: chipHtml(t) }}
        />
      ))}
      <input
        ref={ref}
        className={inputClassName}
        value={text}
        placeholder={tokens.length ? '' : placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{ width: `${text ? Math.max(2, [...text].length + 1) : tokens.length ? 1 : minCh}ch` }}
        onChange={(e) => onChange({ tokens, text: e.target.value })}
        onKeyDown={handleKeyDown}
        {...rest}
      />
    </span>
  )
}
