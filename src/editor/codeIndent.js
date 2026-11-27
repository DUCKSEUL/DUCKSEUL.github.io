// 코드 블록 편집 편의 (VS Code 감각)
// - Tab: 현재 줄(여러 줄을 선택했으면 선택한 모든 줄) 맨 앞에 공백 4칸 — 포커스가 다른 UI로 빠져나가지 않음, 커서 위치 유지
// - Shift+Tab: 줄 맨 앞의 공백 최대 4칸(또는 탭 1개) 제거
// - Enter: 이전 줄의 들여쓰기를 이어받고, ':'로 끝나는 줄(def …:, class …:, if …:)이면 4칸 더
//   빈 줄(공백만 있는 줄)이 두 번 이어진 끝에서 Enter → 블록 밖으로 (기존 '엔터 세 번' 동작 유지)
import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

const INDENT = '    '

/** 코드 블록 안의 선택이면 { start(블록 내용 시작 위치), text, from, to(블록 내부 오프셋) } */
function codeContext(state) {
  const { $from, $to } = state.selection
  if ($from.parent.type.name !== 'codeBlock' || !$from.sameParent($to)) return null
  const start = $from.start()
  return { start, text: $from.parent.textContent, from: $from.pos - start, to: $to.pos - start }
}

/** [from, to] 범위가 걸친 줄들의 시작 오프셋 (뒤에서부터 처리하도록 내림차순) */
function lineStarts(text, from, to) {
  const starts = [text.lastIndexOf('\n', from - 1) + 1]
  for (let i = text.indexOf('\n', from); i !== -1 && i < to; i = text.indexOf('\n', i + 1)) starts.push(i + 1)
  return starts.sort((a, b) => b - a)
}

export const CodeIndent = Extension.create({
  name: 'codeIndent',
  priority: 1100, // 코드 블록 기본 키맵(Enter) · 다른 Tab 처리보다 먼저
  addKeyboardShortcuts() {
    const indent = (dir) => () => {
      const { state, view } = this.editor
      const c = codeContext(state)
      if (!c) return false
      let tr = state.tr
      for (const ls of lineStarts(c.text, c.from, c.to)) {
        const at = c.start + ls
        if (dir > 0) tr = tr.insertText(INDENT, at)
        else {
          const lead = /^( {1,4}|\t)/.exec(c.text.slice(ls))
          if (lead) tr = tr.delete(at, at + lead[0].length)
        }
      }
      if (tr.docChanged) view.dispatch(tr.scrollIntoView())
      return true // 들여쓸 것이 없어도 Tab이 포커스를 옮기지 않게
    }
    return {
      Tab: indent(1),
      'Shift-Tab': indent(-1),
      Enter: () => {
        const { state, view } = this.editor
        const c = codeContext(state)
        if (!c || c.from !== c.to) return false
        const ls = c.text.lastIndexOf('\n', c.from - 1) + 1
        const line = c.text.slice(ls, c.from)
        // 블록 끝에서 공백뿐인 줄이 두 번 이어지면 → 그 빈 줄들을 지우고 블록 밖 새 문단으로
        if (c.from === c.text.length && !line.trim()) {
          const prevStart = c.text.lastIndexOf('\n', ls - 2) + 1
          if (ls > 0 && !c.text.slice(prevStart, ls - 1).trim()) {
            return this.editor
              .chain()
              .command(({ tr }) => {
                tr.delete(c.start + Math.max(0, prevStart - 1), c.start + c.text.length)
                return true
              })
              .exitCode()
              .run()
          }
        }
        let ind = /^[ \t]*/.exec(line)[0]
        if (/:\s*$/.test(line)) ind += INDENT // def … : / class … : / if … : → 한 단계 더
        const tr = state.tr.insertText(`\n${ind}`, state.selection.from)
        tr.setSelection(TextSelection.create(tr.doc, state.selection.from + 1 + ind.length))
        view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },
})
