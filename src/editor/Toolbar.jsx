import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/ui.jsx'
import { FONT_FAMILIES, FONT_SIZES } from './extensions.js'

const COLORS = [
  '#000000', '#333d4b', '#6b7684', '#b0b8c1', '#ffffff',
  '#f04452', '#fe9800', '#ffc342', '#03b26c', '#00c7be',
  '#3182f6', '#1b64da', '#8b5cf6', '#c770e4', '#a0522d',
]
const BG_COLORS = [
  '#fff3bf', '#ffe3e3', '#ffe8cc', '#d3f9d8', '#c5f6fa',
  '#d0ebff', '#e5dbff', '#f3d9fa', '#e9ecef', '#191f28',
]

function Btn({ icon, label, active, onClick, disabled, shortcut }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active || undefined}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}

function ColorPicker({ icon, label, colors, current, onPick, onReset, resetLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return (
    <div className="tb-pop" ref={ref}>
      <button
        type="button"
        className="tb-btn tb-color"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        <Icon name={icon} size={18} />
        <span className="tb-swatch" style={{ background: current || 'transparent' }} />
      </button>
      {open && (
        <div className="tb-palette" role="menu">
          <div className="tb-palette-grid">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(c)
                  setOpen(false)
                }}
                aria-label={c}
                title={c}
              />
            ))}
          </div>
          <button
            type="button"
            className="tb-palette-reset"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onReset()
              setOpen(false)
            }}
          >
            {resetLabel}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Toolbar({ editor, onMath, onLink, onImage }) {
  if (!editor) return null
  const c = () => editor.chain().focus()
  const ts = editor.getAttributes('textStyle')
  const block = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : editor.isActive('heading', { level: 4 })
        ? 'h4'
        : 'p'
  const inTable = editor.isActive('table')

  return (
    <div className="toolbar" role="toolbar" aria-label="서식 도구">
      <div className="tb-group">
        <Btn icon="undo" label="실행 취소" shortcut="Ctrl+Z" onClick={() => c().undo().run()} disabled={!editor.can().undo()} />
        <Btn icon="redo" label="다시 실행" shortcut="Ctrl+Y" onClick={() => c().redo().run()} disabled={!editor.can().redo()} />
      </div>

      <div className="tb-group">
        <select
          className="tb-select"
          aria-label="문단 스타일"
          value={block}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'p') c().setParagraph().run()
            else c().setHeading({ level: Number(v[1]) }).run()
          }}
        >
          <option value="p">본문</option>
          <option value="h2">소제목 1</option>
          <option value="h3">소제목 2</option>
          <option value="h4">소제목 3</option>
        </select>
        <select
          className="tb-select wide"
          aria-label="글씨 모양"
          value={FONT_FAMILIES.find((f) => f.value && f.value === ts.fontFamily)?.value || ''}
          onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="tb-select"
          aria-label="글씨 크기"
          value={FONT_SIZES.includes(ts.fontSize) ? ts.fontSize : ''}
          onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
        >
          <option value="">크기</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="tb-group">
        <Btn icon="bold" label="굵게" shortcut="Ctrl+B" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
        <Btn icon="italic" label="기울임" shortcut="Ctrl+I" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
        <Btn icon="underline" label="밑줄" shortcut="Ctrl+U" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()} />
        <Btn icon="strike" label="취소선" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()} />
        <ColorPicker
          icon="textColor"
          label="글자색"
          colors={COLORS}
          current={ts.color}
          onPick={(v) => c().setColor(v).run()}
          onReset={() => c().unsetColor().run()}
          resetLabel="기본 글자색"
        />
        <ColorPicker
          icon="highlight"
          label="배경색"
          colors={BG_COLORS}
          current={ts.backgroundColor}
          onPick={(v) => c().setBackgroundColor(v).run()}
          onReset={() => c().unsetBackgroundColor().run()}
          resetLabel="배경색 없음"
        />
      </div>

      <div className="tb-group">
        <Btn icon="alignLeft" label="왼쪽 정렬" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()} />
        <Btn icon="alignCenter" label="가운데 정렬" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()} />
        <Btn icon="alignRight" label="오른쪽 정렬" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()} />
      </div>

      <div className="tb-group">
        <Btn icon="listBullet" label="글머리 기호 목록" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
        <Btn icon="listOrdered" label="번호 목록" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
        <Btn icon="quote" label="인용구" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
        <Btn icon="hr" label="구분선" onClick={() => c().setHorizontalRule().run()} />
      </div>

      <div className="tb-group">
        <Btn icon="link" label="링크" shortcut="Ctrl+K" active={editor.isActive('link')} onClick={onLink} />
        <Btn icon="image" label="사진 넣기" onClick={onImage} />
        <Btn
          icon="table"
          label="표 넣기"
          active={inTable}
          onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        <Btn icon="codeBlock" label="코드 블록" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()} />
        <button
          type="button"
          className="tb-btn tb-math"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onMath}
          title="수식 입력 (Alt+3)"
          aria-label="수식 입력"
        >
          <Icon name="sigma" size={18} />
          <span>수식</span>
        </button>
      </div>

      {inTable && (
        <div className="tb-group tb-table">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().addRowAfter().run()}>
            + 행
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().addColumnAfter().run()}>
            + 열
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteRow().run()}>
            − 행
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteColumn().run()}>
            − 열
          </button>
          <button type="button" className="danger" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()}>
            표 삭제
          </button>
        </div>
      )}
    </div>
  )
}
