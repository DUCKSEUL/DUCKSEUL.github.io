import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { flushSync } from 'react-dom'
import DOMPurify from 'dompurify'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import Lightbox from '../components/Lightbox.jsx'
import Modal from '../components/Modal.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { usePosts, formatDateTime } from '../lib/store.js'
import { removePost, deleteMessage } from '../lib/removePost.js'
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
  const [tocOpen, setTocOpen] = useState(false) // 모바일 바텀 시트
  const sideNavRef = useRef(null)
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

  // 목차가 길어 사이드 목차 안에서 스크롤될 때: 현재 항목이 보이도록 (창 스크롤은 건드리지 않음)
  useEffect(() => {
    const nav = sideNavRef.current
    const item = nav?.querySelector('.is-active')
    if (!nav || !item || nav.scrollHeight <= nav.clientHeight) return
    const top = item.offsetTop - nav.offsetTop
    if (top < nav.scrollTop + 24 || top > nav.scrollTop + nav.clientHeight - 48) nav.scrollTo({ top: top - nav.clientHeight / 3, behavior: 'smooth' })
  }, [active])

  // 바텀 시트: Esc로 닫기 · 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!tocOpen) return
    const onKey = (e) => e.key === 'Escape' && setTocOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [tocOpen])

  if (!post) return ready ? <NotFound /> : <div className="page" />

  const idx = posts.indexOf(post)
  const newer = posts[idx - 1]
  const older = posts[idx + 1]

  const activeItem = toc.find((t) => t.id === active)

  const go = (secId) => {
    // 바텀 시트를 먼저 닫아(배경 스크롤 잠금 해제) 레이아웃을 확정한 뒤 부드럽게 스크롤
    flushSync(() => setTocOpen(false))
    document.getElementById(secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onBodyClick = (e) => {
    const img = e.target.closest('img')
    if (!img || !bodyRef.current.contains(img)) return
    // 본문 안 모든 사진을 갤러리로 넘기고, 누른 사진의 순서에서 시작 (← → 로 이전·다음)
    const imgs = [...bodyRef.current.querySelectorAll('img')]
    const items = imgs.map((el) => ({
      src: el.currentSrc || el.src,
      alt: el.closest('figure')?.querySelector('figcaption')?.textContent || el.alt,
    }))
    setLightbox({ items, index: Math.max(0, imgs.indexOf(img)) })
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
    <article className={`page journal ${toc.length ? 'has-toc' : ''}`}>
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
              {isAdmin && (
                <>
                  <button className="btn btn-sm btn-naver" onClick={copyNaver} disabled={copying}>
                    <Icon name="copy" size={16} /> {copying ? '변환 중…' : '네이버 블로그용 복사'}
                  </button>
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
          /* 데스크톱(1200px 이상): 본문 오른쪽 여백에 따라오는 목차 (현재 섹션 강조) */
          <aside className="toc-side" aria-label="목차">
            <nav ref={sideNavRef}>
              <p className="toc-title">목차</p>
              <TocList toc={toc} active={active} onGo={go} />
            </nav>
          </aside>
        )}

        {isAdmin && post.source === 'private' && (
          <p className="private-note is-locked" role="note">
            <span className="lock-badge">🔒 나에게만 보기 (비공개)</span>
            <span>
              비공개 저장소에만 저장된 글이에요. 방문자에게는 목록에도 보이지 않아요.
              {post.hasPublic && ' (이전 공개본이 아직 남아 있어요)'}
            </span>
            <Link to={`/write/${post.id}`}>공개 전환 · 수정</Link>
          </p>
        )}
        {isAdmin && post.draft && post.source !== 'private' && (
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
              <span>
                <Icon name="chevronLeft" size={14} /> 이전 글 · {older.category || '연구 노트'}
              </span>
              <strong>{older.title}</strong>
              <small>{formatDateTime(older.createdAt, false)}</small>
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link to={`/journal/${newer.id}`} className="post-nav-item next">
              <span>
                {newer.category || '연구 노트'} · 다음 글 <Icon name="chevron" size={14} />
              </span>
              <strong>{newer.title}</strong>
              <small>{formatDateTime(newer.createdAt, false)}</small>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>

      {toc.length > 0 && (
        <>
          {/* 모바일·태블릿(1200px 미만): 오른쪽 아래 플로팅 알약 → 바텀 시트 목차 */}
          <button
            type="button"
            className="toc-pill"
            onClick={() => setTocOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={tocOpen}
            aria-label={`목차 열기${activeItem ? ` — 현재: ${activeItem.text}` : ''}`}
          >
            <Icon name="menu" size={16} />
            <span className="toc-pill-label">목차</span>
            {activeItem && <span className="toc-pill-cur">{activeItem.text}</span>}
          </button>
          {tocOpen && (
            <div className="toc-sheet-wrap" role="presentation" onClick={() => setTocOpen(false)}>
              <div className="toc-sheet" role="dialog" aria-modal="true" aria-label="목차" onClick={(e) => e.stopPropagation()}>
                <div className="toc-sheet-grip" aria-hidden />
                <div className="toc-sheet-head">
                  <strong>
                    목차 <em>{toc.length}</em>
                  </strong>
                  <button type="button" className="toc-sheet-close" onClick={() => setTocOpen(false)} aria-label="목차 닫기">
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <TocList toc={toc} active={active} onGo={go} />
              </div>
            </div>
          )}
        </>
      )}
      <BackToTop />
      <Lightbox
        items={lightbox?.items}
        index={lightbox?.index ?? 0}
        onIndex={(index) => setLightbox((lb) => (lb ? { ...lb, index } : lb))}
        onClose={() => setLightbox(null)}
      />

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
                const target = post
                navigate('/journal')
                await removePost(target)
              }}
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </>
        }
      >
        <p className="modal-text">{deleteMessage(post)}</p>
      </Modal>
    </article>
  )
}
