import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import PostListItem from '../components/PostListItem.jsx'
import Modal from '../components/Modal.jsx'
import BackToTop from '../components/BackToTop.jsx'
import PrivateRepoPanel from '../components/PrivateRepoPanel.jsx'
import { usePosts, importPosts, getPendingChanges, markSynced, postText } from '../lib/store.js'
import { removePost, deleteMessage } from '../lib/removePost.js'
import { useAdmin } from '../lib/admin.js'
import { profile } from '../data/profile.js'
import { JOURNAL_CATS as DEFAULT_CATS } from '../lib/labels.js'

const ALL = '전체'

const io = () => import('../lib/exportImport.js')

export default function JournalList() {
  useDocumentTitle(`연구 일지 · ${profile.name}`)
  const { posts } = usePosts()
  const [params, setParams] = useSearchParams()
  const cat = params.get('category') || ALL
  const [backupOpen, setBackupOpen] = useState(false)
  const fileRef = useRef(null)
  const { isAdmin } = useAdmin()
  const [publishing, setPublishing] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const pending = isAdmin ? getPendingChanges() : { upserts: [], deletes: [] }
  const pendingCount = pending.upserts.length + pending.deletes.length

  const [q, setQ] = useState('')
  const catOf = (p) => p.category || '연구 노트'
  const categories = [...new Set([...DEFAULT_CATS, ...posts.map(catOf)])]
  const needle = q.trim().toLowerCase()
  const texts = useMemo(() => new Map(posts.map((p) => [p.id, [p.title, catOf(p), (p.tags || []).join(' '), postText(p.html || '')].join(' ').toLowerCase()])), [posts])
  const matched = needle ? posts.filter((p) => needle.split(/\s+/).every((w) => texts.get(p.id)?.includes(w))) : posts
  const list = cat === ALL ? matched : matched.filter((p) => catOf(p) === cat)
  const syncingCount = posts.filter((p) => p.source === 'syncing').length

  const publishAll = async () => {
    setPublishing(true)
    try {
      const { publishChanges } = await import('../lib/publish.js')
      const res = await publishChanges(pending)
      await markSynced([...pending.upserts.map((p) => p.id), ...pending.deletes])
      toast(`GitHub에 ${pendingCount}건을 발행했어요${res.uploaded ? ` (사진 ${res.uploaded}장)` : ''}. 1~2분 뒤 반영돼요.`)
      setBackupOpen(false)
    } catch (e) {
      toast(`GitHub 발행 실패: ${e.message}`, 'error')
    } finally {
      setPublishing(false)
    }
  }

  const onImport = async (file) => {
    try {
      const items = await (await io()).readImportFile(file)
      const n = await importPosts(items)
      toast(`${n}개의 일지를 불러왔어요.`)
      setBackupOpen(false)
    } catch (e) {
      toast(`불러오기 실패: ${e.message}`, 'error')
    }
  }

  return (
    <section className="page journal">
      <div className="journal-col">
        <header className="journal-head">
          <div>
            <p className="eyebrow">Research Journal</p>
            <h1 className="page-title">연구 일지</h1>
            <p className="page-sub">
              전체 {posts.length}개의 글{isAdmin && syncingCount > 0 && ` · 배포 대기 ${syncingCount}개`}
            </p>
          </div>
          {isAdmin && (
            <div className="journal-actions">
              <button className="btn btn-md btn-ghost" onClick={() => setBackupOpen(true)}>
                <Icon name="download" size={18} /> 백업 · 불러오기
              </button>
              <Link className="btn btn-md btn-primary" to="/write">
                <Icon name="pen" size={18} /> 글쓰기
              </Link>
            </div>
          )}
        </header>

        {isAdmin && <PrivateRepoPanel />}

        {pendingCount > 0 && (
          <div className="publish-bar" role="status">
            <p>
              GitHub에 아직 발행하지 않은 변경사항 <strong>{pendingCount}건</strong>이 이 브라우저에 있어요.
            </p>
            <button className="btn btn-sm btn-primary" onClick={publishAll} disabled={publishing}>
              <Icon name="upload" size={16} /> {publishing ? '발행 중…' : '모두 발행'}
            </button>
          </div>
        )}

        <div className="journal-filter">
          <div className="radar-search journal-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·본문·태그 검색" aria-label="연구 일지 검색" />
            {q && (
              <button onClick={() => setQ('')} aria-label="검색어 지우기">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <nav className="cat-tabs" aria-label="카테고리">
            {[ALL, ...categories].map((c) => {
              const n = c === ALL ? matched.length : matched.filter((p) => catOf(p) === c).length
              return (
                <button
                  key={c}
                  className={`${c === cat ? 'is-active' : ''} ${n ? '' : 'is-zero'}`}
                  aria-pressed={c === cat}
                  onClick={() => setParams(c === ALL ? {} : { category: c })}
                >
                  {c}
                  <span>{n}</span>
                </button>
              )
            })}
          </nav>
          {needle && (
            <p className="radar-count">
              「{q.trim()}」 검색 결과 {list.length}개
              <button className="link-btn" onClick={() => setQ('')}>
                검색 지우기
              </button>
            </p>
          )}
        </div>

        {list.length ? (
          <div className="post-items">
            {list.map((p) => (
              <PostListItem key={p.id} post={p} onDelete={isAdmin ? setToDelete : undefined} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>{needle ? '검색 결과가 없어요.' : cat !== ALL ? `「${cat}」 카테고리에 아직 글이 없어요.` : '아직 글이 없어요.'}</p>
            {isAdmin && (
              <Link className="btn btn-md btn-weak" to="/write">
                첫 일지 쓰기
              </Link>
            )}
          </div>
        )}
      </div>

      <BackToTop />
      <Modal
        open={isAdmin && !!toDelete}
        title="이 글을 삭제할까요?"
        onClose={() => setToDelete(null)}
        width={420}
        footer={
          <>
            <button className="btn btn-md btn-ghost" onClick={() => setToDelete(null)}>
              취소
            </button>
            <button
              className="btn btn-md btn-danger"
              autoFocus
              onClick={() => {
                const target = toDelete
                setToDelete(null)
                removePost(target)
              }}
            >
              삭제
            </button>
          </>
        }
      >
        {toDelete && (
          <>
            <p className="modal-text">
              <strong>「{toDelete.title}」</strong>
            </p>
            <p className="modal-text">{deleteMessage(toDelete)}</p>
          </>
        )}
      </Modal>
      <Modal open={isAdmin && backupOpen} title="일지 백업 · 불러오기" onClose={() => setBackupOpen(false)} width={520}>
        <div className="backup">
          <p className="backup-note">
            공개 글은 GitHub 저장소(<code>public/data/posts.json</code>)에 있어요. 발행 전 글은 이 브라우저에만 있으니 주기적으로 내보내 주세요.
          </p>
          <h3>내보내기</h3>
          <div className="backup-grid">
            <button className="backup-btn" onClick={async () => (await io()).exportJSON(posts)}>
              <Icon name="download" size={20} />
              <strong>JSON으로 내보내기</strong>
              <span>서식·사진·수식을 모두 보존하는 전체 백업</span>
            </button>
            <button className="backup-btn" onClick={async () => (await io()).exportMarkdown(posts)}>
              <Icon name="note" size={20} />
              <strong>Markdown으로 내보내기</strong>
              <span>다른 도구에서 읽기 좋은 텍스트 (글꼴·색상 제외)</span>
            </button>
          </div>
          <h3>불러오기</h3>
          <button className="backup-btn wide" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={20} />
            <strong>JSON / Markdown 파일 불러오기</strong>
            <span>같은 id의 글은 덮어쓰고, 새 글은 추가돼요. 불러온 뒤 「모두 발행」으로 공개해요</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.md,.markdown,application/json,text/markdown"
            hidden
            onChange={(e) => {
              const f = e.target.files[0]
              e.target.value = ''
              if (f) onImport(f)
            }}
          />
          <h3>모든 방문자에게 공개하기</h3>
          <button className="backup-btn wide" onClick={publishAll} disabled={!pendingCount || publishing}>
            <Icon name="upload" size={20} />
            <strong>{publishing ? '발행 중…' : `변경사항 ${pendingCount}건 GitHub에 발행`}</strong>
            <span>
              <code>public/data/posts.json</code>과 사진을 저장소에 커밋하면 GitHub Actions가 사이트를 다시 배포해요.
            </span>
          </button>
        </div>
      </Modal>
    </section>
  )
}
