import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import MathView from './MathView.jsx'
import ImageView from './ImageView.jsx'

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

/* ── 사진 (크기 · 캡션 · 테두리) ─────────────── */
const imgOf = (el) => (el.tagName === 'IMG' ? el : el.querySelector('img'))

export const Figure = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (el) => imgOf(el)?.getAttribute('src') },
      alt: { default: '', parseHTML: (el) => imgOf(el)?.getAttribute('alt') || '' },
      width: {
        default: null,
        parseHTML: (el) => {
          const img = imgOf(el)
          return el.style.width || img?.style.width || (img?.getAttribute('width') ? `${img.getAttribute('width')}px` : null)
        },
      },
      caption: { default: '', parseHTML: (el) => (el.tagName === 'FIGURE' ? el.querySelector('figcaption')?.textContent || '' : '') },
      border: { default: false, parseHTML: (el) => el.getAttribute('data-border') === 'true' },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="figure"]' }, { tag: 'img[src]' }]
  },
  renderHTML({ node }) {
    const { src, alt, width, caption, border } = node.attrs
    const attrs = { 'data-type': 'figure' }
    if (border) attrs['data-border'] = 'true'
    if (width) attrs.style = `width: ${width}`
    const out = ['figure', attrs, ['img', { src, alt: alt || caption || '' }]]
    if (caption) out.push(['figcaption', {}, caption])
    return out
  },
  renderText({ node }) {
    return node.attrs.caption ? `[사진: ${node.attrs.caption}]` : '[사진]'
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView, {
      // 캡션 입력란 / 옵션 버튼의 이벤트는 에디터가 가로채지 않도록
      stopEvent: ({ event }) => !!event.target?.closest?.('.img-cap-input, .img-opts'),
    })
  },
})

/* ── 네이버 스타일 구분선 ────────────────────── */
export const DIVIDERS = [
  { value: 'line', label: '기본 실선' },
  { value: 'bold', label: '굵은 실선' },
  { value: 'dotted', label: '점선' },
  { value: 'short', label: '짧은 중앙선' },
  { value: 'double', label: '이중선' },
  { value: 'dots', label: '3점 장식선' },
]
export const Divider = HorizontalRule.extend({
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
