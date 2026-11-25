// 본문의 구분선을 더블 클릭하면 뜨는 스타일 선택 팝오버
// - 항목 클릭 → 그 구분선만 즉시 교체(한 번의 트랜잭션이라 Ctrl+Z 한 번에 되돌림), 팝오버 닫힘
// - 바깥 클릭 · Esc → 변경 없이 닫힘 / 오른쪽 휴지통 → 구분선 삭제
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TextSelection } from '@tiptap/pm/state'
import { Icon } from '../components/ui.jsx'
import { DIVIDERS } from './extensions.js'

const EDGE = 12
const GAP = 10

export default function DividerPopover({ editor }) {
  const [pos, setPos] = useState(null) // 구분선 문서 위치
  const [place, setPlace] = useState(null)
  const ref = useRef(null)

  // 확장(Divider)의 더블 클릭 → 이 팝오버 열기
  useEffect(() => {
    if (!editor) return
    const on = (p) => setPos(p)
    editor.on('dividerDblClick', on)
    return () => {
      editor.off('dividerDblClick', on)
    }
  }, [editor])

  const node = pos != null ? editor?.state.doc.nodeAt(pos) : null
  const open = node?.type.name === 'horizontalRule'
  const current = node?.attrs.variant || 'line'

  // 구분선 바로 아래(공간이 없으면 위)에 배치, 화면 좌우 밖으로 나가지 않게 보정
  const measure = () => {
    if (!open || !ref.current) return
    const hr = editor.view.nodeDOM(pos)
    if (!hr?.getBoundingClientRect) return
    const r = hr.getBoundingClientRect()
    const { width, height } = ref.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(cx - width / 2, EDGE), Math.max(EDGE, vw - EDGE - width))
    const below = r.bottom + GAP + height <= window.innerHeight - EDGE || r.top - GAP - height < 80
    const top = below ? r.bottom + GAP : r.top - GAP - height
    setPlace((p) => (p && p.left === left && p.top === top && p.below === below ? p : { left, top, below }))
  }
  useLayoutEffect(() => {
    if (!open) setPlace(null)
    else measure()
  }, [open, pos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const onDown = (e) => !ref.current?.contains(e.target) && close()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        editor.commands.focus()
      }
    }
    const onMove = () => measure()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    // 문서가 바뀌어 구분선이 사라지면(실행 취소 등) 닫기
    const onTr = () => editor.state.doc.nodeAt(pos)?.type.name !== 'horizontalRule' && close()
    editor.on('transaction', onTr)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      editor.off('transaction', onTr)
    }
  }, [open, pos]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const pick = (variant) => {
    if (variant !== current) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, variant }))
    }
    setPos(null)
    editor.commands.focus()
  }
  const remove = () => {
    const { state, view } = editor
    let tr = state.tr.delete(pos, pos + node.nodeSize)
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
    view.dispatch(tr.scrollIntoView())
    setPos(null)
    view.focus()
  }

  return createPortal(
    <div
      ref={ref}
      className={`hr-pop ${place?.below === false ? 'is-above' : ''}`}
      role="dialog"
      aria-label="구분선 스타일 변경"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="hr-pop-list" role="menu">
        {DIVIDERS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="menuitemradio"
            aria-checked={d.value === current}
            className={`hr-pop-item ${d.value === current ? 'is-current' : ''}`}
            onClick={() => pick(d.value)}
            title={d.label}
          >
            <span className="dv-prev">
              <hr data-style={d.value} />
            </span>
            <span className="hr-pop-label">{d.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="hr-pop-del" onClick={remove} title="구분선 삭제" aria-label="구분선 삭제">
        <Icon name="trash" size={16} />
      </button>
    </div>,
    document.body,
  )
}
