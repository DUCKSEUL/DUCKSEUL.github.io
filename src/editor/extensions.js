import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import HardBreak from '@tiptap/extension-hard-break'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
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

/**
 * 수식 상자 진입 방향 기억 + 블록 수식 위아래 이동
 * - ←로 들어가면 상자 커서는 끝, →로 들어가면 처음 (Word와 같은 감각)
 * - 진입 자체는 ProseMirror 기본 동작(인접 atom 노드 선택)을 그대로 쓰고, 선택된 수식 노드가 편집 상자로 바뀜
 */
export const MathNav = Extension.create({
  name: 'mathNav',
  addStorage() {
    return { enterSide: null }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key: new PluginKey('mathNav'),
        props: {
          handleKeyDown(view, e) {
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false
            const { selection } = view.state
            if (!selection.empty) return false
            const { $from } = selection
            const isMath = (n) => n && n.type.name.startsWith('math')
            if (e.key === 'ArrowLeft') {
              if (isMath($from.nodeBefore)) storage.enterSide = 'end'
              else if ($from.parentOffset === 0 && $from.depth >= 1 && isMath(view.state.doc.resolve($from.before()).nodeBefore)) storage.enterSide = 'end'
            } else if (e.key === 'ArrowRight') {
              if (isMath($from.nodeAfter)) storage.enterSide = 'start'
              else if ($from.parentOffset === $from.parent.content.size && $from.depth >= 1 && isMath(view.state.doc.resolve($from.after()).nodeAfter)) storage.enterSide = 'start'
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') storage.enterSide = 'end'
            return false
          },
        },
      }),
    ]
  },
})
export const MathBlock = mathNode('mathBlock', false)

/* ── 사진 (인라인 블록 · 크기 조절) ─────────────
 * 사진은 문단 안의 인라인 노드라서 문단 정렬(text-align)을 그대로 따르고,
 * Alt+1(½) / Alt+2(⅓)로 줄이면 한 줄에 2~3장이 나란히 놓입니다.
 * 저장 형식: <img data-type="figure" src=".." style="width: 49%"> */
const imgOf = (el) => (el.tagName === 'IMG' ? el : el.querySelector('img'))
const HANDLES = ['tl', 'tr', 'bl', 'br']

/**
 * 빈 줄 정리: 공백(&nbsp;·' ')만 들어 있는 문단을 진짜 빈 문단으로 (붙여넣기·예전 글에서 생긴 자동 공백)
 * → 가운데 정렬 빈 줄의 ↵ 기호·커서가 한 칸 치우치지 않음
 */
export function stripBlankLineSpaces(html = '') {
  return html.replace(/<(p|h[2-4])(\s[^>]*)?>(?:\s|&nbsp;|&#160;)+<\/\1>/g, '<$1$2></$1>')
}

/** 예전 블록형 <figure>를 가운데 정렬 문단 안의 인라인 사진으로 변환 (에디터에 불러올 때) */
export function upgradeLegacyFigures(html = '') {
  html = stripBlankLineSpaces(html)
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

/**
 * 사진 2단계 삭제 (Word · Notion 방식)
 * - 1단계: 사진 바로 오른쪽(또는 사진 다음 빈 줄 맨 앞)에서 Backspace, 사진 바로 왼쪽(또는 사진 앞 줄 끝)에서 Delete
 *   → 지우지 않고 사진을 선택 상태로(파란 테두리 · 핸들 · 크기 배지)
 * - 2단계: 선택된 상태에서 Backspace/Delete → 실제 삭제 (기본 동작, Ctrl+Z로 복구)
 * - Esc → 선택만 풀고 커서를 사진 바로 오른쪽에 / 방향키·클릭은 기본 동작(선택 해제 + 커서 이동)
 */
const isImage = (n) => n?.type.name === 'image'
export const ImageDeleteGuard = Extension.create({
  name: 'imageDeleteGuard',
  priority: 1000,
  addKeyboardShortcuts() {
    const select = (pos) => {
      const { state, view } = this.editor
      view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)).scrollIntoView())
      return true
    }
    const guard = (dir) => () => {
      const { selection, doc } = this.editor.state
      if (!(selection instanceof TextSelection) || !selection.empty) return false
      const { $from } = selection
      if (!$from.parent.isTextblock) return false
      if (dir < 0) {
        if (isImage($from.nodeBefore)) return select($from.pos - $from.nodeBefore.nodeSize)
        if ($from.parentOffset === 0 && $from.depth >= 1) {
          const prev = doc.resolve($from.before()).nodeBefore
          if (prev?.isTextblock && isImage(prev.lastChild)) return select($from.before() - 1 - prev.lastChild.nodeSize)
        }
      } else {
        if (isImage($from.nodeAfter)) return select($from.pos)
        if ($from.parentOffset === $from.parent.content.size && $from.depth >= 1) {
          const next = doc.resolve($from.after()).nodeAfter
          if (next?.isTextblock && isImage(next.firstChild)) return select($from.after() + 1)
        }
      }
      return false
    }
    return {
      Backspace: guard(-1),
      Delete: guard(1),
      Escape: () => {
        const { selection, tr } = this.editor.state
        if (!(selection instanceof NodeSelection) || !isImage(selection.node)) return false
        this.editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, selection.to)))
        return true
      },
    }
  },
})

