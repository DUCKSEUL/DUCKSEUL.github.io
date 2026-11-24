import { useMemo, useState } from 'react'
import { Icon, useDocumentTitle } from '../components/ui.jsx'
import RadarSettings from '../components/RadarSettings.jsx'
import { useAdmin } from '../lib/admin.js'
import { useSiteData } from '../lib/siteData.js'
import { useRadarPapers, useSortedPapers } from '../lib/sheets.js'

const statusTone = (s) => (/읽음$|완료|done|^read$/i.test(s) ? 'done' : /읽는|진행|reading/i.test(s) ? 'doing' : s ? 'todo' : '')
const fmt = (d) => (d ? d.replace(/-/g, '.') : '')
const MODE_LABEL = { sample: '샘플 데이터', gviz: 'Google Sheets (링크 공유)', apikey: 'Google Sheets API · API Key', oauth: 'Google Sheets API · OAuth (비공개)' }

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}
function writePref(key, v) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* ignore */
  }
}

export function SheetGuide() {
  return (
    <div className="sheet-guide">
      <h3>
        <Icon name="table" size={18} /> Google Sheets 연결 가이드
      </h3>
      <ol>
        <li>
          첫 행에 헤더를 적어 주세요: <code>기록일</code> <code>제목</code> <code>저자</code> <code>저널/학회</code> <code>발행연도</code> <code>키워드/태그</code>{' '}
          <code>한줄요약</code> <code>DOI/원문 링크</code> <code>중요도</code> <code>읽음상태</code> — 이름·순서가 달라도 설정에서 매핑할 수 있어요.
        </li>
        <li>
          새 논문은 <b>아래 행에 계속 추가</b>하고 <b>기록일(YYYY-MM-DD)</b>을 적으면, 웹사이트에서는 자동으로 <b>최신 기록이 맨 위</b>로 정렬돼요.
        </li>
        <li>
          공유 방식 선택: 공개해도 되면 <b>「링크가 있는 모든 사용자 · 뷰어」</b>(키 불필요) 또는 <b>제한된 API Key</b>, 비공개로 두려면 <b>OAuth</b>(관리자만 열람).
        </li>
      </ol>
    </div>
  )
}

