import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import MathView from './MathView.jsx'
import ImageView from './ImageView.jsx'

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
    addNodeView() {
      return ReactNodeViewRenderer(MathView)
    },
  })
}

export const MathInline = mathNode('mathInline', true)
export const MathBlock = mathNode('mathBlock', false)

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.style.width || (el.getAttribute('width') ? `${el.getAttribute('width')}px` : null),
        renderHTML: (a) => (a.width ? { style: `width: ${a.width}` } : {}),
      },
      height: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
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

export function buildExtensions({ onEditMath }) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ResizableImage.configure({ inline: false, allowBase64: true }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: '오늘의 연구를 기록해 보세요. 사진은 끌어다 놓거나 Ctrl+V로 붙여넣을 수 있어요.' }),
    MathInline.configure({ onEdit: onEditMath }),
    MathBlock.configure({ onEdit: onEditMath }),
  ]
}
