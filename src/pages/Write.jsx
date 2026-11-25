import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import { buildExtensions, upgradeLegacyFigures } from '../editor/extensions.js'
import Toolbar from '../editor/Toolbar.jsx'
import { applyFormat, describeFormat, readFormat } from '../editor/formatPainter.js'
import MathPopover from '../editor/MathPopover.jsx'
import TableToolbar from '../editor/TableToolbar.jsx'
import Modal from '../components/Modal.jsx'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import { usePosts, savePost, newId, markSynced, savePrivatePost, removePrivatePost, isPubliclyListed } from '../lib/store.js'
import { useAdmin } from '../lib/admin.js'
import AdminOnly from '../components/AdminOnly.jsx'
import { saveDraft, loadDraft, clearDraft, relativeTime } from '../lib/drafts.js'
import { fileToDataUrl, imageFiles, isSvgSrc, svgSrcToPng } from '../lib/image.js'
import NotFound from './NotFound.jsx'
import { JOURNAL_CATS } from '../lib/labels.js'

const AUTOSAVE_MS = 2000

/** 붙여넣기 등으로 들어온 SVG 사진을 안전한 PNG로 교체 (스크립트가 든 SVG가 그대로 발행되지 않도록) */
const svgBusy = new Set()
function sanitizeSvgImages(editor) {
  const found = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && isSvgSrc(node.attrs.src || '') && !svgBusy.has(node.attrs.src)) found.push(node.attrs.src)
  })
  for (const src of new Set(found)) {
    svgBusy.add(src)
    svgSrcToPng(src)
      .catch((e) => {
        console.warn('[editor] SVG 변환 실패:', e)
        toast('SVG 사진은 안전을 위해 PNG로 바꿔 넣어요. 이 SVG는 변환하지 못해 제외했어요.', 'error')
        return null
      })
      .then((png) => {
        svgBusy.delete(src)
        if (editor.isDestroyed) return
        const { tr } = editor.state
        let changed = false
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== 'image' || node.attrs.src !== src) return
          if (png) tr.setNodeMarkup(tr.mapping.map(pos), undefined, { ...node.attrs, src: png })
          else tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + node.nodeSize))
          changed = true
        })
        if (changed) editor.view.dispatch(tr)
      })
  }
}

export default function Write() {
  const { id } = useParams()
  const { posts, ready } = usePosts()
  const { status, isAdmin } = useAdmin()
  if (status === 'checking' || (id && !ready)) return <div className="page" />
  if (!isAdmin) return <AdminOnly />
  const existing = id ? posts.find((p) => p.id === id) : null
  if (id && !existing) return <NotFound />
  return <EditorPage key={id || 'new'} initial={existing} categories={[...new Set(posts.map((p) => p.category).filter(Boolean))]} />
}

function SaveBadge({ savedAt, saving, privateAt }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className={`save-badge ${savedAt ? 'is-saved' : ''}`} aria-live="polite">
      <span className={`dot ${saving ? 'is-saving' : ''}`} />
      {privateAt && (!savedAt || privateAt >= savedAt)
        ? `${relativeTime(privateAt)} 저장됨 (나만 보기)`
        : savedAt
          ? `${relativeTime(savedAt)} 자동 백업됨`
          : '작성 중'}
    </span>
  )
}

function countChars(editor) {
  if (!editor) return { all: 0, noSpace: 0, minutes: 0 }
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', (node) =>
    node.type.name.startsWith('math') ? node.attrs.latex : '',
  )
  const all = text.replace(/\n/g, '').length
  const noSpace = text.replace(/\s/g, '').length
  return { all, noSpace, minutes: noSpace ? Math.max(1, Math.ceil(noSpace / 500)) : 0 }
}

