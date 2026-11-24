import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { buildExtensions } from '../editor/extensions.js'
import Toolbar from '../editor/Toolbar.jsx'
import MathModal from '../editor/MathModal.jsx'
import Modal from '../components/Modal.jsx'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import { usePosts, savePost, newId, postText } from '../lib/store.js'
import { fileToDataUrl, imageFiles } from '../lib/image.js'
import NotFound from './NotFound.jsx'

export default function Write() {
  const { id } = useParams()
  const { posts, ready } = usePosts()
  if (id && !ready) return <div className="page" />
  const existing = id ? posts.find((p) => p.id === id) : null
  if (id && !existing) return <NotFound />
  return <EditorPage key={id || 'new'} initial={existing} categories={[...new Set(posts.map((p) => p.category).filter(Boolean))]} />
}

function EditorPage({ initial, categories }) {
  useDocumentTitle(initial ? `수정: ${initial.title} · 연구 일지` : '새 일지 쓰기 · 연구 일지')
  const navigate = useNavigate()
  const [postId] = useState(() => initial?.id || newId())
  const createdAt = useRef(initial?.createdAt || new Date().toISOString())
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || '연구 노트')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
  const [savedAt, setSavedAt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [mathState, setMathState] = useState(null)
  const [linkState, setLinkState] = useState(null)
  const fileRef = useRef(null)
  const editorRef = useRef(null)
  const draft = useRef(initial ? !!initial.draft : true)
  const timer = useRef(null)

  const onEditMath = useCallback((s) => setMathState(s), [])
  const extensions = useMemo(() => buildExtensions({ onEditMath: (s) => onEditMath(s) }), [onEditMath])

  const insertImages = useCallback(async (files, pos) => {
    const ed = editorRef.current
    if (!ed) return
    for (const f of files) {
      try {
        const src = await fileToDataUrl(f)
        const at = pos ?? ed.state.selection.from
        ed.chain().focus().insertContentAt(at, { type: 'image', attrs: { src, alt: f.name.replace(/\.[^.]+$/, '') } }).run()
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
    onUpdate: () => scheduleSave(),
  })
  editorRef.current = editor

  // ── 자동 저장 ─────────────────────────
  const doSave = useCallback(
    async (opts = {}) => {
      const ed = editorRef.current
      if (!ed) return
      const html = ed.getHTML()
      const empty = !title.trim() && !postText(html) && !/<img|data-latex/.test(html)
      if (empty && !opts.force) return
      setSaving(true)
      try {
        await savePost({
          id: postId,
          title: title.trim() || '제목 없음',
          category: category.trim() || '연구 노트',
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          createdAt: createdAt.current,
          updatedAt: new Date().toISOString(),
          draft: opts.draft ?? draft.current,
          html,
        })
        if (opts.draft !== undefined) draft.current = opts.draft
        setSavedAt(new Date())
      } catch {
        toast('저장 공간이 부족해 저장하지 못했어요. 내보내기로 백업해 주세요.', 'error')
      } finally {
        setSaving(false)
      }
    },
    [postId, title, category, tags],
  )
  const saveRef = useRef(doSave)
  saveRef.current = doSave

  function scheduleSave() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveRef.current(), 700)
  }
  useEffect(() => {
    if (editor) scheduleSave()
  }, [title, category, tags]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])

  // ── 단축키: Alt+1 (½), Alt+2 (⅓), Alt+3 (수식) ──
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const ed = editorRef.current
      if (!ed) return
      if (e.code === 'Digit3') {
        e.preventDefault()
        setMathState({ latex: '', display: false, pos: null })
      } else if (e.code === 'Digit1' || e.code === 'Digit2') {
        const sel = ed.state.selection
        if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
          e.preventDefault()
          ed.chain().updateAttributes('image', { width: e.code === 'Digit1' ? '50%' : '33.3%' }).run()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Ctrl+K: 링크
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && editorRef.current?.isFocused) {
        e.preventDefault()
        openLink()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

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
    clearTimeout(timer.current)
    if (!title.trim()) {
      toast('제목을 입력해 주세요.', 'error')
      document.getElementById('post-title')?.focus()
      return
    }
    await doSave({ draft: false, force: true })
    toast('발행했어요! 이 브라우저에 저장되었어요.')
    navigate(`/journal/${postId}`)
  }

  const status = saving ? '저장 중…' : savedAt ? `자동 저장됨 ${savedAt.toTimeString().slice(0, 5)}` : initial ? '수정 중' : '작성 중'

  return (
    <div className="write">
      <div className="write-bar">
        <div className="container write-bar-inner">
          <Link to={initial ? `/journal/${initial.id}` : '/journal'} className="back-link">
            <Icon name="chevronLeft" size={18} /> {initial ? '글로 돌아가기' : '연구 일지'}
          </Link>
          <span className="save-status" aria-live="polite">
            <span className={`dot ${saving ? 'is-saving' : ''}`} /> {status}
          </span>
          <button className="btn btn-md btn-primary" onClick={publish}>
            {initial && !initial.draft ? '수정 완료' : '발행하기'}
          </button>
        </div>
        <div className="toolbar-wrap">
          <Toolbar
            editor={editor}
            onMath={() => setMathState({ latex: '', display: false, pos: null })}
            onLink={openLink}
            onImage={() => fileRef.current?.click()}
          />
        </div>
      </div>

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
          <input
            className="meta-input grow"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            aria-label="태그"
            placeholder="태그 (쉼표로 구분)"
          />
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
        <p className="write-help">
          <kbd>Alt</kbd>+<kbd>1</kbd> 사진 ½ · <kbd>Alt</kbd>+<kbd>2</kbd> 사진 ⅓ · <kbd>Alt</kbd>+<kbd>3</kbd> 수식 입력 · 수식 더블클릭으로 수정
        </p>
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

      <MathModal state={mathState} onClose={() => setMathState(null)} onSubmit={submitMath} />

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
              <input
                autoFocus
                value={linkState.href}
                onChange={(e) => setLinkState({ ...linkState, href: e.target.value })}
                placeholder="https://"
              />
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