/* ── 강제 줄바꿈(Shift+Enter): 에디터 화면에만 ↵ 표시 ──
 * 노드 뷰는 편집 화면에만 쓰이고, 저장 HTML(getHTML)은 renderHTML의 <br> 그대로라
 * 상세 보기·네이버 복사에는 기호가 들어가지 않습니다. */
export const MarkedHardBreak = HardBreak.extend({
  addNodeView() {
    return () => {
      const dom = document.createElement('span')
      dom.className = 'hb-node'
      const mark = document.createElement('span')
      mark.className = 'hb-mark'
      mark.setAttribute('contenteditable', 'false')
      mark.setAttribute('aria-hidden', 'true')
      dom.append(mark, document.createElement('br'))
      return { dom, ignoreMutation: () => true }
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
  { value: 'dashed', label: '파선' },
  { value: 'double', label: '이중선' },
  { value: 'short', label: '짧은 중앙선' },
  { value: 'dots', label: '3점 장식선' },
]

export const DIVIDER_HINT = '더블 클릭하여 구분선 스타일 변경'
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
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('dividerPicker'),
        props: {
          // 편집 화면 전용: 마우스를 올리면 하이라이트 + 안내 툴팁 (저장 HTML에는 남지 않음)
          decorations(state) {
            const decos = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'horizontalRule') decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'hr-pickable', title: DIVIDER_HINT }))
            })
            return DecorationSet.create(state.doc, decos)
          },
          handleDOMEvents: {
            dblclick(view, e) {
              const hr = e.target?.closest?.('hr')
              if (!hr || !view.dom.contains(hr) || !view.editable) return false
              let pos
              try {
                pos = view.posAtDOM(hr, 0)
              } catch {
                return false
              }
              if (view.state.doc.nodeAt(pos)?.type.name !== 'horizontalRule') return false
              e.preventDefault()
              view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
              editor.emit('dividerDblClick', pos) // Write 화면의 DividerPopover가 받아서 팝오버를 엶
              return true
            },
          },
        },
      }),
    ]
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

/**
 * ↑/↓ 빈 줄 커서 보장
 * 브라우저 기본 세로 이동은 빈 문단이나 사진(contenteditable=false)이 이어질 때 빈 줄을 건너뛰기도 해서,
 * 현재 줄이 블록의 첫/마지막 줄이고 바로 위/아래 형제 블록이 '빈 줄'이면 커서를 그 안에 직접 둔다.
 * (빈 줄이 아니면 브라우저 기본 동작 — 글자 위치를 맞춘 세로 이동 — 을 그대로 사용)
 */
function atVerticalEdge(view, dir) {
  const sel = view.state.selection
  if (sel.empty) return view.endOfTextblock(dir)
  // 사진 등 인라인 노드가 선택된 상태: 그 노드가 문단의 첫/마지막 줄에 있는지 화면 좌표로 판단
  if (!(sel instanceof NodeSelection) || !sel.node.isInline) return false
  const para = view.domAtPos(sel.$from.start()).node
  const box = (para.nodeType === 1 ? para : para.parentElement)?.getBoundingClientRect()
  const r = view.nodeDOM(sel.from)?.getBoundingClientRect?.()
  if (!box || !r) return false
  return dir === 'up' ? r.top - box.top < 8 : box.bottom - r.bottom < 8
}

export const EmptyLineNav = Extension.create({
  name: 'emptyLineNav',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('emptyLineNav'),
        props: {
          handleKeyDown(view, e) {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return false
            const dir = e.key === 'ArrowUp' ? 'up' : 'down'
            const { state } = view
            const { $from } = state.selection
            const d = $from.depth
            if (d < 1 || !$from.parent.isTextblock) return false
            if (!atVerticalEdge(view, dir)) return false
            let target = null
            if (dir === 'down') {
              const after = $from.after(d)
              const next = state.doc.resolve(after).nodeAfter
              if (next?.isTextblock && next.content.size === 0) target = after + 1
            } else {
              const before = $from.before(d)
              const prev = state.doc.resolve(before).nodeBefore
              if (prev?.isTextblock && prev.content.size === 0) target = before - 1
            }
            if (target == null) return false
            e.preventDefault()
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, target)).scrollIntoView())
            return true
          },
        },
      }),
    ]
  },
})

export function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      horizontalRule: false,
      code: false, // Ctrl+E를 가운데 정렬로 쓰기 위해 인라인 코드 단축키 비활성화
      hardBreak: false, // ↵ 표시용 MarkedHardBreak로 대체
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    LineHeight,
    MarkedHardBreak,
    EmptyLineNav,
    Divider,
    Figure,
    ImageDeleteGuard,
    TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
    Cell,
    Header,
    Placeholder.configure({ placeholder: '오늘의 연구를 기록해 보세요. 사진은 끌어다 놓거나 Ctrl+V로 붙여넣을 수 있어요.' }),
    MathInline,
    MathBlock,
    MathNav,
  ]
}
