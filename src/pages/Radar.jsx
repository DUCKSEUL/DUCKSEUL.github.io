import { useMemo, useState } from 'react'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import FormModal from '../components/FormModal.jsx'
import { useAdmin } from '../lib/admin.js'
import { useSiteData, saveSiteData } from '../lib/siteData.js'
import { useSheetPapers, parseSheetUrl, fetchSheet } from '../lib/sheets.js'

const ROLE_LABEL = { title: '제목', authors: '저자', venue: '저널/학회', year: '연도', tags: '키워드', summary: '요약', link: '링크', status: '읽음상태' }

const statusTone = (s) => (/읽음$|완료|done|read$/i.test(s) ? 'done' : /읽는|진행|reading/i.test(s) ? 'doing' : s ? 'todo' : '')

export function SheetGuide({ compact = false }) {
  return (
    <div className={`sheet-guide ${compact ? 'compact' : ''}`}>
      <h3>
        <Icon name="table" size={18} /> Google Sheets 연결 설정 가이드
      </h3>
      <ol>
        <li>
          Google Sheets 첫 번째 행에 헤더를 적어 주세요. 예: <code>제목</code> <code>저자</code> <code>저널/학회</code> <code>연도</code>{' '}
          <code>키워드/태그</code> <code>한줄요약</code> <code>링크</code> <code>읽음상태</code> (영어 헤더도 자동 인식)
        </li>
        <li>
          오른쪽 위 <b>공유</b> → 일반 액세스를 <b>「링크가 있는 모든 사용자」 · 뷰어</b>로 바꾸고 <b>링크 복사</b>.
        </li>
        <li>
          이 페이지의 <b>시트 연결 설정</b>(Admin)에 링크를 붙여 넣고, 여러 탭이 있으면 탭 이름을 적어 저장하세요.
        </li>
      </ol>
      {!compact && (
        <p className="muted sm">
          API 키나 서버 없이 브라우저가 Google Visualization API(<code>gviz/tq?tqx=out:json</code>)로 시트를 직접 읽어요. 시트를 고치면 새로고침만으로
          바로 반영돼요. 링크 공유를 켠 시트는 링크를 아는 누구나 볼 수 있으니 공개해도 되는 내용만 넣어 주세요.
        </p>
      )}
    </div>
  )
}

