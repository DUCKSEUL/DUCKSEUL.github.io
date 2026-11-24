import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import MathView from './MathView.jsx'

/* ── 수식 (인라인 / 블록) ───────────────────── */
function mathNode(name, inline) {
  return Node.create({
    name,
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: true,
    draggable: false,
    addOptions() {
      return { onEdit: null }
    },
    addAttributes() {
      return {
        latex: {
          default: '',
          parseHTML: (el) => el.getAttribute('data-latex') ?? el.textContent ?? '',
          renderHTML: (a) => ({ 'data-latex': a.latex }),
        },
      }
    },
    parseHTML() {
      return [{ tag: `${inline ? 'span' : 'div'}[data-type="${inline ? 'math-inline' : 'math-block'}"]` }]
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        inline ? 'span' : 'div',
        mergeAttributes({ 'data-type': inline ? 'math-inline' : 'math-block' }, HTMLAttributes),
        node.attrs.latex,
      ]
    },
    renderText({ node }) {
      return node.attrs.latex
    },
    addNodeView() {
      return ReactNodeViewRenderer(MathView)
    },
  })
}
export const MathInline = mathNode('mathInline', true)
export const MathBlock = mathNode('mathBlock', false)

/* ── 사진 (인라인 블록 · 크기 조절) ─────────────
 * 사진은 문단 안의 인라인 노드라서 문단 정렬(text-align)을 그대로 따르고,
 * Alt+1(½) / Alt+2(⅓)로 줄이면 한 줄에 2~3장이 나란히 놓입니다.
 * 저장 형식: <img data-type="figure" src=".." style="width: 49%"> */
const imgOf = (el) => (el.tagName === 'IMG' ? el : el.querySelector('img'))
const HANDLES = ['tl', 'tr', 'bl', 'br']

/** 예전 블록형 <figure>를 가운데 정렬 문단 안의 인라인 사진으로 변환 (에디터에 불러올 때) */
export function upgradeLegacyFigures(html = '') {
  if (!html.includes('<figure')) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  doc.body.querySelectorAll('figure[data-type="figure"]').forEach((fig) => {
    const img = fig.querySelector('img')
    if (!img) return fig.remove()
    const out = doc.createElement('img')
    out.setAttribute('src', img.getAttribute('src') || '')
    out.setAttribute('alt', img.getAttribute('alt') || fig.querySelector('figcaption')?.textContent || '')
    out.setAttribute('data-type', 'figure')
    if (fig.style.width) out.style.width = fig.style.width
    const p = doc.createElement('p')
    p.style.textAlign = 'center'
    p.appendChild(out)
    fig.replaceWith(p)
  })
  return doc.body.innerHTML
}

