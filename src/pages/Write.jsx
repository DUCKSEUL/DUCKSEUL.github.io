import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { buildExtensions } from '../editor/extensions.js'
import Toolbar from '../editor/Toolbar.jsx'
import MathPopover from '../editor/MathPopover.jsx'
import TableToolbar from '../editor/TableToolbar.jsx'
import Modal from '../components/Modal.jsx'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import { usePosts, savePost, newId } from '../lib/store.js'
import { saveDraft, loadDraft, clearDraft, relativeTime } from '../lib/drafts.js'
import { fileToDataUrl, imageFiles } from '../lib/image.js'
import NotFound from './NotFound.jsx'

const AUTOSAVE_MS = 2000

export default function Write() {
  const { id } = useParams()
  const { posts, ready } = usePosts()
  if (id && !ready) return <div className="page" />
  const existing = id ? posts.find((p) => p.id === id) : null
  if (id && !existing) return <NotFound />
  return <EditorPage key={id || 'new'} initial={existing} categories={[...new Set(posts.map((p) => p.category).filter(Boolean))]} />
}

function SaveBadge({ savedAt, saving }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className={`save-badge ${savedAt ? 'is-saved' : ''}`} aria-live="polite">
      <span className={`dot ${saving ? 'is-saving' : ''}`} />
      {savedAt ? `${relativeTime(savedAt)} 임시저장됨` : '작성 중'}
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
  const fileRef = useRef(null)
  const editorRef = useRef(null)
  const dirty = useRef(false)
  const recoveryRef = useRef(null)
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
    content: initial?.html || '',
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
    onUpdate: () => {
      dirty.current = true
    },
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
    editorRef.current?.commands.setContent(d.html || '')
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
      if (e.code === 'Digit3') {
        e.preventDefault()
        e.stopPropagation()
        openMath()
      } else if (e.code === 'Digit1' || e.code === 'Digit2') {
        const sel = ed.state.selection
        if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
          e.preventDefault()
          e.stopPropagation()
          ed.chain().updateAttributes('image', { width: e.code === 'Digit1' ? '50%' : '33.3%' }).run()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const publish = async () => {
    if (!title.trim()) {
      toast('제목을 입력해 주세요.', 'error')
      document.getElementById('post-title')?.focus()
      return
    }
    try {
      await savePost({
        id: postId,
        title: title.trim(),
        category: category.trim() || '연구 노트',
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        createdAt: createdAt.current,
        updatedAt: new Date().toISOString(),
        draft: false,
        html: editor.getHTML(),
      })
      await clearDraft(draftKey)
      dirty.current = false
      toast(initial ? '수정했어요.' : '발행했어요! 이 브라우저에 저장되었어요.')
      navigate(`/journal/${postId}`)
    } catch {
      toast('저장 공간이 부족해 저장하지 못했어요. 백업 후 다시 시도해 주세요.', 'error')
    }
  }

  const counts = countChars(editor)

  return (
    <div className="write">
      <div className="write-bar">
        <div className="container write-bar-inner">
          <Link to={initial ? `/journal/${initial.id}` : '/journal'} className="back-link">
            <Icon name="chevronLeft" size={18} /> <span className="hide-sm">{initial ? '글로 돌아가기' : '연구 일지'}</span>
          </Link>
          <SaveBadge savedAt={savedAt} saving={saving} />
          <button className="btn btn-md btn-primary" onClick={publish}>
            {initial ? '수정 완료' : '발행하기'}
          </button>
        </div>
        <div className="toolbar-wrap">
          <Toolbar editor={editor} onMath={openMath} onLink={openLink} onImage={() => fileRef.current?.click()} />
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

      <div className="write-doc">
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
            {[...new Set(['연구 노트', '실험 기록', '논문 리뷰', '아이디어', ...categories])].map((c) => (
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
            <kbd>Ctrl</kbd>+<kbd>E</kbd>/<kbd>L</kbd>/<kbd>R</kbd> 정렬 · <kbd>Alt</kbd>+<kbd>1</kbd>/<kbd>2</kbd> 사진 크기 · <kbd>Alt</kbd>+<kbd>3</kbd> 수식
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
