import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/ui.jsx'
import { DEFAULT_LINE_HEIGHT, DEFAULT_SIZE, DIVIDERS, FONT_FAMILIES, FONT_SIZES, LINE_HEIGHTS } from './extensions.js'

const COLORS = [
  '#000000', '#333d4b', '#6b7684', '#b0b8c1', '#ffffff',
  '#f04452', '#fe9800', '#ffc342', '#03b26c', '#00c7be',
  '#3182f6', '#1b64da', '#8b5cf6', '#c770e4', '#a0522d',
]
const BG_COLORS = [
  '#fff3bf', '#ffe3e3', '#ffe8cc', '#d3f9d8', '#c5f6fa',
  '#d0ebff', '#e5dbff', '#f3d9fa', '#e9ecef', '#191f28',
]

const keep = (e) => e.preventDefault()

function Btn({ icon, label, active, onClick, disabled, shortcut, children, className = '' }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'is-active' : ''} ${className}`}
      onMouseDown={keep}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active || undefined}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return { open, setOpen, ref }
}

function ColorPicker({ icon, label, colors, current, onPick, onReset, resetLabel }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div className="tb-pop" ref={ref}>
      <button
        type="button"
        className="tb-btn tb-color"
        onMouseDown={keep}
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
                onMouseDown={keep}
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
            onMouseDown={keep}
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

function DividerMenu({ onPick }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div className="tb-pop" ref={ref}>
      <button
        type="button"
        className="tb-btn tb-divider"
        onMouseDown={keep}
        onClick={() => setOpen((v) => !v)}
        title="구분선"
        aria-label="구분선"
        aria-expanded={open}
      >
        <Icon name="hr" size={18} />
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="tb-menu dv-menu" role="menu" aria-label="구분선 스타일">
          {DIVIDERS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="menuitem"
              className="dv-item"
              data-variant={d.value}
              onMouseDown={keep}
              onClick={() => {
                onPick(d.value)
                setOpen(false)
              }}
            >
              <span className="dv-prev">
                <hr data-style={d.value} />
              </span>
              <span className="dv-label">{d.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LineHeightMenu({ current, onPick }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div className="tb-pop" ref={ref}>
      <button
        type="button"
        className="tb-btn tb-lh"
        onMouseDown={keep}
        onClick={() => setOpen((v) => !v)}
        title={`줄간격 (${current})`}
        aria-label={`줄간격, 현재 ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4v16M2.5 6.5 5 4l2.5 2.5M2.5 17.5 5 20l2.5-2.5M11 6h10M11 12h10M11 18h10" />
        </svg>
        <span className="tb-lh-val">{current}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="tb-menu lh-menu" role="menu" aria-label="줄간격">
          {LINE_HEIGHTS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={current === o.value}
              className={`lh-item ${current === o.value ? 'is-active' : ''}`}
              onMouseDown={keep}
              onClick={() => {
                onPick(o.value)
                setOpen(false)
              }}
            >
              <span className="lh-check">{current === o.value && <Icon name="check" size={14} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function stepFontSize(editor, dir) {
  const cur = editor.getAttributes('textStyle').fontSize || DEFAULT_SIZE
  const n = parseFloat(cur)
  let next
  if (dir > 0) next = FONT_SIZES.find((s) => parseFloat(s) > n) || FONT_SIZES[FONT_SIZES.length - 1]
  else next = [...FONT_SIZES].reverse().find((s) => parseFloat(s) < n) || FONT_SIZES[0]
  editor.chain().focus().setFontSize(next).run()
}

export function insertDivider(editor, variant) {
  editor
    .chain()
    .focus()
    .insertContent([{ type: 'horizontalRule', attrs: { variant } }, { type: 'paragraph' }])
    .run()
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
  const size = ts.fontSize || ''
  const rawLh = editor.getAttributes(block === 'p' ? 'paragraph' : 'heading').lineHeight
  const lineHeight = rawLh ? (LINE_HEIGHTS.find((o) => parseFloat(o.value) === parseFloat(rawLh))?.value ?? String(rawLh)) : DEFAULT_LINE_HEIGHT

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
        <div className="tb-size">
          <select
            className="tb-select size"
            aria-label="글씨 크기"
            value={FONT_SIZES.includes(size) ? size : ''}
            onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
          >
            <option value="">{size && !FONT_SIZES.includes(size) ? size : DEFAULT_SIZE}</option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Btn label="글씨 크기 줄이기" className="tb-step" onClick={() => stepFontSize(editor, -1)} disabled={parseFloat(size || DEFAULT_SIZE) <= 10}>
            <span aria-hidden>가</span>
            <small aria-hidden>−</small>
          </Btn>
          <Btn label="글씨 크기 키우기" className="tb-step" onClick={() => stepFontSize(editor, 1)} disabled={parseFloat(size || DEFAULT_SIZE) >= 36}>
            <span aria-hidden className="big">가</span>
            <small aria-hidden>+</small>
          </Btn>
        </div>
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
        <Btn icon="alignLeft" label="왼쪽 정렬" shortcut="Ctrl+L" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()} />
        <Btn icon="alignCenter" label="가운데 정렬" shortcut="Ctrl+E" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()} />
        <Btn icon="alignRight" label="오른쪽 정렬" shortcut="Ctrl+R" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()} />
        <LineHeightMenu current={lineHeight} onPick={(v) => c().setLineHeight(v).run()} />
      </div>

      <div className="tb-group">
        <Btn icon="listBullet" label="글머리 기호 목록" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
        <Btn icon="listOrdered" label="번호 목록" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
        <Btn icon="quote" label="인용구" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
        <DividerMenu onPick={(v) => insertDivider(editor, v)} />
      </div>

      <div className="tb-group">
        <Btn icon="link" label="링크" shortcut="Ctrl+K" active={editor.isActive('link')} onClick={onLink} />
        <Btn icon="image" label="사진 넣기" onClick={onImage} />
        <Btn icon="table" label="표 넣기" active={editor.isActive('table')} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Btn icon="codeBlock" label="코드 블록" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()} />
        <Btn label="수식 입력" shortcut="Alt+3" className="tb-math" onClick={onMath}>
          <Icon name="sigma" size={18} />
          <span>수식</span>
        </Btn>
      </div>
    </div>
  )
}