export const Figure = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (el) => imgOf(el)?.getAttribute('src') },
      alt: {
        default: '',
        parseHTML: (el) => imgOf(el)?.getAttribute('alt') || (el.tagName === 'FIGURE' ? el.querySelector('figcaption')?.textContent || '' : ''),
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const img = imgOf(el)
          return el.style.width || img?.style.width || (img?.getAttribute('width') ? `${img.getAttribute('width')}px` : null)
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="figure"]' }, { tag: 'img[src]' }]
  },
  renderHTML({ node }) {
    const { src, alt, width } = node.attrs
    const attrs = { 'data-type': 'figure', src, alt: alt || '' }
    if (width) attrs.style = `width: ${width}`
    return ['img', attrs]
  },
  renderText() {
    return '[사진]'
  },
  addNodeView() {
    return ({ node: initial, editor, getPos }) => {
      let node = initial
      const dom = document.createElement('span')
      dom.className = 'img-node'
      dom.setAttribute('data-drag-handle', '')
      const img = document.createElement('img')
      img.draggable = false
      dom.appendChild(img)
      let extras = []

      const apply = () => {
        if (img.getAttribute('src') !== node.attrs.src) img.setAttribute('src', node.attrs.src || '')
        img.alt = node.attrs.alt || ''
        dom.style.width = node.attrs.width || ''
      }
      apply()

      const label = (pct) => (pct != null ? `${Math.round(pct)}%` : node.attrs.width || '원본 크기')
      const startDrag = (e, dir) => {
        e.preventDefault()
        e.stopPropagation()
        const para = dom.parentElement
        const container = para.getBoundingClientRect().width
        const startW = dom.getBoundingClientRect().width
        const startX = e.clientX
        const sign = dir.endsWith('l') ? -1 : 1
        // 가운데 정렬 문단에서는 한쪽을 당기면 양쪽으로 늘어남 → 이동량 ×2
        const factor = getComputedStyle(para).textAlign === 'center' ? 2 : 1
        let pct = (startW / container) * 100
        const size = dom.querySelector('.img-size')
        const move = (ev) => {
          const next = Math.max(48, Math.min(container, startW + (ev.clientX - startX) * sign * factor))
          pct = (next / container) * 100
          dom.style.width = `${pct}%`
          if (size) size.textContent = `${label(pct)} · Alt+1 ½ · Alt+2 ⅓`
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          const pos = getPos()
          if (typeof pos !== 'number') return
          const width = `${Math.round(Math.min(100, pct) * 10) / 10}%`
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width }))
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      const showHandles = () => {
        if (!editor.isEditable || extras.length) return
        for (const d of HANDLES) {
          const h = document.createElement('span')
          h.className = `img-handle ${d}`
          h.setAttribute('aria-label', '크기 조절')
          h.addEventListener('pointerdown', (e) => startDrag(e, d))
          extras.push(h)
        }
        const size = document.createElement('span')
        size.className = 'img-size'
        size.textContent = `${label()} · Alt+1 ½ · Alt+2 ⅓`
        extras.push(size)
        extras.forEach((x) => dom.appendChild(x))
      }
      const hideHandles = () => {
        extras.forEach((x) => x.remove())
        extras = []
      }

      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false
          node = next
          apply()
          if (extras.length) {
            hideHandles()
            showHandles()
          }
          return true
        },
        selectNode() {
          dom.classList.add('is-selected')
          showHandles()
        },
        deselectNode() {
          dom.classList.remove('is-selected')
          hideHandles()
        },
        stopEvent: (e) => !!e.target?.classList?.contains('img-handle'),
        ignoreMutation: () => true,
        destroy: hideHandles,
      }
    }
  },
})

/* ── 네이버 스타일 구분선 ────────────────────── */
/** 구분선 삽입 + 바로 아래 새 문단으로 커서 이동. 새 문단은 직전 문단의 정렬·줄간격을 이어받음 */
export function insertDividerKeepAlign(editor, variant = 'line') {
  const { $from, empty } = editor.state.selection
  const block = $from.parent
  const keep = {}
  if (block.isTextblock) {
    if (block.attrs.textAlign) keep.textAlign = block.attrs.textAlign
    if (block.attrs.lineHeight) keep.lineHeight = block.attrs.lineHeight
  }
  const atEnd = empty && block.isTextblock && $from.parentOffset === block.content.size
  const isEmpty = block.isTextblock && block.content.size === 0
  const hr = { type: 'horizontalRule', attrs: { variant } }
  if (isEmpty) {
    // 빈 문단: 그 자리에 구분선, 아래에 같은 정렬의 빈 문단
    const pos = $from.before()
    return editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + block.nodeSize }, [hr, { type: 'paragraph', attrs: keep }])
      .run()
  }
  if (atEnd) {
    const pos = $from.after()
    return editor
      .chain()
      .focus()
      .insertContentAt(pos, [hr, { type: 'paragraph', attrs: keep }])
      .setTextSelection(pos + 2)
      .run()
  }
  // 문단 중간: 문단을 나누고 그 사이에 구분선 (뒷부분은 원래 문단 속성 유지)
  return editor.chain().focus().setHorizontalRule().run()
}

