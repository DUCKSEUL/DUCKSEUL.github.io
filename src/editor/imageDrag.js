// 사진 마우스 조작 (Word 방식) — 편집 화면 전용
//
// ① 범위 선택: 사진을 가로지르는 드래그
//   - 사진(contenteditable=false 원자 노드) 쪽으로 끌면 브라우저 기본 선택은 끝점을 둘 곳이 없어
//     사진이 빠지거나 '노드 선택'(클릭 선택)으로 바뀜 → 직접 계산
//   - 기하학적 교차 판정: 드래그 시작점 ~ 현재 포인터가 만드는 사각형에 걸치는 사진을 모두 범위에 포함
//     (사진 오른쪽 여백에서 왼쪽·위·아래로 끌어도 지나간 사진이 전부 선택) → 파란 하이라이트(.is-selected-range)
//   - 사진이 있는 줄에서 시작한 드래그 · 사진 위에서 시작한 드래그는 처음부터 직접 처리, 글자 줄에서 시작한 드래그는
//     브라우저 기본 선택을 쓰되 사진에 닿는 순간 보정
//
// ② 끌어서 옮기기: 선택된 사진(1장 또는 여러 장) 중 아무 사진이나 잡고 끌기
//   - '사진 N장 이동' 배지가 달린 미리보기가 포인터를 따라다니고, 놓을 자리에 파란 삽입 위치 선이 표시됨
//   - 놓으면 선택돼 있던 사진만 순서 그대로 그 자리로 한꺼번에 이동(한 번의 Ctrl+Z로 되돌림) · Esc = 취소
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Fragment } from '@tiptap/pm/model'

const isImage = (n) => n?.type.name === 'image'
const THRESHOLD = 4

/** 현재 선택에 들어 있는 사진들 [{ pos, node }] (문서 순서) */
function selectedImages(state) {
  const sel = state.selection
  if (sel instanceof NodeSelection) return isImage(sel.node) ? [{ pos: sel.from, node: sel.node }] : []
  if (sel.empty) return []
  const out = []
  state.doc.nodesBetween(sel.from, sel.to, (node, pos) => {
    if (isImage(node) && pos >= sel.from && pos + node.nodeSize <= sel.to) out.push({ pos, node })
  })
  return out
}

/** 문서의 모든 사진과 화면 위치 */
function imageBoxes(view) {
  const out = []
  view.state.doc.descendants((node, pos) => {
    if (!isImage(node)) return
    const dom = view.nodeDOM(pos)
    if (dom?.getBoundingClientRect) out.push({ pos, size: node.nodeSize, rect: dom.getBoundingClientRect() })
  })
  return out
}

const intersects = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top

/** 포인터 위치의 문서 좌표 — 사진 위면 사진의 왼쪽/오른쪽 경계 중 가까운 쪽 */
function posAtPoint(view, x, y) {
  const hit = view.posAtCoords({ left: x, top: y })
  if (!hit) return null
  const node = hit.inside >= 0 ? view.state.doc.nodeAt(hit.inside) : null
  if (isImage(node)) {
    const r = view.nodeDOM(hit.inside)?.getBoundingClientRect()
    const before = r ? x < r.left + r.width / 2 : true
    return { pos: before ? hit.inside : hit.inside + node.nodeSize, img: hit.inside, size: node.nodeSize }
  }
  return { pos: hit.pos, img: null }
}