function ChipGroup({ label, items, value, onChange }) {
  if (!items.length) return null
  return (
    <div className="chip-group" role="group" aria-label={`${label} 필터`}>
      <span className="chip-label">{label}</span>
      <div className="kw-chips">
        {items.map(([v, n]) => (
          <button key={v} className={`kw-chip ${value === v ? 'is-active' : ''}`} aria-pressed={value === v} onClick={() => onChange(value === v ? '' : v)}>
            {v} <span>{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function OpenLink({ href, children = '원문 보기', className = 'btn btn-sm btn-weak' }) {
  if (!href) return null
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children} <Icon name="external" size={13} />
    </a>
  )
}

function PaperCard({ p, rank }) {
  const tone = statusTone(p.status)
  return (
    <li className={`paper ${p.important ? 'is-important' : ''}`} data-date={p.date} data-rank={rank}>
      <p className="paper-meta">
        <span className="date-badge" title="기록일">
          <Icon name="calendar" size={12} /> {fmt(p.date) || '날짜 없음'}
        </span>
        {p.important && <em className="hl-badge">★ 중요</em>}
        {p.status && <em className={`status-tag st-${tone}`}>{p.status}</em>}
      </p>
      <h3>{p.title}</h3>
      {p.authors && <p className="paper-authors">{p.authors}</p>}
      {(p.venue || p.year) && (
        <p className="paper-venue">
          {p.venue && <span className="venue-badge">{p.venue}</span>}
          {p.year && <span className="year-badge">{p.year}</span>}
        </p>
      )}
      {p.summary && <p className="paper-sum">{p.summary}</p>}
      <div className="paper-foot">
        {p.tags.length > 0 && (
          <p className="paper-tags">
            {p.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        )}
        <OpenLink href={p.link} />
      </div>
    </li>
  )
}

function PaperTable({ papers }) {
  return (
    <div className="sheet-table-wrap">
      <table className="sheet-table">
        <thead>
          <tr>
            <th scope="col">기록일</th>
            <th scope="col">제목</th>
            <th scope="col">저자</th>
            <th scope="col">저널/학회</th>
            <th scope="col">연도</th>
            <th scope="col">키워드</th>
            <th scope="col">중요도</th>
            <th scope="col">상태</th>
            <th scope="col">원문</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((p) => (
            <tr key={p.id} className={p.important ? 'is-important' : ''} data-date={p.date}>
              <td>
                <span className="date-badge">{fmt(p.date) || '—'}</span>
              </td>
              <th scope="row">
                {p.title}
                {p.summary && <small>{p.summary}</small>}
              </th>
              <td>{p.authors}</td>
              <td>{p.venue}</td>
              <td>{p.year}</td>
              <td>
                <span className="tbl-tags">
                  {p.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </span>
              </td>
              <td>{p.important ? <em className="hl-badge">★ 중요</em> : p.importance}</td>
              <td>{p.status && <em className={`status-tag st-${statusTone(p.status)}`}>{p.status}</em>}</td>
              <td>
                <OpenLink href={p.link} className="tbl-link">
                  열기
                </OpenLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tally = (list, pick) => {
  const m = new Map()
  list.forEach((p) => [].concat(pick(p)).forEach((v) => v && m.set(v, (m.get(v) || 0) + 1)))
  return [...m.entries()]
}

export default function Radar() {
  useDocumentTitle('논문 레이더 · DUCKSEUL')
  const { isAdmin } = useAdmin()
  const { data: radar, ready } = useSiteData('radar')
  const sheet = useRadarPapers(radar, ready)
  const [view, setView] = useState(() => readPref('radar-view', 'card'))
  const [order, setOrder] = useState(() => readPref('radar-order', 'newest'))
  const [tag, setTag] = useState('')
  const [venue, setVenue] = useState('')
  const [year, setYear] = useState('')
  const [onlyImportant, setOnlyImportant] = useState(false)
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(false)

  const sorted = useSortedPapers(sheet.data, order)
  const tags = useMemo(() => tally(sorted, (p) => p.tags).sort((a, b) => b[1] - a[1]), [sorted])
  const venues = useMemo(() => tally(sorted, (p) => p.venue).sort((a, b) => b[1] - a[1]).slice(0, 12), [sorted])
  const years = useMemo(() => tally(sorted, (p) => p.year).sort((a, b) => String(b[0]).localeCompare(String(a[0]))), [sorted])
  const needle = q.trim().toLowerCase()
  const shown = sorted.filter(
    (p) =>
      (!tag || p.tags.includes(tag)) &&
      (!venue || p.venue === venue) &&
      (!year || p.year === year) &&
      (!onlyImportant || p.important) &&
      (!needle || [p.title, p.authors, p.venue, p.summary, p.year, p.tags.join(' ')].join(' ').toLowerCase().includes(needle)),
  )
  const importantCount = sorted.filter((p) => p.important).length
  const filtered = tag || venue || year || onlyImportant || needle

  const choose = (setter, key) => (v) => (setter(v), writePref(key, v))

  return (
    <section className="page">
      <div className="container">
        <header className="page-head">
          <div>
            <p className="eyebrow">Paper Radar</p>
            <h1 className="page-title">논문 레이더</h1>
            <p className="page-sub">Google Sheets에 기록한 관심 논문을 실시간으로 불러와, 가장 최근에 기록한 논문부터 보여 줘요.</p>
          </div>
          <div className="page-actions">
            {!sheet.sample && !sheet.needsAuth && (
              <button className="btn btn-md btn-ghost" onClick={sheet.reload} disabled={sheet.loading}>
                <Icon name="refresh" size={16} /> {sheet.loading ? '불러오는 중…' : '새로고침'}
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-md btn-primary" onClick={() => setSettings(true)}>
                <Icon name="lock" size={16} /> Google Sheets API 설정
              </button>
            )}
          </div>
        </header>

        {sheet.sample && (
          <div className="card sample-banner">
            <p>
              <em className="badge warn">샘플 데이터</em> 아직 Google Sheets가 연결되지 않아 예시 논문을 보여 주고 있어요. 맨 아래 3편이 가장 먼저 기록한 초기
              자료예요.
            </p>
            <SheetGuide />
          </div>
        )}

        {sheet.needsAuth && (
          <div className="card sample-banner">
            <p>
              <Icon name="lock" size={18} /> 이 논문 레이더는 <b>비공개 Google Sheets</b>와 연결되어 있어 관리자만 볼 수 있어요.
            </p>
            {isAdmin && <p className="muted">「Google Sheets API 설정」에서 Sheets 읽기 권한을 연결하면 이 브라우저에서만 표시돼요.</p>}
          </div>
        )}

        {sheet.error && (
          <div className="card sample-banner error">
            <p className="form-error" role="alert">
              {sheet.error}
            </p>
          </div>
        )}

        {sheet.data && (
          <>
            <div className="radar-toolbar card">
              <div className="radar-row">
                <div className="radar-search">
                  <Icon name="search" size={16} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·저자·요약·키워드 검색" aria-label="논문 검색" />
                  {q && (
                    <button onClick={() => setQ('')} aria-label="검색어 지우기">
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
                <div className="view-toggle" role="group" aria-label="정렬">
                  <button className={order === 'newest' ? 'is-active' : ''} aria-pressed={order === 'newest'} onClick={() => choose(setOrder, 'radar-order')('newest')}>
                    최신 기록순
                  </button>
                  <button className={order === 'oldest' ? 'is-active' : ''} aria-pressed={order === 'oldest'} onClick={() => choose(setOrder, 'radar-order')('oldest')}>
                    오래된순
                  </button>
                </div>
                <div className="view-toggle" role="group" aria-label="보기 방식">
                  <button className={view === 'card' ? 'is-active' : ''} aria-pressed={view === 'card'} onClick={() => choose(setView, 'radar-view')('card')}>
                    <Icon name="note" size={16} /> 카드
                  </button>
                  <button className={view === 'table' ? 'is-active' : ''} aria-pressed={view === 'table'} onClick={() => choose(setView, 'radar-view')('table')}>
                    <Icon name="table" size={16} /> 테이블
                  </button>
                </div>
              </div>
              <div className="chip-groups">
                {importantCount > 0 && (
                  <div className="chip-group">
                    <span className="chip-label">하이라이트</span>
                    <div className="kw-chips">
                      <button className={`kw-chip hl ${onlyImportant ? 'is-active' : ''}`} aria-pressed={onlyImportant} onClick={() => setOnlyImportant((v) => !v)}>
                        ★ 중요 논문 <span>{importantCount}</span>
                      </button>
                    </div>
                  </div>
                )}
                <ChipGroup label="키워드" items={tags} value={tag} onChange={setTag} />
                <ChipGroup label="저널" items={venues} value={venue} onChange={setVenue} />
                <ChipGroup label="연도" items={years} value={year} onChange={setYear} />
              </div>
            </div>

            <p className="radar-count">
              {filtered ? `${shown.length} / ${sorted.length}편` : `${sorted.length}편`} · {order === 'newest' ? '최신 기록이 위' : '오래된 기록이 위'}
              {filtered && (
                <button
                  className="link-btn"
                  onClick={() => {
                    setTag('')
                    setVenue('')
                    setYear('')
                    setOnlyImportant(false)
                    setQ('')
                  }}
                >
                  필터 초기화
                </button>
              )}
            </p>

            {shown.length ? (
              view === 'table' ? (
                <PaperTable papers={shown} />
              ) : (
                <ul className="paper-grid">
                  {shown.map((p, i) => (
                    <PaperCard key={p.id} p={p} rank={i} />
                  ))}
                </ul>
              )
            ) : (
              <p className="empty">조건에 맞는 논문이 없어요.</p>
            )}

            <p className="sheet-foot muted sm">
              {MODE_LABEL[sheet.mode]}
              {sheet.data.fetchedAt && ` · ${sheet.data.fetchedAt.toTimeString().slice(0, 5)} 불러옴`}
            </p>
          </>
        )}
        {sheet.loading && !sheet.data && <p className="muted">시트를 불러오는 중…</p>}
      </div>

      <RadarSettings open={isAdmin && settings} onClose={() => setSettings(false)} radar={radar} />
    </section>
  )
}
