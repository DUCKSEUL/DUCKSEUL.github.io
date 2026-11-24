import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import Lightbox from '../components/Lightbox.jsx'
import Modal from '../components/Modal.jsx'
import { usePosts, deletePost, formatDateTime } from '../lib/store.js'
import { renderMathIn } from '../lib/math.js'
import NotFound from './NotFound.jsx'

export default function JournalPost() {
  const { id } = useParams()
  const { posts, ready } = usePosts()
  const navigate = useNavigate()
  const post = posts.find((p) => p.id === id)
  const bodyRef = useRef(null)
  const [lightbox, setLightbox] = useState(null)
  const [copying, setCopying] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  useDocumentTitle(post ? `${post.title} · 연구 일지` : '연구 일지')

  const html = useMemo(
    () => (post ? DOMPurify.sanitize(post.html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'script'] }) : ''),
    [post],
  )

  useEffect(() => {
    renderMathIn(bodyRef.current)
  }, [html])

  if (!post) return ready ? <NotFound /> : <div className="page" />

  const idx = posts.indexOf(post)
  const newer = posts[idx - 1]
  const older = posts[idx + 1]

  const onBodyClick = (e) => {
    const img = e.target.closest('img')
    if (img && bodyRef.current.contains(img)) setLightbox({ src: img.currentSrc || img.src, alt: img.alt })
  }

  const copyNaver = async () => {
    setCopying(true)
    try {
      const { buildNaverHtml, copyRichHtml } = await import('../lib/naverCopy.js')
      const out = await buildNaverHtml(bodyRef.current)
      await copyRichHtml(out)
      toast('복사했어요! 네이버 블로그 글쓰기 창에 Ctrl+V로 붙여넣으세요.')
    } catch (e) {
      console.warn(e)
      toast('복사하지 못했어요. 다시 시도해 주세요.', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <article className="page journal">
      <div className="journal-col">
        <Link to="/journal" className="back-link">
          <Icon name="chevronLeft" size={18} /> 연구 일지 목록
        </Link>

        <header className="post-head">
          <Link to={`/journal?category=${encodeURIComponent(post.category || '연구 노트')}`} className="post-cat">
            {post.category || '연구 노트'}
          </Link>
          <h1>{post.title}</h1>
          <div className="post-head-row">
            <p className="post-date">
              <strong>{post.source === 'published' ? 'DUCKSEUL' : '나'}</strong>
              <span>{formatDateTime(post.createdAt)}</span>
              {post.updatedAt && post.updatedAt !== post.createdAt && <span>· 수정 {formatDateTime(post.updatedAt)}</span>}
              {post.draft && <em className="badge warn">임시저장</em>}
            </p>
            <div className="post-actions">
              <button className="btn btn-sm btn-naver" onClick={copyNaver} disabled={copying}>
                <Icon name="copy" size={16} /> {copying ? '변환 중…' : '네이버 블로그용 복사'}
              </button>
              <Link className="btn btn-sm btn-ghost" to={`/write/${post.id}`}>
                <Icon name="pen" size={16} /> 수정
              </Link>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(true)} aria-label="삭제">
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
          {post.tags?.length > 0 && (
            <ul className="post-tags">
              {post.tags.map((t) => (
                <li key={t}>#{t}</li>
              ))}
            </ul>
          )}
        </header>

        <div ref={bodyRef} className="prose post-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />

        <nav className="post-nav" aria-label="다른 일지">
          {older ? (
            <Link to={`/journal/${older.id}`} className="post-nav-item">
              <span>이전 글</span>
              <strong>{older.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link to={`/journal/${newer.id}`} className="post-nav-item next">
              <span>다음 글</span>
              <strong>{newer.title}</strong>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>

      <Lightbox src={lightbox?.src} alt={lightbox?.alt} onClose={() => setLightbox(null)} />

      <Modal
        open={confirmDel}
        title="이 글을 삭제할까요?"
        onClose={() => setConfirmDel(false)}
        width={420}
        footer={
          <>
            <button className="btn btn-md btn-ghost" onClick={() => setConfirmDel(false)}>
              취소
            </button>
            <button
              className="btn btn-md btn-danger"
              onClick={async () => {
                await deletePost(post.id)
                toast('삭제했어요.')
                navigate('/journal')
              }}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="modal-text">
          {post.source === 'local'
            ? '이 브라우저에 저장된 글이 삭제돼요. 되돌릴 수 없어요.'
            : '공개된 글은 이 브라우저에서만 숨겨져요. 완전히 지우려면 저장소의 journal.json에서 제거해 주세요.'}
        </p>
      </Modal>
    </article>
  )
}