function EditorPage({ initial, categories }) {
  useDocumentTitle(initial ? `수정: ${initial.title} · 연구 일지` : '새 일지 쓰기 · 연구 일지')
  const navigate = useNavigate()
  const draftKey = initial ? `journal-draft:${initial.id}` : 'journal-draft:new'
  const [postId] = useState(() => initial?.id || newId())
  const createdAt = useRef(initial?.createdAt || new Date().toISOString())
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || '연구 노트')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
  const [savedAt, setSavedAt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [recovery, setRecovery] = useState(null)
  const [mathState, setMathState] = useState(null)
  const [linkState, setLinkState] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [privateAt, setPrivateAt] = useState(null)
  const [savingPrivate, setSavingPrivate] = useState(false)
  // 공개 저장소에 올라가 있는 글을 비공개로 저장하려 할 때 선택 창
  const [convert, setConvert] = useState(null)
  const wasPrivate = initial?.source === 'private'
  const onPublic = !!initial && isPubliclyListed(initial.id)
  const visibility = wasPrivate || (initial?.draft && !onPublic) || !initial ? 'private' : 'public'
  const saveRef = useRef(null)
  const fileRef = useRef(null)
  const editorRef = useRef(null)
  const copiedFormat = useRef(null) // Alt+C 모양 복사 버퍼
  const [fmtToast, setFmtToast] = useState(null)
  const fmtTimer = useRef(null)
  const dirty = useRef(false)
  const recoveryRef = useRef(null)
  // 저장/발행하지 않은 변경이 있는지: 본문 변경 여부 + 마지막 저장 시점의 제목·카테고리·태그와 비교
  const docChanged = useRef(false)
  const baseRef = useRef({ title: initial?.title || '', category: initial?.category || '연구 노트', tags: (initial?.tags || []).join(', ') })
  recoveryRef.current = recovery

  const onEditMath = useCallback(({ latex, display, pos, rect }) => {
    setMathState({ latex, display, pos, anchor: { left: rect.left, top: rect.top, bottom: rect.bottom } })
  }, [])
  const extensions = useMemo(() => buildExtensions({ onEditMath: (s) => onEditMath(s) }), [onEditMath])

  const insertImages = useCallback(async (files, pos) => {
    const ed = editorRef.current
    if (!ed) return
    for (const f of files) {
      try {
        const src = await fileToDataUrl(f)
        const at = pos ?? ed.state.selection.from
        ed.chain().focus().insertContentAt(at, { type: 'image', attrs: { src, alt: '' } }).run()
      } catch (e) {
        console.warn(e)
        toast('사진을 불러오지 못했어요.', 'error')
      }
    }
  }, [])

  const editor = useEditor({
    extensions,
    content: upgradeLegacyFigures(initial?.html || ''),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'prose editor-content', spellcheck: 'false' },
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData)
        if (!files.length) return false
        const html = event.clipboardData.getData('text/html')
        if (html && /<img/i.test(html) && !/^\s*<(meta[^>]*>\s*)?<img/i.test(html)) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = imageFiles(event.dataTransfer)
        if (!files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertImages(files, pos)
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      dirty.current = true
      docChanged.current = true
      sanitizeSvgImages(ed)
    },
    onCreate: ({ editor: ed }) => sanitizeSvgImages(ed),
  })
  editorRef.current = editor

  // ── 임시저장 복구 안내 ─────────────────
  useEffect(() => {
    let alive = true
    loadDraft(draftKey).then((d) => {
      if (!alive || !d) return
      const same = d.html === (initial?.html || '') && d.title === (initial?.title || '')
      if (!same && (d.title || d.html?.replace(/<[^>]+>/g, '').trim() || /<img|data-latex/.test(d.html || ''))) setRecovery(d)
    })
    return () => {
      alive = false
    }
  }, [draftKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const restore = () => {
    const d = recovery
    editorRef.current?.commands.setContent(upgradeLegacyFigures(d.html || ''))
    setTitle(d.title || '')
    setCategory(d.category || '연구 노트')
    setTags(d.tags || '')
    setRecovery(null)
    setSavedAt(d.savedAt)
    toast('임시저장된 글을 복구했어요.')
  }
  const discard = async () => {
    await clearDraft(draftKey)
    setRecovery(null)
  }

  // ── 2초 간격 자동 임시저장 ─────────────
  const latest = useRef({})
  latest.current = { title, category, tags }
  const isUnsaved = () => {
    const b = baseRef.current
    const l = latest.current
    return docChanged.current || l.title !== b.title || l.category !== b.category || l.tags !== b.tags
  }
  const markSaved = () => {
    docChanged.current = false
    baseRef.current = { ...latest.current }
  }

  // 다른 메뉴로 이동하려 할 때 확인 팝업
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && isUnsaved())
  // 새로고침·탭 닫기: 브라우저 기본 확인창
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isUnsaved()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    dirty.current = true
  }, [title, category, tags])
  useEffect(() => {
    dirty.current = false // 처음 불러온 상태는 저장하지 않음
    const t = setInterval(async () => {
      const ed = editorRef.current
      if (!ed || !dirty.current || recoveryRef.current) return
      dirty.current = false
      setSaving(true)
      try {
        const ts = Date.now()
        await saveDraft(draftKey, { ...latest.current, html: ed.getHTML(), savedAt: ts })
        setSavedAt(ts)
      } catch {
        toast('임시저장에 실패했어요. 백업을 권장해요.', 'error')
      } finally {
        setSaving(false)
      }
    }, AUTOSAVE_MS)
    return () => clearInterval(t)
  }, [draftKey])

  // ── 단축키 ─────────────────────────────
  useEffect(() => {
    const inEditor = (e) => !!e.target?.closest?.('.ProseMirror')
    const onKey = (e) => {
      const ed = editorRef.current
      if (!ed) return
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+E / L / R : 정렬 (브라우저 기본 동작 차단)
      // Ctrl+S : 나만 보기로 저장 (제목·태그 입력 중에도 동작, 브라우저 '페이지 저장' 차단)
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        e.stopPropagation()
        saveRef.current?.()
        return
      }
      if (mod && !e.altKey && !e.shiftKey && inEditor(e)) {
        const k = e.key.toLowerCase()
        if (k === 'e' || k === 'l' || k === 'r') {
          e.preventDefault()
          e.stopPropagation()
          if (k === 'e') ed.chain().focus().setTextAlign(ed.isActive({ textAlign: 'center' }) ? 'left' : 'center').run()
          if (k === 'l') ed.chain().focus().setTextAlign('left').run()
          if (k === 'r') ed.chain().focus().setTextAlign('right').run()
          return
        }
        if (k === 'k') {
          e.preventDefault()
          e.stopPropagation()
          openLink()
          return
        }
      }
      if (!e.altKey || mod) return
      // Alt+C (macOS ⌥C — 입력 문자 'ç'와 무관하게 물리 키로 판별): 모양 복사 / 적용
      if (e.code === 'KeyC' && !e.shiftKey && inEditor(e)) {
        e.preventDefault()
        e.stopPropagation()
        formatPainter(ed)
        return
      }
      if (e.code === 'Digit3') {
        e.preventDefault()
        e.stopPropagation()
        openMath()
      } else if (e.code === 'Digit1' || e.code === 'Digit2') {
        const sel = ed.state.selection
        if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
          e.preventDefault()
          e.stopPropagation()
          // 좌우 여백(0.5%씩) 포함 ½ = 50%, ⅓ = 33.3% → 한 줄에 2장 / 3장
          ed.chain().updateAttributes('image', { width: e.code === 'Digit1' ? '49%' : '32.3%' }).run()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showFmtToast(text) {
    clearTimeout(fmtTimer.current)
    setFmtToast({ text, id: Date.now() })
    fmtTimer.current = setTimeout(() => setFmtToast(null), 1800)
  }

  // 한글(HWP) 방식 모양 복사: 커서만 → 복사, 드래그 선택 → 복사해 둔 서식 일괄 적용
  function formatPainter(ed) {
    const { selection } = ed.state
    if (selection.empty || !copiedFormat.current) {
      const f = readFormat(ed, { caret: selection.empty })
      copiedFormat.current = f
      showFmtToast(`서식 복사됨 (${describeFormat(f)})`)
      return
    }
    if (selection instanceof NodeSelection && !selection.node.isInline) return
    applyFormat(ed, copiedFormat.current)
    showFmtToast(`서식 적용됨 (${describeFormat(copiedFormat.current)})`)
  }

  function openMath() {
    const ed = editorRef.current
    const sel = ed.state.selection
    if (sel instanceof NodeSelection && sel.node.type.name.startsWith('math')) {
      const dom = ed.view.nodeDOM(sel.from)
      const rect = (dom?.querySelector?.('.katex') || dom).getBoundingClientRect()
      setMathState({ latex: sel.node.attrs.latex, display: sel.node.type.name === 'mathBlock', pos: sel.from, anchor: { left: rect.left, top: rect.top, bottom: rect.bottom } })
      return
    }
    let c
    try {
      c = ed.view.coordsAtPos(sel.from)
    } catch {
      const r = ed.view.dom.getBoundingClientRect()
      c = { left: r.left, top: r.top, bottom: r.top + 24 }
    }
    setMathState({ latex: '', display: false, pos: null, anchor: { left: c.left, top: c.top, bottom: c.bottom } })
  }

  const submitMath = ({ latex, display, pos }) => {
    const ed = editorRef.current
    const type = display ? 'mathBlock' : 'mathInline'
    if (pos == null) {
      ed.chain().focus().insertContent({ type, attrs: { latex } }).run()
    } else {
      const node = ed.state.doc.nodeAt(pos)
      if (node && node.type.name === type) {
        ed.chain()
          .focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { latex })
            return true
          })
          .run()
      } else if (node) {
        ed.chain()
          .focus()
          .insertContentAt({ from: pos, to: pos + node.nodeSize }, { type, attrs: { latex } })
          .run()
      }
    }
    setMathState(null)
  }
  const closeMath = useCallback(() => {
    setMathState(null)
    editorRef.current?.commands.focus()
  }, [])

  function openLink() {
    const ed = editorRef.current
    const { from, to } = ed.state.selection
    setLinkState({
      href: ed.getAttributes('link').href || '',
      text: ed.state.doc.textBetween(from, to, ' '),
      hasSelection: from !== to,
    })
  }
  const submitLink = (e) => {
    e.preventDefault()
    const ed = editorRef.current
    let href = linkState.href.trim()
    if (!href) {
      ed.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      if (!/^(https?:|mailto:|\/|#)/i.test(href)) href = 'https://' + href
      if (linkState.hasSelection || ed.isActive('link')) {
        ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
      } else {
        const text = linkState.text.trim() || href
        ed.chain()
          .focus()
          .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
          .insertContent(' ')
          .run()
      }
    }
    setLinkState(null)
  }

  const buildPost = (draft) => ({
    id: postId,
    title: title.trim() || '제목 없음',
    category: category.trim() || '연구 노트',
    tags: tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    createdAt: createdAt.current,
    updatedAt: new Date().toISOString(),
    draft,
    html: editor.getHTML(),
  })

  // 비공개 저장: 관리자 GitHub 계정의 private 저장소(private-posts.json)에 커밋 → 어느 기기에서든 Admin 로그인 시 보임
  // unpublish: 공개 저장소의 글도 삭제(공개 → 비공개 전환). 공개본이 있는데 선택 전이면 선택 창을 띄움.
  const savePrivate = async (after, { unpublish } = {}) => {
    if (!editorRef.current || publishing || savingPrivate) return
    if (unpublish === undefined && onPublic) {
      setConvert({ after })
      return
    }
    setConvert(null)
    const post = buildPost(true)
    const finish = () => {
      dirty.current = false
      markSaved()
      setPrivateAt(Date.now())
      if (typeof after === 'function') after()
      else navigate(`/journal/${postId}`)
    }
    setSavingPrivate(true)
    try {
      const res = await savePrivatePost(post, { unpublish: !!unpublish })
      await clearDraft(draftKey)
      finish()
      if (res.unpublishError) toast(`비공개 저장소에는 저장했지만 공개 글 삭제에 실패했어요: ${res.unpublishError}`, 'error')
      else if (res.unpublished) toast('🔒 비공개로 전환했어요. 공개 저장소에서 삭제했고 1~2분 뒤 사이트에서도 사라져요.')
      else toast('🔒 비공개 저장소에 저장했어요. 다른 기기에서도 Admin 로그인 시 보여요.')
    } catch (e) {
      console.warn(e)
      // 비공개 저장소에 못 올렸으면 글이 사라지지 않도록 이 브라우저에 임시 보관
      try {
        await savePost(post)
        await clearDraft(draftKey)
        finish()
        toast(`비공개 저장소 저장 실패: ${e.message} — 이 브라우저에만 임시로 저장했어요.`, 'error')
      } catch {
        toast('저장하지 못했어요. 백업 후 다시 시도해 주세요.', 'error')
      }
    } finally {
      setSavingPrivate(false)
    }
  }
  // 공개 글을 수정하던 중 Ctrl+S: 공개 상태는 그대로 두고 즉시 임시저장만
  const backupNow = async () => {
    const ed = editorRef.current
    if (!ed) return
    const ts = Date.now()
    await saveDraft(draftKey, { ...latest.current, html: ed.getHTML(), savedAt: ts })
    dirty.current = false
    setSavedAt(ts)
    toast('임시저장했어요. 공개 글에는 「수정 발행」을 눌러야 반영돼요.')
  }
  saveRef.current = () => (visibility === 'public' ? backupNow() : savePrivate())

  const publish = async () => {
    if (!title.trim()) {
      toast('제목을 입력해 주세요.', 'error')
      document.getElementById('post-title')?.focus()
      return
    }
    const post = buildPost(false)
    // 1) 먼저 이 브라우저에 저장 (GitHub 발행이 실패해도 글이 사라지지 않도록)
    try {
      await savePost(post)
      await clearDraft(draftKey)
      dirty.current = false
      markSaved()
    } catch {
      toast('저장 공간이 부족해 저장하지 못했어요. 백업 후 다시 시도해 주세요.', 'error')
      return
    }
    // 2) GitHub 저장소에 커밋 → Actions가 사이트를 다시 배포
    setPublishing(true)
    try {
      const { publishChanges } = await import('../lib/publish.js')
      await publishChanges({ upserts: [post] })
      await markSynced([post.id])
      // 비공개 글을 공개로 전환: 비공개 저장소에서 제거
      if (wasPrivate) {
        try {
          await removePrivatePost(post.id)
        } catch (e) {
          toast(`공개로 발행했지만 비공개 저장소에서 지우지 못했어요: ${e.message}`, 'error')
        }
      }
      toast(wasPrivate ? '🌐 공개 게시로 전환했어요! 1~2분 뒤 모든 방문자에게 반영돼요.' : 'GitHub에 발행했어요! 1~2분 뒤 모든 방문자에게 반영돼요.')
    } catch (e) {
      console.warn(e)
      toast(`GitHub 발행 실패: ${e.message} — 이 브라우저에 저장해 두었어요. 목록에서 다시 발행할 수 있어요.`, 'error')
    } finally {
      setPublishing(false)
    }
    navigate(`/journal/${postId}`)
  }

  const counts = countChars(editor)

  // 문서 용지의 좌우 여백 클릭: 그 높이의 줄(사진이면 사진 바로 앞/뒤)에 커서를 놓음
  const onPaperMouseDown = (e) => {
    const ed = editorRef.current
    if (!ed || e.button !== 0 || e.target.closest('.ProseMirror, input, textarea, button, a')) return
    const view = ed.view
    const r = view.dom.getBoundingClientRect()
    if (e.clientY < r.top || e.clientY > r.bottom) return
    if (e.clientX >= r.left && e.clientX <= r.right) return
    const left = e.clientX < r.left
    const x = left ? r.left + 2 : r.right - 2
    const hit = view.posAtCoords({ left: x, top: e.clientY })
    if (!hit) return
    e.preventDefault()
    let pos = hit.pos
    // 그 높이에 걸친 사진들 중 가장 왼쪽/오른쪽 사진의 바로 앞/뒤
    const rowImgs = [...view.dom.querySelectorAll('.img-node')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => e.clientY >= r.top && e.clientY <= r.bottom)
      .sort((a, b) => a.r.left - b.r.left)
    const edgeImg = left ? rowImgs[0] : rowImgs[rowImgs.length - 1]
    let imgPos = null
    if (edgeImg) {
      const p = view.posAtDOM(edgeImg.el, 0)
      imgPos = [p, p - 1].find((q) => q >= 0 && ed.state.doc.nodeAt(q)?.type.name === 'image') ?? null
    }
    if (imgPos != null) pos = left ? imgPos : imgPos + 1
    else {
      // 해당 줄의 가장 가까운 끝(왼쪽 클릭 → 줄 시작, 오른쪽 → 줄 끝)
      const edge = view.posAtCoords({ left: left ? r.left + 1 : r.right - 1, top: e.clientY })
      if (edge) pos = edge.pos
    }
    const sel = Selection.near(ed.state.doc.resolve(Math.min(pos, ed.state.doc.content.size)), left ? 1 : -1)
    view.dispatch(ed.state.tr.setSelection(sel).scrollIntoView())
    view.focus()
  }

  return (
    <div className="write">
      <div className="write-bar">
        <div className="container write-bar-inner">
          <Link to={initial ? `/journal/${initial.id}` : '/journal'} className="back-link">
            <Icon name="chevronLeft" size={18} /> <span className="hide-sm">{initial ? '글로 돌아가기' : '연구 일지'}</span>
          </Link>
          <SaveBadge savedAt={savedAt} saving={saving} privateAt={privateAt} />
          <span className={`vis-pill ${visibility === 'private' ? 'is-private' : 'is-public'}`} title={visibility === 'private' ? '비공개 저장소에만 저장돼요' : '모든 방문자에게 공개된 글이에요'}>
            {visibility === 'private' ? '🔒 나에게만 보기' : '🌐 공개 글'}
          </span>
          <button
            className="btn btn-md btn-outline btn-private"
            onClick={() => savePrivate()}
            disabled={publishing || savingPrivate}
            title={visibility === 'private' ? '비공개 저장소에 저장 (Ctrl+S)' : '공개를 거두고 비공개 저장소로 옮기기'}
          >
            <Icon name="lock" size={16} strokeWidth={2.2} /> {savingPrivate ? '저장 중…' : visibility === 'private' ? '비공개 유지 저장' : '비공개로 전환'}
            {visibility === 'private' && <span className="hide-sm btn-kbd">Ctrl+S</span>}
          </button>
          <button className="btn btn-md btn-primary" onClick={publish} disabled={publishing || savingPrivate} title="모든 방문자에게 공개">
            {publishing ? '발행 중…' : wasPrivate ? '공개 게시로 전환' : initial && initial.source !== 'local' && !initial.draft ? '수정 발행' : '공개 게시'}
          </button>
        </div>
        <div className="toolbar-wrap">
          <Toolbar editor={editor} onMath={openMath} onLink={openLink} onImage={() => fileRef.current?.click()} />
          {fmtToast && (
            <div key={fmtToast.id} className="fmt-toast" role="status" aria-live="polite">
              <Icon name="check" size={14} strokeWidth={2.6} /> {fmtToast.text}
            </div>
          )}
        </div>
      </div>

      {recovery && (
        <div className="recovery" role="alert">
          <Icon name="note" size={20} />
          <p>
            <strong>임시저장된 글이 있어요.</strong>
            <span>
              {new Date(recovery.savedAt).toLocaleString('ko-KR')}에 저장된 「{recovery.title || '제목 없음'}」을 이어서 쓸까요?
            </span>
          </p>
          <button className="btn btn-sm btn-ghost" onClick={discard}>
            삭제
          </button>
          <button className="btn btn-sm btn-primary" onClick={restore}>
            복구하기
          </button>
        </div>
      )}

      <div className="write-doc" onMouseDown={onPaperMouseDown}>
        <div className="write-meta">
          <input
            className="meta-input"
            list="category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="카테고리"
            placeholder="카테고리"
          />
          <datalist id="category-list">
            {[...new Set([...JOURNAL_CATS, '실험 기록', '아이디어', ...categories])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input className="meta-input grow" value={tags} onChange={(e) => setTags(e.target.value)} aria-label="태그" placeholder="태그 (쉼표로 구분)" />
        </div>
        <textarea
          id="post-title"
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              editor?.commands.focus('start')
            }
          }}
          placeholder="제목"
          rows={1}
          aria-label="제목"
        />
        <hr className="title-rule" />
        <EditorContent editor={editor} />
      </div>

      <div className="write-foot" aria-live="off">
        <div className="container write-foot-inner">
          <span>
            글자 수 <strong data-testid="count-all">{counts.all.toLocaleString()}</strong>
            <em>(공백 제외 <strong data-testid="count-nospace">{counts.noSpace.toLocaleString()}</strong>)</em>
          </span>
          <span>
            예상 읽기 시간 <strong data-testid="read-time">{counts.minutes}분</strong>
          </span>
          <span className="foot-keys hide-sm">
            <kbd>Ctrl</kbd>+<kbd>S</kbd> 저장 · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 구분선 · <kbd>Ctrl</kbd>+<kbd>E</kbd>/<kbd>L</kbd>/<kbd>R</kbd> 정렬 · <kbd>Alt</kbd>+<kbd>1</kbd>/<kbd>2</kbd> 사진 크기 · <kbd>Alt</kbd>+<kbd>3</kbd> 수식
          </span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...e.target.files]
          e.target.value = ''
          insertImages(files)
        }}
      />

      <TableToolbar editor={editor} />
      <MathPopover state={mathState} onClose={closeMath} onSubmit={submitMath} />

      <Modal
        open={blocker.state === 'blocked'}
        title="작성 중인 글이 있어요"
        onClose={() => blocker.reset?.()}
        width={440}
        footer={
          <>
            <button
              className="btn btn-md btn-ghost danger-text"
              onClick={async () => {
                dirty.current = false
                markSaved()
                await clearDraft(draftKey)
                blocker.proceed?.()
              }}
            >
              저장 안 하고 나가기
            </button>
            <button className="btn btn-md btn-ghost" onClick={() => blocker.reset?.()}>
              계속 쓰기
            </button>
            {visibility === 'private' ? (
              <button className="btn btn-md btn-primary" autoFocus onClick={() => savePrivate(() => blocker.proceed?.())}>
                비공개 저장하고 나가기
              </button>
            ) : (
              <button
                className="btn btn-md btn-primary"
                autoFocus
                onClick={async () => {
                  await backupNow()
                  markSaved()
                  blocker.proceed?.()
                }}
              >
                임시저장하고 나가기
              </button>
            )}
          </>
        }
      >
        <p className="modal-text">
          저장하지 않은 내용이 있어요.{' '}
          {visibility === 'private' ? (
            <>
              나가기 전에 <strong>🔒 비공개 저장소</strong>에 저장할까요?
            </>
          ) : (
            <>
              공개 글은 그대로 두고 <strong>임시저장</strong>해 둘까요? (다음에 이어서 쓸 수 있어요)
            </>
          )}
          <br />
          저장하지 않고 나가면 이번에 쓴 내용은 사라져요.
        </p>
      </Modal>

      <Modal
        open={!!convert}
        title="공개된 글이에요"
        onClose={() => setConvert(null)}
        width={480}
        footer={
          <>
            <button className="btn btn-md btn-ghost" onClick={() => setConvert(null)}>
              취소
            </button>
            <button className="btn btn-md btn-ghost" onClick={() => savePrivate(convert?.after, { unpublish: false })}>
              공개본은 그대로 두기
            </button>
            <button className="btn btn-md btn-primary" autoFocus onClick={() => savePrivate(convert?.after, { unpublish: true })}>
              🔒 비공개로 전환
            </button>
          </>
        }
      >
        <p className="modal-text">
          이 글은 지금 모든 방문자에게 공개되어 있어요.
          <br />
          <strong>비공개로 전환</strong>하면 공개 저장소에서 삭제되고 비공개 저장소로 옮겨져요.
          <br />
          <strong>공개본은 그대로 두기</strong>를 고르면 방문자에게는 이전 공개본이 계속 보이고, 지금 내용은 나에게만 보이는 수정본으로 저장돼요.
        </p>
      </Modal>

      <Modal
        open={!!linkState}
        title="링크 삽입"
        onClose={() => setLinkState(null)}
        width={480}
        footer={
          <>
            {editor?.isActive('link') && (
              <button
                className="btn btn-md btn-ghost danger-text"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  setLinkState(null)
                }}
              >
                링크 제거
              </button>
            )}
            <button className="btn btn-md btn-ghost" onClick={() => setLinkState(null)}>
              취소
            </button>
            <button className="btn btn-md btn-primary" type="submit" form="link-form">
              확인
            </button>
          </>
        }
      >
        {linkState && (
          <form id="link-form" className="form-stack" onSubmit={submitLink}>
            <label>
              <span>URL</span>
              <input autoFocus value={linkState.href} onChange={(e) => setLinkState({ ...linkState, href: e.target.value })} placeholder="https://" />
            </label>
            {!linkState.hasSelection && !editor?.isActive('link') && (
              <label>
                <span>표시할 텍스트</span>
                <input
                  value={linkState.text}
                  onChange={(e) => setLinkState({ ...linkState, text: e.target.value })}
                  placeholder="비워 두면 URL이 표시돼요"
                />
              </label>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}