export const DIVIDERS = [
  { value: 'line', label: '기본 실선' },
  { value: 'bold', label: '굵은 실선' },
  { value: 'dotted', label: '점선' },
  { value: 'short', label: '짧은 중앙선' },
  { value: 'double', label: '이중선' },
  { value: 'dots', label: '3점 장식선' },
]
export const Divider = HorizontalRule.extend({
  // 코어 키맵의 Mod-Enter(exitCode)보다 먼저 처리
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      // Ctrl+Enter (macOS: Cmd+Enter): 커서 위치에 기본 구분선 + 바로 아래 새 줄로 커서 이동
      'Mod-Enter': () => {
        const ed = this.editor
        if (ed.isActive('codeBlock')) return false // 코드 블록에서는 기존 동작(블록 빠져나오기)
        return insertDividerKeepAlign(ed, 'line')
      },
    }
  },
  addAttributes() {
    return {
      variant: {
        default: 'line',
        parseHTML: (el) => el.getAttribute('data-style') || 'line',
        renderHTML: (a) => ({ 'data-style': a.variant }),
      },
    }
  },
})

/* ── 표: 셀 배경색 ───────────────────────────── */
const cellBg = {
  background: {
    default: null,
    parseHTML: (el) => el.style.backgroundColor || null,
    renderHTML: (a) => (a.background ? { style: `background-color: ${a.background}` } : {}),
  },
}
const Cell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBg }
  },
})
const Header = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBg }
  },
})

/* ── 줄간격 (문단 단위, 네이버 블로그 스타일) ─────
 * 문단/소제목 노드에 line-height 인라인 스타일을 붙입니다.
 * (글자 span이 아니라 블록에 적용해야 줄 상자 높이가 실제로 바뀜) */
export const LINE_HEIGHTS = [
  { value: '1.2', label: '1.2 (좁게)' },
  { value: '1.4', label: '1.4' },
  { value: '1.5', label: '1.5 (기본)' },
  { value: '1.8', label: '1.8' },
  { value: '2.0', label: '2.0 (넓게)' },
]
export const DEFAULT_LINE_HEIGHT = '1.5'
const LH_TYPES = ['paragraph', 'heading']

export const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [
      {
        types: LH_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    const apply =
      (value) =>
      ({ state, tr, dispatch }) => {
        const { from, to } = state.selection
        let changed = false
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!LH_TYPES.includes(node.type.name)) return
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value })
          changed = true
        })
        if (changed && dispatch) dispatch(tr)
        return changed
      }
    return {
      // 기본값(1.5)을 고르면 속성을 지워 기본 스타일을 따르게 함
      setLineHeight: (value) => apply(value === DEFAULT_LINE_HEIGHT ? null : value),
      unsetLineHeight: () => apply(null),
    }
  },
})

export const FONT_FAMILIES = [
  { label: '기본 글꼴', value: '' },
  { label: '나눔고딕', value: "'Nanum Gothic', sans-serif" },
  { label: '나눔명조', value: "'Nanum Myeongjo', serif" },
  { label: 'Consolas', value: 'Consolas, Cousine, monospace' },
  { label: 'Times New Roman', value: "'Times New Roman', Tinos, serif" },
]

export const FONT_SIZES = ['10pt', '11pt', '12pt', '13pt', '14pt', '15pt', '16pt', '18pt', '20pt', '24pt', '28pt', '30pt', '36pt']
export const DEFAULT_SIZE = '12pt'

export function buildExtensions({ onEditMath }) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      horizontalRule: false,
      code: false, // Ctrl+E를 가운데 정렬로 쓰기 위해 인라인 코드 단축키 비활성화
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    LineHeight,
    Divider,
    Figure,
    TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
    Cell,
    Header,
    Placeholder.configure({ placeholder: '오늘의 연구를 기록해 보세요. 사진은 끌어다 놓거나 Ctrl+V로 붙여넣을 수 있어요.' }),
    MathInline.configure({ onEdit: onEditMath }),
    MathBlock.configure({ onEdit: onEditMath }),
  ]
}
