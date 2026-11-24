import { useMemo, useState } from 'react'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import RadarSettings from '../components/RadarSettings.jsx'
import { useAdmin } from '../lib/admin.js'
import { useSiteData } from '../lib/siteData.js'
import { useRadarPapers, useSortedPapers, groupByDate, fmtGroupDate, publishSnapshot, BANDS, METHODS } from '../lib/sheets.js'

const statusTone = (s) => (/읽음$|완료|done|^read$/i.test(s) ? 'done' : /읽는|진행|reading/i.test(s) ? 'doing' : s ? 'todo' : '')
const fmt = (d) => (d ? d.replace(/-/g, '.') : '')
const MODE_LABEL = {
  sample: '샘플 데이터',
  gviz: 'Google Sheets 실시간 (링크 공유)',
  apikey: 'Google Sheets API · API Key',
  oauth: 'Google Sheets API · OAuth (비공개)',
  snapshot: '공개 스냅샷 (public/data/papers.json)',
}
const BAND_LABEL = Object.fromEntries(BANDS.map((b) => [b.key, b.label]))
const toggleIn = (set, v) => {
  const n = new Set(set)
  n.has(v) ? n.delete(v) : n.add(v)
  return n
}

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

/** 다중 선택 필터 행 (동작 주파수 · CEM 기법) */
function FacetRow({ label, icon, kind, items, selected, onToggle, onClear }) {
  if (!items.length) return null
  return (
    <div className={`chip-group facet facet-${kind}`} role="group" aria-label={`${label} 필터 (여러 개 선택 가능)`}>
      <span className="chip-label">
        <Icon name={icon} size={13} /> {label}
      </span>
      <div className="kw-chips">
        <button className={`kw-chip facet-all ${selected.size ? '' : 'is-active'}`} aria-pressed={!selected.size} onClick={onClear}>
          전체
        </button>
        {items.map((it) => (
          <button
            key={it.key}
            className={`kw-chip facet-chip ${it.tone || ''} ${selected.has(it.key) ? 'is-active' : ''}`}
            aria-pressed={selected.has(it.key)}
            title={it.hint}
            onClick={() => onToggle(it.key)}
          >
            {selected.has(it.key) && <Icon name="check" size={12} />}
            {it.label} <span>{it.n}</span>
          </button>
        ))}
        {selected.size > 0 && (
          <button className="facet-reset" onClick={onClear} aria-label={`${label} 선택 초기화`}>
            <Icon name="close" size={12} /> 선택 초기화
          </button>
        )}
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
        {p.important && <em className="hl-badge">★ 중요</em>}
        {p.importance && !p.important && (
          <em className="grade-badge" title="중요도/등급">
            {p.importance}
          </em>
        )}
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
      {(p.bands.length > 0 || p.methods.length > 0) && (
        <p className="paper-spec">
          {p.bands.map((b) => (
            <span key={b} className={`spec-band band-${b}`} title={p.freq || undefined}>
              {BAND_LABEL[b]}
            </span>
          ))}
          {p.methods.map((m) => (
            <span key={m} className="spec-cem" title={p.cem || undefined}>
              {m}
            </span>
          ))}
        </p>
      )}
      {p.summary && <p className="paper-sum">{p.summary}</p>}
      {p.comment && <p className="paper-comment">💬 {p.comment}</p>}
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
                {p.comment && <small className="tbl-comment">💬 {p.comment}</small>}
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
  const [bandSel, setBandSel] = useState(() => new Set())
  const [cemSel, setCemSel] = useState(() => new Set())
  const [syncing, setSyncing] = useState(false)
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(false)

  const sorted = useSortedPapers(sheet.data, order)
  const tags = useMemo(() => tally(sorted, (p) => p.tags).sort((a, b) => b[1] - a[1]), [sorted])
  const venues = useMemo(() => tally(sorted, (p) => p.venueKey).sort((a, b) => b[1] - a[1]).slice(0, 12), [sorted])
  const years = useMemo(() => tally(sorted, (p) => p.year).sort((a, b) => String(b[0]).localeCompare(String(a[0]))), [sorted])
  const bandItems = useMemo(() => {
    const m = new Map(tally(sorted, (p) => p.bands))
    return BANDS.filter((b) => m.has(b.key)).map((b) => ({ key: b.key, label: b.label, hint: b.hint, n: m.get(b.key), tone: `band-${b.key}` }))
  }, [sorted])
  const cemItems = useMemo(() => {
    const m = new Map(tally(sorted, (p) => p.methods))
    return METHODS.filter((x) => m.has(x.key))
      .map((x) => ({ key: x.key, label: x.key, n: m.get(x.key) }))
      .sort((a, b) => b.n - a.n)
  }, [sorted])
  const needle = q.trim().toLowerCase()
  const shown = sorted.filter(
    (p) =>
      (!tag || p.tags.includes(tag)) &&
      (!venue || p.venueKey === venue) &&
      (!year || p.year === year) &&
      (!onlyImportant || p.important) &&
      (!bandSel.size || p.bands.some((b) => bandSel.has(b))) &&
      (!cemSel.size || p.methods.some((m) => cemSel.has(m))) &&
      (!needle || [p.title, p.authors, p.venue, p.summary, p.comment, p.year, p.freq, p.cem, p.structure, p.tags.join(' ')].join(' ').toLowerCase().includes(needle)),
  )
  const importantCount = sorted.filter((p) => p.important).length
  const filtered = tag || venue || year || onlyImportant || needle || bandSel.size > 0 || cemSel.size > 0
  const groups = groupByDate(shown)
  const resetAll = () => {
    setTag('')
    setVenue('')
    setYear('')
    setOnlyImportant(false)
    setBandSel(new Set())
    setCemSel(new Set())
    setQ('')
  }
  const syncSnapshot = async () => {
    setSyncing(true)
    try {
      await publishSnapshot(sheet.data, radar?.columns)
      toast('공개 스냅샷을 저장했어요. 1~2분 뒤 방문자 화면에 반영돼요.')
    } catch (e) {
      toast(`스냅샷 저장 실패: ${e.message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

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
            {!sheet.sample && (
              <button className="btn btn-md btn-ghost" onClick={sheet.reload} disabled={sheet.loading}>
                <Icon name="refresh" size={16} /> {sheet.loading ? '불러오는 중…' : '새로고침'}
              </button>
            )}
            {isAdmin && !sheet.sample && sheet.data && sheet.source !== 'snapshot' && (
              <button className="btn btn-md btn-ghost" onClick={syncSnapshot} disabled={syncing} title="방문자에게 보이는 public/data/papers.json 갱신">
                <Icon name="upload" size={16} /> {syncing ? '저장 중…' : '공개 스냅샷 저장'}
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

        {sheet.needsAuth && isAdmin && (
          <div className="card sample-banner">
            <p>
              <Icon name="lock" size={18} /> 비공개 시트를 읽을 수 없고 공개 스냅샷도 아직 없어요. 「Google Sheets API 설정」에서 Sheets 읽기 권한을 연결한 뒤
              저장하면 방문자에게도 목록이 보여요.
            </p>
          </div>
        )}
        {sheet.needsAuth && !isAdmin && <p className="empty">논문 목록을 준비하고 있어요. 잠시 후 다시 확인해 주세요.</p>}

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
                <FacetRow
                  label="동작 주파수"
                  icon="wave"
                  kind="band"
                  items={bandItems}
                  selected={bandSel}
                  onToggle={(k) => setBandSel((s) => toggleIn(s, k))}
                  onClear={() => setBandSel(new Set())}
                />
                <FacetRow
                  label="CEM 기법"
                  icon="sigma"
                  kind="cem"
                  items={cemItems}
                  selected={cemSel}
                  onToggle={(k) => setCemSel((s) => toggleIn(s, k))}
                  onClear={() => setCemSel(new Set())}
                />
              </div>
            </div>

            <p className="radar-count">
              {filtered ? `${shown.length} / ${sorted.length}편` : `${sorted.length}편`} · 기록일 {groups.length}개 · {order === 'newest' ? '최신 기록이 위' : '오래된 기록이 위'}
              {filtered && (
                <button className="link-btn" onClick={resetAll}>
                  필터 초기화
                </button>
              )}
            </p>

            {shown.length ? (
              view === 'table' ? (
                <PaperTable papers={shown} />
              ) : (
                <div className="date-groups">
                  {groups.map((g) => (
                    <section key={g.date || 'none'} className="date-group" aria-label={`${fmtGroupDate(g.date)} 기록 논문`}>
                      <header className="date-head">
                        <h2>
                          <time dateTime={g.date || undefined}>{fmtGroupDate(g.date)}</time>
                        </h2>
                        <span className="date-count">{g.papers.length}편</span>
                        <span className="date-rule" aria-hidden />
                      </header>
                      <ul className="paper-grid">
                        {g.papers.map((p, i) => (
                          <PaperCard key={p.id} p={p} rank={i} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )
            ) : (
              <div className="empty">
                <p>조건에 맞는 논문이 없어요.</p>
                <button className="btn btn-sm btn-weak" onClick={resetAll}>
                  필터 초기화
                </button>
              </div>
            )}

            <p className="sheet-foot muted sm">
              {MODE_LABEL[sheet.source || sheet.mode]}
              {sheet.data.fetchedAt &&
                (sheet.source === 'snapshot'
                  ? ` · ${sheet.data.fetchedAt.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} 동기화`
                  : ` · ${sheet.data.fetchedAt.toTimeString().slice(0, 5)} 불러옴`)}
              {isAdmin && sheet.synced && ' · 공개 스냅샷 자동 갱신됨'}
            </p>
          </>
        )}
        {sheet.loading && !sheet.data && <p className="muted">시트를 불러오는 중…</p>}
      </div>

      <RadarSettings open={isAdmin && settings} onClose={() => setSettings(false)} radar={radar} />
    </section>
  )
}