function PaperCard({ p }) {
  const tone = statusTone(p.status)
  return (
    <li className="paper">
      <p className="paper-meta">
        {p.status && <em className={`status-tag st-${tone}`}>{p.status}</em>}
        {[p.venue, p.year].filter(Boolean).join(' · ')}
      </p>
      <h3>
        {p.link ? (
          <a href={p.link} target="_blank" rel="noreferrer">
            {p.title} <Icon name="external" size={13} />
          </a>
        ) : (
          p.title
        )}
      </h3>
      {p.authors && <p className="paper-authors">{p.authors}</p>}
      {p.summary && <p className="paper-sum">{p.summary}</p>}
      {p.tags.length > 0 && (
        <p className="paper-tags">
          {p.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </p>
      )}
    </li>
  )
}

function PaperTable({ data, papers }) {
  // 시트의 원래 열을 그대로 보여 주되, 링크 열은 클릭 가능하게
  const linkCol = data.roles.link
  const ids = new Set(papers.map((p) => p.id))
  const all = data.papers.filter((p) => ids.has(p.id))
  return (
    <div className="sheet-table-wrap">
      <table className="sheet-table">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {all.map((p) => (
            <tr key={p.id}>
              {p.raw.map((v, i) =>
                i === linkCol && p.link ? (
                  <td key={i}>
                    <a href={p.link} target="_blank" rel="noreferrer">
                      열기 <Icon name="external" size={12} />
                    </a>
                  </td>
                ) : i === data.roles.title ? (
                  <th key={i} scope="row">
                    {v}
                  </th>
                ) : (
                  <td key={i}>{v}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Radar() {
  useDocumentTitle('논문 레이더 · DUCKSEUL')
  const { isAdmin } = useAdmin()
  const { data: radar, ready } = useSiteData('radar')
  const sheetUrl = radar?.sheetUrl || ''
  const sheetName = radar?.sheetName || ''
  const sheet = useSheetPapers(ready ? sheetUrl : '', sheetName)
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('radar-view') || 'card'
    } catch {
      return 'card'
    }
  })
  const [tag, setTag] = useState('')
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(false)

  const papers = sheet.data?.papers || []
  const tags = useMemo(() => {
    const m = new Map()
    papers.forEach((p) => p.tags.forEach((t) => m.set(t, (m.get(t) || 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [papers])
  const needle = q.trim().toLowerCase()
  const shown = papers.filter(
    (p) => (!tag || p.tags.includes(tag)) && (!needle || [p.title, p.authors, p.venue, p.summary, p.tags.join(' ')].join(' ').toLowerCase().includes(needle)),
  )

  const switchView = (v) => {
    setView(v)
    try {
      localStorage.setItem('radar-view', v)
    } catch {
      /* ignore */
    }
  }

  const saveSettings = async (v) => {
    const url = v.sheetUrl.trim()
    if (url && !parseSheetUrl(url)) throw new Error('Google Sheets 링크 형식이 아니에요. (docs.google.com/spreadsheets/d/…)')
    if (url) {
      const test = await fetchSheet(url, v.sheetName.trim()) // 저장 전에 실제로 읽히는지 확인
      if (!test.papers.length) throw new Error('시트는 읽었지만 제목이 있는 행이 없어요. 첫 행 헤더와 데이터를 확인해 주세요.')
    }
    await saveSiteData('radar', { ...radar, sheetUrl: url, sheetName: v.sheetName.trim() }, url ? 'radar: Google Sheets 연결 설정' : 'radar: Google Sheets 연결 해제')
    toast(url ? '시트를 연결했어요. 1~2분 뒤 모든 방문자에게 반영돼요.' : '시트 연결을 해제했어요.')
    setSettings(false)
  }

  const roles = sheet.data?.roles || {}
  const detected = Object.entries(roles)
    .filter(([r]) => ROLE_LABEL[r])
    .map(([r, i]) => `${ROLE_LABEL[r]} ← ${sheet.data.headers[i]}`)

  return (
    <section className="page">
      <div className="container">
        <header className="page-head">
          <div>
            <p className="eyebrow">Paper Radar</p>
            <h1 className="page-title">논문 레이더</h1>
            <p className="page-sub">Google Sheets에 정리한 관심 논문을 실시간으로 불러와요.</p>
          </div>
          <div className="page-actions">
            {sheetUrl && (
              <button className="btn btn-md btn-ghost" onClick={sheet.reload} disabled={sheet.loading}>
                <Icon name="refresh" size={16} /> {sheet.loading ? '불러오는 중…' : '새로고침'}
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-md btn-primary" onClick={() => setSettings(true)}>
                <Icon name="table" size={16} /> 시트 연결 설정
              </button>
            )}
          </div>
        </header>

        {sheet.sample && (
          <div className="card sample-banner">
            <p>
              <em className="badge warn">샘플 데이터</em> 아직 Google Sheets가 연결되지 않아 예시 논문을 보여 주고 있어요.
            </p>
            <SheetGuide />
          </div>
        )}

        {sheet.error && (
          <div className="card sample-banner error">
            <p className="form-error" role="alert">
              {sheet.error}
            </p>
            {isAdmin && <SheetGuide compact />}
          </div>
        )}

        <div className="radar-toolbar card">
          <div className="radar-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·저자·요약 검색" aria-label="논문 검색" />
          </div>
          <div className="view-toggle" role="group" aria-label="보기 방식">
            <button className={view === 'card' ? 'is-active' : ''} aria-pressed={view === 'card'} onClick={() => switchView('card')}>
              <Icon name="note" size={16} /> 카드
            </button>
            <button className={view === 'table' ? 'is-active' : ''} aria-pressed={view === 'table'} onClick={() => switchView('table')}>
              <Icon name="table" size={16} /> 테이블
            </button>
          </div>
          {tags.length > 0 && (
            <div className="kw-chips">
              <button className={`kw-chip ${!tag ? 'is-active' : ''}`} aria-pressed={!tag} onClick={() => setTag('')}>
                전체 <span>{papers.length}</span>
              </button>
              {tags.map(([t, n]) => (
                <button key={t} className={`kw-chip ${tag === t ? 'is-active' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>
                  #{t} <span>{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {sheet.loading && !sheet.data ? (
          <p className="muted">시트를 불러오는 중…</p>
        ) : shown.length ? (
          view === 'table' ? (
            <PaperTable data={sheet.data} papers={shown} />
          ) : (
            <ul className="paper-grid">
              {shown.map((p) => (
                <PaperCard key={p.id} p={p} />
              ))}
            </ul>
          )
        ) : (
          sheet.data && <p className="empty">조건에 맞는 논문이 없어요.</p>
        )}

        {sheet.data && (
          <p className="sheet-foot muted sm">
            {sheet.sample ? '샘플' : 'Google Sheets'} · {papers.length}편
            {sheet.data.fetchedAt && ` · ${sheet.data.fetchedAt.toTimeString().slice(0, 5)} 불러옴`}
            {isAdmin && detected.length > 0 && <> · 인식한 열: {detected.join(', ')}</>}
          </p>
        )}
      </div>

      <FormModal
        open={isAdmin && settings}
        title="Google Sheets 연결 설정"
        fields={[
          {
            name: 'sheetUrl',
            label: '시트 공유 링크 (또는 시트 ID)',
            full: true,
            placeholder: 'https://docs.google.com/spreadsheets/d/…/edit?usp=sharing',
            hint: '비워 두고 저장하면 연결이 해제되고 샘플 데이터가 보여요.',
          },
          { name: 'sheetName', label: '시트 탭 이름 (선택)', full: true, placeholder: '예: Papers — 비우면 링크의 탭(gid) 또는 첫 번째 탭' },
        ]}
        initial={{ sheetUrl, sheetName }}
        submitLabel="확인 후 저장"
        onSubmit={saveSettings}
        onClose={() => setSettings(false)}
      />
    </section>
  )
}
