import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon, useDocumentTitle } from '../components/ui.jsx'
import { usePosts, formatDateTime, postThumb } from '../lib/store.js'
import { useAdmin } from '../lib/admin.js'
import { useSiteData } from '../lib/siteData.js'
import { useEvents, eventsOn } from '../lib/useEvents.js'
import { ymd } from '../lib/google.js'
import { pubType, eventType, dday, safeUrl } from '../lib/labels.js'
import { useRadarPapers, useSortedPapers, groupByDate, fmtGroupDate, BANDS } from '../lib/sheets.js'
import { ProfileLinks } from './About.jsx'
import { PubLinks } from './Publications.jsx'

function Widget({ area, title, icon, to, children, className = '' }) {
  return (
    <section className={`widget ${className}`} style={{ gridArea: area }} aria-label={title}>
      {title && (
        <header className="widget-head">
          <h2>
            {icon && <Icon name={icon} size={18} />} {title}
          </h2>
          {to && (
            <Link to={to} className="w-more">
              전체 보기 <Icon name="chevron" size={16} />
            </Link>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

/* 1행 좌: 내 소개 */
function ProfileWidget() {
  const { data: a } = useSiteData('about')
  return (
    <Widget area="profile" title="내 소개" icon="user" to="/about" className="w-profile">
      {a ? (
        <>
          <div className="w-profile-top">
            <div className="avatar" aria-hidden>
              <Icon name="wave" size={30} />
            </div>
            <div>
              <h1 className="w-name">{a.name}</h1>
              <p className="w-aff">{a.affiliation}</p>
            </div>
          </div>
          {a.status && (
            <p className="status-pill">
              <span className="live" /> {a.status}
            </p>
          )}
          {a.tagline && <p className="w-tagline">{a.tagline}</p>}
          {a.areas?.length > 0 && (
            <ul className="kw">
              {a.areas.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
          <ProfileLinks about={a} />
        </>
      ) : (
        <div className="w-skel" />
      )}
    </Widget>
  )
}

/* 1행 우: 연구 실적 하이라이트 */
function PubWidget() {
  const { data } = useSiteData('publications')
  const items = data?.items || []
  const list = [...items.filter((i) => i.highlight), ...items.filter((i) => !i.highlight)].slice(0, 4)
  const counts = ['journal', 'conference', 'patent', 'project'].map((t) => [pubType(t).label, items.filter((i) => i.type === t).length])
  return (
    <Widget area="pubs" title="연구 실적" icon="award" to="/publications">
      <dl className="w-pub-counts">
        {counts.map(([l, n]) => (
          <div key={l}>
            <dt>{l}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      {list.length ? (
        <ul className="w-pubs">
          {list.map((i) => {
            const t = pubType(i.type)
            return (
              <li key={i.id}>
                <span className={`pub-badge t-${t.value}`}>{t.label}</span>
                <div>
                  <strong>{i.title}</strong>
                  <span>{[i.description || i.venue, i.year].filter(Boolean).join(' · ')}</span>
                </div>
                <PubLinks item={i} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="w-empty">아직 등록된 실적이 없어요.</p>
      )}
    </Widget>
  )
}

/* 2행 전체: 캘린더 (이번 주 타임라인 + 다가오는 일정 D-Day) */
function CalendarWidget() {
  const today = ymd(new Date())
  const { weekStart, weekEnd, upTo } = useMemo(() => {
    const d = new Date()
    const mondayOffset = (d.getDay() + 6) % 7
    const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset)
    return {
      weekStart: ws,
      weekEnd: new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6),
      upTo: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 60),
    }
  }, [])
  const week = useEvents(weekStart, weekEnd)
  const up = useEvents(new Date(new Date().setHours(0, 0, 0, 0)), upTo)
  const upcoming = up.events.filter((e) => (e.endDate || e.date) >= today).slice(0, 5)
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i))
  const now = new Date()

  return (
    <Widget area="cal" title="캘린더" icon="calendar" to="/calendar" className="w-cal">
      <div className="w-cal-body">
        <div className="w-week">
          <p className="w-cal-label">
            {now.getMonth() + 1}월 · 이번 주
            {week.google.enabled && <span className="ev-private"> · Google 일정 포함 (나만 보임)</span>}
          </p>
          <ol className="week-strip">
            {days.map((d, i) => {
              const k = ymd(d)
              const evs = eventsOn(week.events, k)
              return (
                <li key={k} className={`${k === today ? 'is-today' : ''} ${k < today ? 'is-past' : ''}`}>
                  <span className={`wd ${i === 6 ? 'sun' : i === 5 ? 'sat' : ''}`}>{'월화수목금토일'[i]}</span>
                  <span className="dn">{d.getDate()}</span>
                  <ul className="day-evs">
                    {evs.slice(0, 2).map((e) => (
                      <li key={e.id} className={`ev-${eventType(e.type).value}`} title={e.title}>
                        {e.time && <b>{e.time}</b>} {e.title}
                      </li>
                    ))}
                    {evs.length > 2 && <li className="more">+{evs.length - 2}</li>}
                  </ul>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="w-upcoming">
          <p className="w-cal-label">다가오는 일정</p>
          {upcoming.length ? (
            <ul>
              {upcoming.map((e) => {
                const t = eventType(e.type)
                const url = safeUrl(e.url)
                return (
                  <li key={e.id}>
                    <span className={`dday ${dday(e.date) === 'D-Day' ? 'is-today' : ''}`}>{dday(e.date)}</span>
                    <div>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          {e.title}
                        </a>
                      ) : (
                        <strong>{e.title}</strong>
                      )}
                      <span>
                        <em className={`ev-tag ev-${t.value}`}>{t.label}</em> {e.date.slice(5).replace('-', '.')}
                        {e.time && ` ${e.time}`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="w-empty">앞으로 60일 동안 예정된 일정이 없어요.</p>
          )}
        </div>
      </div>
    </Widget>
  )
}

/* 3행 좌: 최근 연구 일지 */
function JournalWidget() {
  const { isAdmin } = useAdmin()
  const { posts } = usePosts()
  const latest = posts.filter((p) => !p.draft || p.source === 'modified').slice(0, 4)
  return (
    <Widget area="journal" title="최근 연구 일지" icon="book" to="/journal">
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
      {isAdmin && (
        <Link to="/write" className="w-write">
          <Icon name="pen" size={16} /> 새 일지 쓰기
        </Link>
      )}
    </Widget>
  )
}

/* 3행 우: 논문 레이더 (Google Sheets · 최신 기록순 상위 4건) */
function RadarWidget() {
  const { data: radar, ready } = useSiteData('radar')
  const sheet = useRadarPapers(radar, ready)
  const list = useSortedPapers(sheet.data, 'newest').slice(0, 4)
  const groups = groupByDate(list)
  return (
    <Widget area="radar" title="논문 레이더" icon="radar" to="/radar">
      {sheet.sample && <p className="w-sample">샘플 데이터 · Google Sheets 연결 전</p>}
      {sheet.loading && !sheet.data ? (
        <div className="w-skel" />
      ) : !sheet.data ? (
        <p className="w-empty">{sheet.isAdmin && sheet.error ? sheet.error : '논문 목록을 준비하고 있어요.'}</p>
      ) : list.length ? (
        <div className="w-paper-groups">
          {groups.map((g) => (
            <section key={g.date || 'none'} className="w-paper-group">
              <h3 className="w-date-head">
                <time dateTime={g.date || undefined}>{fmtGroupDate(g.date)}</time>
                <span>{g.papers.length}편</span>
              </h3>
              <ol className="w-papers">
                {g.papers.map((p) => (
                  <WidgetPaper key={p.id} p={p} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="w-empty">시트에 논문이 없어요.</p>
      )}
    </Widget>
  )
}

function WidgetPaper({ p }) {
  return (
            <li>
              <a href={p.link || undefined} target="_blank" rel="noreferrer" className={p.link ? '' : 'no-link'}>
                {(p.important || p.bands.length > 0 || p.methods.length > 0) && (
                  <span className="w-paper-meta">
                    {p.important && <em className="hl-badge">★ 중요</em>}
                    {p.bands.slice(0, 2).map((b) => (
                      <span key={b} className={`spec-band band-${b}`}>
                        {BANDS.find((x) => x.key === b)?.label}
                      </span>
                    ))}
                    {p.methods.slice(0, 2).map((m) => (
                      <span key={m} className="spec-cem">
                        {m}
                      </span>
                    ))}
                  </span>
                )}
                <strong>
                  {p.title}
                  {p.link && <Icon name="external" size={12} />}
                </strong>
                {(p.venue || p.year) && (
                  <span className="paper-venue">
                    {p.venue && <span className="venue-badge">{p.venue}</span>}
                    {p.year && <span className="year-badge">{p.year}</span>}
                  </span>
                )}
                {p.tags.length > 0 && (
                  <span className="w-paper-tags">
                    {p.tags.slice(0, 3).map((t) => (
                      <em key={t}>#{t}</em>
                    ))}
                  </span>
                )}
              </a>
            </li>
  )
}

export default function Dashboard() {
  const { data: a } = useSiteData('about')
  useDocumentTitle(`${a?.name || 'DUCKSEUL'} · Research Dashboard`)
  return (
    <div className="page dash-page">
      <div className="container">
        <div className="bento bento-v3">
          <ProfileWidget />
          <PubWidget />
          <CalendarWidget />
          <JournalWidget />
          <RadarWidget />
        </div>
      </div>
    </div>
  )
}
