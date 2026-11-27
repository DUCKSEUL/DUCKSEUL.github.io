// 수식 템플릿 공용 도구 (편집 화면 전용 — 저장 HTML·뷰어·네이버 복사와 무관)
// - 예전 입력 상자 아래 플로팅 팔레트는 PowerPoint식 상단 [수식] 리본(MathRibbon.jsx)으로 옮겨짐
// - 템플릿 문법: '§' = 삽입 후 커서 자리, '§a¦' = 'a'를 선택 상태로(바로 덮어쓰기), '◊' = 입력 상자에서 선택한 글자를 감쌀 자리
import katex from 'katex'

// 미리보기 아이콘은 한 번만 렌더링해 재사용
const iconCache = new Map()
export function mathIcon(tex) {
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
