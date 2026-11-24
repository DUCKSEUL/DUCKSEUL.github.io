import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'

const HANDLES = ['tl', 'tr', 'bl', 'br']

export default function ImageView({ node, updateAttributes, selected, editor }) {
  const { src, alt, width, caption, border } = node.attrs
  const wrapRef = useRef(null)
  const boxRef = useRef(null)
  const [dragPct, setDragPct] = useState(null)
  const editable = editor.isEditable

  const startDrag = (e, dir) => {
    e.preventDefault()
    e.stopPropagation()
    const container = wrapRef.current.getBoundingClientRect().width
    const startW = boxRef.current.getBoundingClientRect().width
    const startX = e.clientX
    const sign = dir.endsWith('l') ? -1 : 1
    let pct = (startW / container) * 100

    const move = (ev) => {
      // 가운데 정렬이므로 한쪽을 당기면 양쪽으로 늘어남 → 이동량 ×2 (높이는 비율 유지)
      const next = Math.max(48, Math.min(container, startW + (ev.clientX - startX) * sign * 2))
      pct = (next / container) * 100
      setDragPct(pct)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      updateAttributes({ width: `${Math.round(pct * 10) / 10}%` })
      setDragPct(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const w = dragPct != null ? `${dragPct}%` : width || undefined
  const label = dragPct != null ? `${Math.round(dragPct)}%` : width || '원본 크기'
  const showCaption = selected && editable

  return (
    <NodeViewWrapper className="img-node" data-drag-handle="">
      <div ref={wrapRef} className="img-inner">
        <div className="img-fig" style={{ width: w }}>
          <span ref={boxRef} className={`img-box ${selected ? 'is-selected' : ''} ${border ? 'has-border' : ''}`}>
            <img src={src} alt={alt || caption || ''} draggable={false} />
            {selected && editable && (
              <>
                {HANDLES.map((d) => (
                  <span key={d} className={`img-handle ${d}`} onPointerDown={(e) => startDrag(e, d)} aria-label="크기 조절" />
                ))}
                <span className="img-size">{label} · Alt+1 ½ · Alt+2 ⅓</span>
              </>
            )}
          </span>
          {showCaption ? (
            <div className="img-cap-wrap">
              <input
                className="img-cap-input"
                value={caption}
                onChange={(e) => updateAttributes({ caption: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault()
                    editor.commands.focus()
                  }
                }}
                placeholder="사진 설명을 입력하세요"
                aria-label="사진 캡션"
              />
              <div className="img-opts">
                <button
                  type="button"
                  className={border ? 'is-on' : ''}
                  aria-pressed={border}
                  onClick={() => updateAttributes({ border: !border })}
                >
                  <span className="opt-box" aria-hidden /> 얇은 테두리 {border ? '켜짐' : '꺼짐'}
                </button>
              </div>
            </div>
          ) : (
            caption && <p className="img-cap">{caption}</p>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}
