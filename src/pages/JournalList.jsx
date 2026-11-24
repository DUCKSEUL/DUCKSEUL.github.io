import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import PostListItem from '../components/PostListItem.jsx'
import Modal from '../components/Modal.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { usePosts, importPosts } from '../lib/store.js'
import { profile } from '../data/profile.js'

const ALL = '전체'
const io = () => import('../lib/exportImport.js')

export default function JournalList() {
  useDocumentTitle(`연구 일지 · ${profile.name}`)
  const { posts } = usePosts()
  const [params, setParams] = useSearchParams()
  const cat = params.get('category') || ALL
  const [backupOpen, setBackupOpen] = useState(false)
  const fileRef = useRef(null)

  const categories = [...new Set(posts.map((p) => p.category || '연구 노트'))]
  const list = cat === ALL ? posts : posts.filter((p) => (p.category || '연구 노트') === cat)
  const localCount = posts.filter((p) => p.source !== 'published').length

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
              전체 {posts.length}개의 글{localCount > 0 && ` · 이 브라우저에 저장된 글 ${localCount}개`}
            </p>
          </div>
          <div className="journal-actions">
            <button className="btn btn-md btn-ghost" onClick={() => setBackupOpen(true)}>
              <Icon name="download" size={18} /> 백업
            </button>
            <Link className="btn btn-md btn-primary" to="/write">
              <Icon name="pen" size={18} /> 글쓰기
            </Link>
          </div>
        </header>

        <nav className="cat-tabs" aria-label="카테고리">
          {[ALL, ...categories].map((c) => (
            <button
              key={c}
              className={c === cat ? 'is-active' : ''}
              aria-pressed={c === cat}
              onClick={() => setParams(c === ALL ? {} : { category: c })}
            >
              {c}
              <span>{c === ALL ? posts.length : posts.filter((p) => (p.category || '연구 노트') === c).length}</span>
            </button>
          ))}
        </nav>

        {list.length ? (
          <div className="post-items">
            {list.map((p) => (
              <PostListItem key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>아직 글이 없어요.</p>
            <Link className="btn btn-md btn-weak" to="/write">
              첫 일지 쓰기
            </Link>
          </div>
        )}
      </div>

      <BackToTop />
      <Modal open={backupOpen} title="일지 백업 · 불러오기" onClose={() => setBackupOpen(false)} width={520}>
        <div className="backup">
          <p className="backup-note">
            글은 이 브라우저에 자동 저장돼요. 브라우저 데이터를 지우면 사라질 수 있으니 주기적으로 내보내 주세요.
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
            <span>같은 id의 글은 덮어쓰고, 새 글은 추가돼요</span>
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
          <button className="backup-btn wide" onClick={async () => (await io()).exportPublishJSON(posts)}>
            <Icon name="upload" size={20} />
            <strong>게시용 journal.json 받기</strong>
            <span>
              받은 파일로 저장소의 <code>src/data/journal.json</code>을 교체하고 push하면 사이트에 공개돼요.
            </span>
          </button>
        </div>
      </Modal>
    </section>
  )
}
