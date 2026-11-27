// 한글(HWP) 방식 '모양 복사' (Alt+C / ⌥C)
// - 선택 없음(커서만): 커서 위치의 서식 8가지를 복사
//   크기 · 굵게 · 기울임 · 밑줄 · 취소선 · 글자색 · 배경색(형광펜) (글꼴은 전역 통일 — Pretendard)
// - 선택 있음: 복사해 둔 서식을 선택 범위 전체에 한 번에 적용 (복사본이 없으면 선택 시작점 서식을 복사)
//   원본에서 꺼져 있던 속성(굵게 아님 · 배경 없음 등)도 그대로 덮어써서 기존 서식을 해제 → 원본 100% 복제
// 적용은 기존 툴바와 같은 마크(<strong>/<em>/<u>/<s>, <span style="font-size; color; background-color">)라
// 뷰어·다크 모드·네이버 복사에서도 그대로 유지
import { DEFAULT_SIZE } from './extensions.js'

const pxToPt = (px) => Math.round(parseFloat(px) * 0.75) // 1pt 단위 (툴바 크기 표기와 맞춤)

/** 커서는 입력될 서식(storedMarks · 왼쪽 글자), 선택은 시작점 이후 첫 글자의 마크 */
function marksAt(state, caret) {
  if (caret) return state.storedMarks || state.selection.$from.marks()
  let found = null
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (found) return false
    if (node.isText) found = node.marks
    return !found
  })
  return found || state.selection.$from.marks()
}

/**
 * 마크 없이 CSS로 꾸며진 글자(소제목의 굵기·크기 등) 대비: 글자가 들어 있는 문단/소제목 요소
 * (인라인 마크는 ProseMirror 마크로 정확히 판별 → 경계에서 옆 글자의 DOM을 잘못 읽지 않도록 블록만 봄)
 */
function blockElement(view) {
  try {
    const { $from } = view.state.selection
    const { node } = view.domAtPos($from.start())
    return node.nodeType === 1 ? node : node.parentElement
  } catch {
    return null
  }
}

/** 상위 요소들을 에디터 루트까지 순회해 밑줄 · 취소선을 각각 독립적으로 판별 */
function decorations(el, root) {
  let underline = false
  let strike = false
  for (let cur = el; cur && cur !== root && cur.nodeType === 1; cur = cur.parentElement) {
    const line = getComputedStyle(cur).textDecorationLine || ''
    if (line.includes('underline') || /^U$/.test(cur.tagName)) underline = true
    if (line.includes('line-through') || /^(S|STRIKE|DEL)$/.test(cur.tagName)) strike = true
  }
  return { underline, strike }
}

export function readFormat(editor, { caret = true } = {}) {
  const { state, view } = editor
  const marks = marksAt(state, caret)
  const has = (name) => marks.some((m) => m.type.name === name)
  const ts = marks.find((m) => m.type.name === 'textStyle')?.attrs || {}

  const el = blockElement(view)
  const cs = el ? getComputedStyle(el) : null
  const deco = el ? decorations(el, view.dom) : { underline: false, strike: false }

  let fontSize = ts.fontSize || null
  if (!fontSize && cs) {
    const pt = pxToPt(cs.fontSize)
    if (pt && pt !== parseFloat(DEFAULT_SIZE)) fontSize = `${pt}pt` // 기본 크기와 다를 때만 명시
  }
  return {
    fontSize,
    bold: has('bold') || (cs ? parseInt(cs.fontWeight, 10) >= 600 : false),
    italic: has('italic') || cs?.fontStyle === 'italic',
    underline: has('underline') || deco.underline,
    strike: has('strike') || deco.strike,
    color: ts.color || null,
    // 배경색은 실제로 지정한 형광펜만 (본문 기본 배경은 복사하지 않음) — 없으면 null(투명)
    backgroundColor: ts.backgroundColor || null,
  }
}

const STYLE_LABELS = [
  ['bold', '굵게'],
  ['italic', '기울임'],
  ['underline', '밑줄'],
  ['strike', '취소선'],
  ['color', '글자색'],
  ['backgroundColor', '배경색'],
]

/** 토스트 문구: "크기 · 스타일" (글꼴은 전역 통일이라 표시하지 않음) */
export function describeFormat(f) {
  const styles = STYLE_LABELS.filter(([k]) => f[k]).map(([, label]) => label)
  return `${f.fontSize || DEFAULT_SIZE} · ${styles.length ? styles.join('+') : '기본 스타일'}`
}

/**
 * 선택 범위 전체에 적용 — 한 체인(한 트랜잭션)이라 Ctrl+Z 한 번에 되돌려지고, 선택 상태는 그대로 유지
 * 켜진 속성은 걸고, 꺼진 속성은 해제
 */
export function applyFormat(editor, f) {
  const toggle = (chain, on, set, unset) => (on ? chain[set]() : chain[unset]())
  let chain = editor.chain().focus()
  chain = chain.setMark('textStyle', {
    fontSize: f.fontSize,
    color: f.color,
    backgroundColor: f.backgroundColor,
  })
  chain = toggle(chain, f.bold, 'setBold', 'unsetBold')
  chain = toggle(chain, f.italic, 'setItalic', 'unsetItalic')
  chain = toggle(chain, f.underline, 'setUnderline', 'unsetUnderline')
  chain = toggle(chain, f.strike, 'setStrike', 'unsetStrike')
  return chain.removeEmptyTextStyle().run()
}
