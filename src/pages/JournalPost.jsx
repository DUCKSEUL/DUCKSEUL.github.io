import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { flushSync } from 'react-dom'
import DOMPurify from 'dompurify'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import Lightbox from '../components/Lightbox.jsx'
import Modal from '../components/Modal.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { usePosts, deletePost, markSynced, formatDateTime } from '../lib/store.js'
import { useAdmin } from '../lib/admin.js'
import { renderMathIn } from '../lib/math.js'
import NotFound from './NotFound.jsx'

function TocList({ toc, active, onGo }) {
  return (
    <ol className="toc-list">
      {toc.map((t) => (
        <li key={t.id} className={`lv${t.level} ${active === t.id ? 'is-active' : ''}`}>
          <a
            href={`#${t.id}`}
            onClick={(e) => {
              e.preventDefault()
              onGo(t.id)
            }}
          >
            {t.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

export default function JournalPost() {
  const { id } = useParams()
  const { posts, ready } = usePosts()
  const navigate = useNavigate()
  const post = posts.find((p) => p.id === id)
  const bodyRef = useRef(null)
  const [lightbox, setLightbox] = useState(null)
  const [copying, setCopying] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { isAdmin } = useAdmin()
  const [toc, setToc] = useState([])
  const [active, setActive] = useState(null)
  const [tocOpen, setTocOpen] = useState(false)
  useDocumentTitle(post ? `${post.title} · 연구 일지` : '연구 일지')

  const html = useMemo(
    () => (post ? DOMPurify.sanitize(post.html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'script'] }) : ''),
    [post],
  )

  // 수식 렌더링 + 소제목(H2, H3)으로 목차 생성
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    renderMathIn(body)
    const hs = [...body.querySelectorAll('h2, h3')].filter((h) => h.textContent.trim())
    hs.forEach((h, i) => (h.id = `sec-${i + 1}`))
    setToc(hs.map((h) => ({ id: h.id, text: h.textContent.trim(), level: h.tagName === 'H2' ? 2 : 3 })))
  }, [html])

  // 현재 읽는 섹션 강조
  useEffect(() => {
    if (!toc.length) return
    const onScroll = () => {
      let cur = toc[0].id
      for (const t of toc) {
        const el = document.getElementById(t.id)
        if (el && el.getBoundingClientRect().top < 140) cur = t.id
      }
      setActive(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [toc])

  if (!post) return ready ? <NotFound /> : <div className="page" />

  const idx = posts.indexOf(post)
  const newer = posts[idx - 1]
  const older = posts[idx + 1]

  const go = (secId) => {
    // 접이식 목차를 먼저 닫아 레이아웃을 확정한 뒤 스크롤 (닫히면서 위치가 밀리지 않도록)
    flushSync(() => setTocOpen(false))
    document.getElementById(secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onBodyClick = (e) => {
    const img = e.target.closest('img')
    if (!img || !bodyRef.current.contains(img)) return
    const cap = img.closest('figure')?.querySelector('figcaption')?.textContent
    setLightbox({ src: img.currentSrc || img.src, alt: cap || img.alt })
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
      <div className="journal-col post-col">
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
              <strong>DUCKSEUL</strong>
              <span>{formatDateTime(post.createdAt)}</span>
              {post.updatedAt && post.updatedAt !== post.createdAt && <span>· 수정 {formatDateTime(post.updatedAt)}</span>}
            </p>
            <div className="post-actions">
              <button className="btn btn-sm btn-naver" onClick={copyNaver} disabled={copying}>
                <Icon name="copy" size={16} /> {copying ? '변환 중…' : '네이버 블로그용 복사'}
              </button>
              {isAdmin && (
                <>
                  <Link className="btn btn-sm btn-ghost" to={`/write/${post.id}`}>
                    <Icon name="pen" size={16} /> 수정
                  </Link>
                  <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(true)} aria-label="삭제">
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
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

        {toc.length > 0 && (
          <>
            {/* 넓은 화면: 본문 오른쪽 바깥 여백에 고정 목차 */}
            <aside className="toc-side" aria-label="목차">
              <nav>
                <p className="toc-title">목차</p>
                <TocList toc={toc} active={active} onGo={go} />
              </nav>
            </aside>
            {/* 좁은 화면: 본문 상단 접이식 목차 */}
            <div className={`toc-box ${tocOpen ? 'is-open' : ''}`}>
              <button className="toc-toggle" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen}>
                <span>
                  <Icon name="menu" size={16} /> 목차 <em>{toc.length}</em>
                </span>
                <Icon name="chevronDown" size={18} />
              </button>
              {tocOpen && <TocList toc={toc} active={active} onGo={go} />}
            </div>
          </>
        )}

        {isAdmin && post.draft && (
          <p className="private-note" role="note">
            <Icon name="note" size={18} />
            {post.source === 'modified'
              ? '나만 보이는 수정본이에요. 방문자에게는 이전에 발행한 내용이 보여요.'
              : '나만 보이는 글이에요. 아직 방문자에게 공개되지 않았어요.'}
            <Link to={`/write/${post.id}`}>발행하러 가기</Link>
          </p>
        )}

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

      <BackToTop />
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
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                const { id, title } = post
                const wasPublished = await deletePost(id)
                navigate('/journal')
                if (!wasPublished) return toast('삭제했어요.')
                toast('GitHub에 삭제를 반영하는 중…')
                try {
                  const { publishChanges } = await import('../lib/publish.js')
                  await publishChanges({ deletes: [id], message: `journal: 「${title}」 삭제` })
                  await markSynced([id])
                  toast('GitHub에서 삭제했어요. 1~2분 뒤 사이트에 반영돼요.')
                } catch (e) {
                  toast(`GitHub 반영 실패: ${e.message} — 목록에서 다시 발행할 수 있어요.`, 'error')
                }
              }}
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </>
        }
      >
        <p className="modal-text">
          {post.source === 'local'
            ? '아직 발행하지 않은 글이에요. 이 브라우저에서 삭제되고 되돌릴 수 없어요.'
            : 'GitHub 저장소의 posts.json에서 이 글을 지우는 커밋을 올려요. 배포가 끝나면 모든 방문자에게서 사라져요.'}
        </p>
      </Modal>
    </article>
  )
}