export const ImageDragSelect = Extension.create({
  name: 'imageDragSelect',
  addProseMirrorPlugins() {
    let drag = null
    // drag = { kind: 'select' | 'text' | 'move', anchor, x, y, lx, ly, moved, imgPos?, images?, ui? }

    /** 드래그 사각형과 포인터로 선택 끝(head) 계산 */
    const computeHead = (view, baseHead) => {
      const { anchor, x, y, lx, ly } = drag
      const box = { left: Math.min(x, lx), right: Math.max(x, lx), top: Math.min(y, ly), bottom: Math.max(y, ly) }
      let head = baseHead
      const p = posAtPoint(view, lx, ly)
      if (p?.img != null) head = anchor <= p.img ? p.img + p.size : p.img
      // 사각형에 걸친 사진이 모두 들어가도록 포인터 쪽으로 넓힘
      const backward = head < anchor || (head === anchor && lx < x)
      for (const b of imageBoxes(view)) {
        if (!intersects(box, b.rect)) continue
        if (backward && b.pos < anchor) head = Math.min(head, b.pos)
        else if (!backward && b.pos + b.size > anchor) head = Math.max(head, b.pos + b.size)
      }
      return head
    }

    const setRange = (view, head) => {
      const { state } = view
      const max = state.doc.content.size
      const a = Math.min(Math.max(0, drag.anchor), max)
      const h = Math.min(Math.max(0, head), max)
      const cur = state.selection
      if (!(cur instanceof NodeSelection) && cur.anchor === a && cur.head === h) return
      try {
        view.dispatch(state.tr.setSelection(TextSelection.between(state.doc.resolve(a), state.doc.resolve(h))))
      } catch {
        /* 문서 경계 밖 등: 그대로 */
      }
    }

    /* ── 끌어서 옮기기 UI ── */
    const startMoveUI = (images) => {
      const preview = document.createElement('div')
      preview.className = 'img-drag-preview'
      const thumb = document.createElement('img')
      thumb.src = images[0].node.attrs.src || ''
      thumb.alt = ''
      preview.appendChild(thumb)
      if (images.length > 1) {
        const stack = document.createElement('span')
        stack.className = 'img-drag-stack'
        preview.appendChild(stack)
      }
      const badge = document.createElement('span')
      badge.className = 'img-drag-badge'
      badge.textContent = `사진 ${images.length}장 이동`
      preview.appendChild(badge)
      const line = document.createElement('div')
      line.className = 'img-drop-line'
      line.hidden = true
      document.body.append(preview, line)
      document.body.classList.add('is-img-dragging')
      return { preview, line, drop: null }
    }
    const endMoveUI = (ui) => {
      ui?.preview.remove()
      ui?.line.remove()
      document.body.classList.remove('is-img-dragging')
    }
    /** 놓을 자리 계산 + 삽입 위치 선 표시 */
    const updateDrop = (view, ev) => {
      const { ui, images } = drag
      ui.preview.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`
      const p = posAtPoint(view, ev.clientX, ev.clientY)
      let drop = null
      if (p) {
        const $p = view.state.doc.resolve(p.pos)
        const first = images[0].pos
        const last = images[images.length - 1]
        const inside = p.pos > first && p.pos < last.pos + last.node.nodeSize
        if ($p.parent.inlineContent && !inside) drop = p.pos
      }
      ui.drop = drop
      if (drop == null) {
        ui.line.hidden = true
        return
      }
      try {
        const c = view.coordsAtPos(drop)
        const h = Math.max(18, c.bottom - c.top)
        ui.line.hidden = false
        ui.line.style.transform = `translate(${Math.round(c.left - 1)}px, ${Math.round(c.top)}px)`
        ui.line.style.height = `${h}px`
      } catch {
        ui.line.hidden = true
      }
    }
    /** 선택된 사진을 drop 위치로 한꺼번에 이동 (순서 유지) */
    const commitMove = (view, images, drop) => {
      let tr = view.state.tr
      for (let i = images.length - 1; i >= 0; i--) tr = tr.delete(images[i].pos, images[i].pos + images[i].node.nodeSize)
      const at = tr.mapping.map(drop)
      const frag = Fragment.fromArray(images.map((x) => x.node))
      tr = tr.insert(at, frag)
      tr = tr.setSelection(TextSelection.create(tr.doc, at, at + frag.size)).scrollIntoView()
      view.dispatch(tr)
      view.focus()
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('keydown', onKey, true)
      if (drag?.timer) clearInterval(drag.timer)
      endMoveUI(drag?.ui)
      drag = null
    }
    let viewRef = null
    /** 사진이 있는 글: 시작점~포인터 사각형 기준으로 범위 선택 */
    function selectAt(view) {
      const p = posAtPoint(view, drag.lx, drag.ly)
      if (p) setRange(view, computeHead(view, p.pos))
    }
    function onMove(ev) {
      const view = viewRef
      if (!drag || !view) return
      if (!(ev.buttons & 1)) return onUp()
      drag.lx = ev.clientX
      drag.ly = ev.clientY
      if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < THRESHOLD) return
      if (!drag.moved) {
        drag.moved = true
        if (drag.kind === 'move') drag.ui = startMoveUI(drag.images)
      }
      if (drag.kind === 'move') return updateDrop(view, ev)
      if (drag.kind === 'select') {
        selectAt(view)
        // 화면 위·아래 가장자리로 끌면 자동 스크롤 (브라우저 기본 선택을 쓰지 않으므로 직접)
        const dir = ev.clientY < 70 ? -1 : ev.clientY > window.innerHeight - 40 ? 1 : 0
        if (dir && !drag.timer) {
          drag.timer = setInterval(() => {
            if (!drag || drag.kind !== 'select') return
            const d = drag.ly < 70 ? -1 : drag.ly > window.innerHeight - 40 ? 1 : 0
            if (!d) return
            window.scrollBy(0, d * 16)
            selectAt(view)
          }, 30)
        }
        return
      }
      // 'text': 글자 위는 브라우저 기본 선택, 사진에 닿거나 사각형에 사진이 걸리면 보정
      const cur = view.state.selection
      const base = cur instanceof NodeSelection ? (drag.anchor <= cur.from ? cur.to : cur.from) : cur.head
      const head = computeHead(view, base)
      if (head !== base || cur instanceof NodeSelection) setRange(view, head)
    }
    function onUp() {
      const view = viewRef
      const d = drag
      if (!d || !view) return cleanup()
      if (d.kind === 'move' && d.moved && d.ui?.drop != null) {
        const images = d.images
        const drop = d.ui.drop
        cleanup()
        return commitMove(view, images, drop)
      }
      if (d.kind === 'select' && d.moved) {
        // 마지막 위치로 한 번 더 확정 → 에디터 선택 = 실제 DOM 선택(사진 앞~뒤 포함): 바로 끌어 옮기기 · 복사 · 삭제 · 정렬 가능
        selectAt(view)
      }
      if (!d.moved && d.imgPos != null) {
        // 그냥 클릭 = 그 사진만 선택(핸들)
        const { state } = view
        if (isImage(state.doc.nodeAt(d.imgPos))) view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, d.imgPos)))
      }
      cleanup()
    }
    function onKey(ev) {
      if (ev.key === 'Escape' && drag?.kind === 'move') {
        ev.preventDefault()
        ev.stopPropagation()
        cleanup()
      }
    }

    return [
      new Plugin({
        key: new PluginKey('imageDragSelect'),
        view(view) {
          viewRef = view
          return { destroy: () => cleanup() }
        },
        props: {
          handleDOMEvents: {
            mousedown(view, e) {
              if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.detail > 1 || !view.editable) return false
              if (drag) cleanup()
              const hit = view.posAtCoords({ left: e.clientX, top: e.clientY })
              if (!hit) return false
              const { state } = view
              const node = hit.inside >= 0 ? state.doc.nodeAt(hit.inside) : null
              const imgEl = e.target?.closest?.('.img-node')
              const onImg = isImage(node) && !!imgEl
              const base = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }

              if (onImg) {
                const picked = selectedImages(state)
                if (picked.some((x) => x.pos === hit.inside)) {
                  // 선택된 사진을 잡음 → 끌어서 옮기기 (그냥 클릭이면 그 사진만 선택)
                  drag = { ...base, kind: 'move', images: picked, imgPos: hit.inside }
                } else {
                  const r = imgEl.getBoundingClientRect()
                  const anchor = e.clientX < r.left + r.width / 2 ? hit.inside : hit.inside + node.nodeSize
                  drag = { ...base, kind: 'select', anchor, imgPos: hit.inside }
                }
              } else {
                // 수식 · 구분선 같은 다른 원자 노드, 표 안은 원래 동작(클릭 선택 · 셀 선택) 그대로
                if (node && node.isAtom && !isImage(node)) return false
                const $p = state.doc.resolve(hit.pos)
                for (let d = $p.depth; d > 0; d--) if (/^table/.test($p.node(d).type.name)) return false
                let docHasImg = false
                state.doc.descendants((n) => {
                  if (docHasImg) return false
                  if (isImage(n)) docHasImg = true
                })
                if ($p.parent.inlineContent && docHasImg) {
                  // 사진이 있는 글: 사진 오른쪽 아래 커서 자리 · 아래 빈 줄 등 어디서 시작하든 처음부터 직접 계산
                  // (브라우저 기본 선택은 사진에 닿지 못하고, 마우스를 놓는 순간 마지막 기본 선택이 보정을 덮어써 버림)
                  drag = { ...base, kind: 'select', anchor: hit.pos, imgPos: null }
                  e.preventDefault()
                  view.focus()
                  try {
                    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, hit.pos)))
                  } catch {
                    /* ignore */
                  }
                } else {
                  drag = { ...base, kind: 'text', anchor: hit.pos, imgPos: null }
                }
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp, true)
              window.addEventListener('keydown', onKey, true)
              if (drag.kind === 'text') return false // 브라우저 기본 선택 시작
              if (onImg) {
                e.preventDefault() // 고스트 이미지 끌기 · 기본 선택 시작 막기
                view.focus()
              }
              return true
            },
            // 브라우저 기본 끌기(dragstart)가 시작되지 않게 — 사진 옮기기는 위의 직접 구현으로
            dragstart(_view, e) {
              if (e.target?.closest?.('.img-node')) {
                e.preventDefault()
                return true
              }
              return false
            },
          },
        },
        // 글자 줄에서 시작한 드래그: 브라우저 선택이 사진 한 장을 딱 덮어 '노드 선택'이 되면 범위 선택으로 유지
        appendTransaction(_trs, _old, state) {
          const sel = state.selection
          if (!drag?.moved || drag.kind === 'move' || !(sel instanceof NodeSelection) || !isImage(sel.node)) return null
          try {
            const head = drag.anchor <= sel.from ? sel.to : sel.from
            return state.tr.setSelection(TextSelection.between(state.doc.resolve(drag.anchor), state.doc.resolve(head)))
          } catch {
            return null
          }
        },
      }),
    ]
  },
})
