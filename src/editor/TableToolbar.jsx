// 표 셀을 클릭하면 표 위에 뜨는 미니 툴바
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/ui.jsx'

const CELL_COLORS = ['#f2f4f6', '#e8f3ff', '#e5f8ef', '#fff3bf', '#ffe3e3', '#f2ebff', '#d1d6db', '#191f28']

export default function TableToolbar({ editor }) {
  const [palette, setPalette] = useState(false)
  if (!editor || !editor.isEditable || !editor.isActive('table')) return null

  let table = null
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from)
    table = (node.nodeType === 3 ? node.parentElement : node)?.closest('table')
  } catch {
    return null
  }
  if (!table) return null
  const r = table.getBoundingClientRect()
  const style = { left: r.left + window.scrollX, top: r.top + window.scrollY - 56 }
  const c = () => editor.chain().focus()
  const keep = (e) => e.preventDefault()

  return createPortal(
    <div className="table-bar" style={style} onMouseDown={keep} role="toolbar" aria-label="표 편집">
      <button onClick={() => c().addRowBefore().run()} title="위에 행 추가">
        <Icon name="plus" size={14} /> 위 행
      </button>
      <button onClick={() => c().addRowAfter().run()} title="아래에 행 추가">
        <Icon name="plus" size={14} /> 아래 행
      </button>
      <button onClick={() => c().deleteRow().run()} title="행 삭제" className="minus">
        − 행
      </button>
      <span className="sep" />
      <button onClick={() => c().addColumnBefore().run()} title="왼쪽에 열 추가">
        <Icon name="plus" size={14} /> 왼쪽 열
      </button>
      <button onClick={() => c().addColumnAfter().run()} title="오른쪽에 열 추가">
        <Icon name="plus" size={14} /> 오른쪽 열
      </button>
      <button onClick={() => c().deleteColumn().run()} title="열 삭제" className="minus">
        − 열
      </button>
      <span className="sep" />
      <div className="table-bar-pop">
        <button onClick={() => setPalette((v) => !v)} aria-expanded={palette} title="셀 배경색">
          <span className="cell-swatch" style={{ background: editor.getAttributes('tableCell').background || editor.getAttributes('tableHeader').background || 'transparent' }} />
          셀 배경
        </button>
        {palette && (
          <div className="table-bar-palette">
            {CELL_COLORS.map((col) => (
              <button
                key={col}
                style={{ background: col }}
                aria-label={`셀 배경 ${col}`}
                onClick={() => {
                  c().setCellAttribute('background', col).run()
                  setPalette(false)
                }}
              />
            ))}
            <button
              className="none"
              aria-label="셀 배경 없음"
              onClick={() => {
                c().setCellAttribute('background', null).run()
                setPalette(false)
              }}
            >
              없음
            </button>
          </div>
        )}
      </div>
      <button onClick={() => c().deleteTable().run()} title="표 삭제" className="danger">
        <Icon name="trash" size={14} />
      </button>
    </div>,
    document.body,
  )
}
