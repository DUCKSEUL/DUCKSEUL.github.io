import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, useDocumentTitle } from '../components/ui.jsx'
import { usePosts, formatDateTime, postThumb } from '../lib/store.js'
import { profile, researchAreas, keywords, highlights, defaultTodos } from '../data/profile.js'

function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s ? JSON.parse(s) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  }, [key, v])
  return [v, setV]
}

function Widget({ area, title, icon, action, children, className = '' }) {
  return (
    <section className={`widget ${className}`} style={{ gridArea: area }} aria-label={title}>
      {title && (
        <header className="widget-head">
          <h2>
            {icon && <Icon name={icon} size={18} />} {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

function ProfileWidget() {
  return (
    <Widget area="profile" className="w-profile">
      <div className="avatar" aria-hidden>
        <Icon name="wave" size={34} />
      </div>
      <p className="status-pill">
        <span className="live" /> {profile.status}
      </p>
      <h1 className="w-name">{profile.name}</h1>
      <p className="w-aff">{profile.affiliation}</p>
      <p className="w-tagline">{profile.tagline}</p>
      <div className="w-links">
        {profile.email && (
          <a className="btn btn-md btn-weak" href={`mailto:${profile.email}`}>
            <Icon name="mail" size={18} /> 이메일
          </a>
        )}
        <a className="btn btn-md btn-dark" href={profile.github} target="_blank" rel="noreferrer">
          <Icon name="github" size={18} /> GitHub
        </a>
      </div>
    </Widget>
  )
}

function ResearchWidget() {
  return (
    <Widget area="research" title="연구 분야 & 관심 키워드" icon="antenna">
      <ul className="areas">
        {researchAreas.map((a, i) => (
          <li key={a.title}>
            <span className={`area-dot c${i}`} />
            <div>
              <strong>{a.title}</strong>
              <span>{a.desc}</span>
            </div>
          </li>
        ))}
      </ul>
      <ul className="kw">
        {keywords.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
    </Widget>
  )
}

function JournalWidget({ posts }) {
  const latest = posts.filter((p) => !p.draft).slice(0, 4)
  return (
    <Widget
      area="journal"
      title="최근 연구 일지"
      icon="book"
      action={
        <Link to="/journal" className="w-more">
          전체 보기 <Icon name="chevron" size={16} />
        </Link>
      }
    >
      {latest.length ? (
        <ul className="w-posts">
          {latest.map((p) => {
            const thumb = postThumb(p.html)
            return (
              <li key={p.id}>
                <Link to={`/journal/${p.id}`}>
                  <div>
                    <span className="w-post-cat">{p.category}</span>
                    <strong>{p.title}</strong>
                    <span className="w-post-date">{formatDateTime(p.createdAt, false)}</span>
                  </div>
                  {thumb && <img src={thumb} alt="" loading="lazy" />}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="w-empty">아직 일지가 없어요.</p>
      )}
      <Link to="/write" className="w-write">
        <Icon name="pen" size={16} /> 새 일지 쓰기
      </Link>
    </Widget>
  )
}

function HighlightsWidget() {
  return (
    <Widget area="projects" title="주요 프로젝트 · 논문" icon="spark">
      <ul className="w-hl">
        {highlights.map((h) => (
          <li key={h.title}>
            <a href={h.href} target="_blank" rel="noreferrer">
              <span className={`hl-type ${h.type === 'Paper' ? 'paper' : ''}`}>{h.type}</span>
              <div>
                <strong>{h.title}</strong>
                <span>{h.desc}</span>
              </div>
              <span className="hl-meta">{h.meta}</span>
            </a>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

function TodoWidget() {
  const [tab, setTab] = useState('todo')
  const [todos, setTodos] = useLocalState('dash-todos', defaultTodos)
  const [memo, setMemo] = useLocalState('dash-memo', '')
  const [text, setText] = useState('')
  const done = todos.filter((t) => t.done).length

  const add = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setTodos([...todos, { id: Date.now().toString(36), text: text.trim(), done: false }])
    setText('')
  }

  return (
    <Widget area="todo" className="w-todo">
      <header className="widget-head">
        <div className="mini-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'is-active' : ''} onClick={() => setTab('todo')}>
            진행 중인 작업
          </button>
          <button role="tab" aria-selected={tab === 'memo'} className={tab === 'memo' ? 'is-active' : ''} onClick={() => setTab('memo')}>
            빠른 메모
          </button>
        </div>
        {tab === 'todo' && (
          <span className="w-count">
            {done}/{todos.length}
          </span>
        )}
      </header>
      {tab === 'todo' ? (
        <>
          <div className="progress" aria-hidden>
            <span style={{ width: `${todos.length ? (done / todos.length) * 100 : 0}%` }} />
          </div>
          <ul className="todos">
            {todos.map((t) => (
              <li key={t.id} className={t.done ? 'is-done' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                  />
                  <span className="check" aria-hidden>
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                  <span className="todo-text">{t.text}</span>
                </label>
                <button className="todo-del" onClick={() => setTodos(todos.filter((x) => x.id !== t.id))} aria-label="삭제">
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form className="todo-add" onSubmit={add}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="할 일 추가" aria-label="할 일 추가" />
            <button type="submit" aria-label="추가">
              <Icon name="plus" size={18} />
            </button>
          </form>
        </>
      ) : (
        <textarea
          className="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="떠오른 아이디어를 바로 적어 두세요. 자동으로 저장돼요."
          aria-label="빠른 메모"
        />
      )}
      <p className="w-foot">이 브라우저에 자동 저장돼요</p>
    </Widget>
  )
}

function StatsWidget({ posts }) {
  const pub = posts.filter((p) => !p.draft)
  const now = new Date()
  const thisMonth = pub.filter((p) => {
    const d = new Date(p.createdAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const last = pub[0]
  return (
    <Widget area="stats" title="기록 현황" icon="chart" className="w-stats">
      <div className="stat-big">
        <strong>{pub.length}</strong>
        <span>전체 일지</span>
      </div>
      <dl className="stat-row">
        <div>
          <dt>이번 달</dt>
          <dd>{thisMonth}편</dd>
        </div>
        <div>
          <dt>마지막 기록</dt>
          <dd>{last ? formatDateTime(last.createdAt, false) : '-'}</dd>
        </div>
      </dl>
    </Widget>
  )
}

function QuickWidget({ posts }) {
  return (
    <Widget area="quick" title="바로가기" icon="arrowRight" className="w-quick">
      <div className="quick">
        <Link to="/write" className="quick-item blue">
          <Icon name="pen" size={20} />
          <span>새 일지</span>
        </Link>
        <Link to="/journal" className="quick-item purple">
          <Icon name="book" size={20} />
          <span>일지 목록</span>
        </Link>
        <button className="quick-item green" onClick={async () => (await import('../lib/exportImport.js')).exportJSON(posts)}>
          <Icon name="download" size={20} />
          <span>백업</span>
        </button>
        <a href={profile.github} target="_blank" rel="noreferrer" className="quick-item dark">
          <Icon name="github" size={20} />
          <span>GitHub</span>
        </a>
      </div>
    </Widget>
  )
}

export default function Dashboard() {
  useDocumentTitle(`${profile.name} · Research Dashboard`)
  const { posts } = usePosts()
  return (
    <div className="page dash-page">
      <div className="container">
        <div className="bento">
          <ProfileWidget />
          <JournalWidget posts={posts} />
          <ResearchWidget />
          <HighlightsWidget />
          <TodoWidget />
          <StatsWidget posts={posts} />
          <QuickWidget posts={posts} />
        </div>
      </div>
    </div>
  )
}
