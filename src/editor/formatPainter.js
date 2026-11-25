// 한글(HWP) 방식 '모양 복사' (Alt+C / ⌥C)
// - 선택 없음(커서만): 커서 위치의 글꼴·글씨 크기·글자색을 복사
// - 선택 있음: 복사해 둔 서식을 선택 범위 전체에 한 번에 적용 (복사본이 없으면 선택 시작점 서식을 복사)
// 적용은 기존 툴바와 같은 textStyle 마크(<span style="font-family; font-size; color">)로 → 뷰어·네이버 복사에서도 그대로 유지
import { DEFAULT_SIZE, FONT_FAMILIES } from './extensions.js'

const pxToPt = (px) => Math.round(parseFloat(px) * 0.75) // 1pt 단위 (툴바 크기 표기와 맞춤)

/** pos 위치 글자의 textStyle 속성 (선택 시작점은 오른쪽 글자, 커서는 입력될 서식 기준) */
function textStyleAt(state, pos, caret) {
  const type = state.schema.marks.textStyle
  let marks
  if (caret) marks = state.storedMarks || state.selection.$from.marks()
  else {
    // 선택 시작점부터 첫 번째 텍스트 노드의 서식
    let found = null
    state.doc.nodesBetween(pos, state.selection.to, (node) => {
      if (found) return false
      if (node.isText) found = node.marks
      return !found
    })
    marks = found || state.doc.resolve(pos).marks()
  }
  return marks.find((m) => m.type === type)?.attrs || {}
}

/** 커서 위치 DOM의 실제 계산된 글씨 크기(pt) — 소제목처럼 마크 없이 CSS로 커진 글자 대비 */
function computedSizeAt(view, pos) {
  try {
    const { node } = view.domAtPos(pos)
    const el = node.nodeType === 1 ? node : node.parentElement
    return el ? pxToPt(getComputedStyle(el).fontSize) : null
  } catch {
    return null
  }
}

export function readFormat(editor, { caret = true } = {}) {
  const { state, view } = editor
  const pos = state.selection.from
  const ts = textStyleAt(state, pos, caret)
  let fontSize = ts.fontSize || null
  if (!fontSize) {
    const pt = computedSizeAt(view, pos)
    if (pt && pt !== parseFloat(DEFAULT_SIZE)) fontSize = `${pt}pt` // 기본 크기와 다를 때만 명시
  }
  return { fontFamily: ts.fontFamily || null, fontSize, color: ts.color || null }
}

export function describeFormat(f) {
  const font = FONT_FAMILIES.find((o) => o.value && o.value === f.fontFamily)?.label || (f.fontFamily ? f.fontFamily.split(',')[0].replace(/['"]/g, '') : '기본 글꼴')
  return `${font} · ${f.fontSize || DEFAULT_SIZE}`
}

/** 선택 범위 전체에 적용 — 한 트랜잭션이라 Ctrl+Z 한 번에 되돌려지고, 선택 상태는 그대로 유지 */
export function applyFormat(editor, f) {
  return editor
    .chain()
    .focus()
    .setMark('textStyle', { fontFamily: f.fontFamily, fontSize: f.fontSize, color: f.color })
    .removeEmptyTextStyle()
    .run()
}
