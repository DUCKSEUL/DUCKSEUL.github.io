import { useMemo, useState } from 'react'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import FormModal from '../components/FormModal.jsx'
import { GoogleConnectButton } from '../components/GoogleConnect.jsx'
import { useAdmin } from '../lib/admin.js'
import { useGoogle, ymd } from '../lib/google.js'
import { saveSiteData, newItemId } from '../lib/siteData.js'
import { useEvents, eventsOn } from '../lib/useEvents.js'
import { EVENT_TYPES, eventType, dday, parseYmd, safeUrl } from '../lib/labels.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const FIELDS = [
  { name: 'title', label: '일정 이름', required: true, full: true },
  { name: 'date', label: '시작일', type: 'date', required: true },
  { name: 'endDate', label: '종료일 (선택)', type: 'date' },
  { name: 'type', label: '분류', type: 'select', options: EVENT_TYPES },
  { name: 'url', label: '링크 (선택)', type: 'url', placeholder: 'https://' },
  { name: 'note', label: '메모 (선택)', type: 'textarea', rows: 2 },
]

export function EventRow({ e, onEdit, showDday = true }) {
  const t = eventType(e.type)
  const url = safeUrl(e.url)
  const range = e.endDate ? `${e.date.slice(5).replace('-', '.')} – ${e.endDate.slice(5).replace('-', '.')}` : e.date.slice(5).replace('-', '.')
  const Title = url ? 'a' : 'span'
  return (
    <li className={`ev-row ev-${t.value}`}>
      {showDday && <span className="ev-dday">{dday(e.date)}</span>}
      <div className="ev-main">
        <Title className="ev-title" {...(url ? { href: url, target: '_blank', rel: 'noreferrer' } : {})}>
          {e.title}
        </Title>
        <span className="ev-meta">
          <em className={`ev-tag ev-${t.value}`}>{t.label}</em> {range}
          {e.time && ` · ${e.time}`}
          {e.source === 'google' && <span className="ev-private"> · 나만 보임</span>}
        </span>
        {e.note && <span className="ev-note">{e.note}</span>}
      </div>
      {onEdit && e.source === 'public' && (
        <button className="icon-btn" onClick={() => onEdit(e)} aria-label={`「${e.title}」 수정`}>
          <Icon name="pen" size={16} />
        </button>
      )}
    </li>
  )
}

export default function Calendar() {
  useDocumentTitle('캘린더 · DUCKSEUL')
  const { isAdmin } = useAdmin()
  const g = useGoogle()
  const today = ymd(new Date())
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState(null)

  // 6주 고정 달력
  const days = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(1 - cursor.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [cursor])
  const from = days[0]
  const to = days[41]
  const { events, publicData, google } = useEvents(from, to)

  // 다가오는 일정: 오늘부터 60일
  const upFrom = useMemo(() => parseYmd(today), [today])
  const upTo = useMemo(() => new Date(upFrom.getFullYear(), upFrom.getMonth(), upFrom.getDate() + 60), [upFrom])
  const upcoming = useEvents(upFrom, upTo).events.filter((e) => (e.endDate || e.date) >= today)

  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const goToday = () => {
    const d = new Date()
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(today)
  }

  const items = publicData?.items || []
  const persist = async (next, msg) => {
    await saveSiteData('events', { ...publicData, items: next }, msg)
    toast('공개 일정을 저장했어요. 1~2분 뒤 모든 방문자에게 반영돼요.')
    setEditing(null)
  }
  const onSubmit = async (v) => {
    if (v.endDate && v.endDate < v.date) throw new Error('종료일이 시작일보다 빨라요.')
    const rec = { title: v.title.trim(), date: v.date, endDate: v.endDate || '', type: v.type || 'other', url: v.url.trim(), note: v.note.trim() }
    if (editing?.id) await persist(items.map((i) => (i.id === editing.id ? { ...i, ...rec } : i)), `events: 「${rec.title}」 수정`)
    else await persist([...items, { id: newItemId('ev'), ...rec }], `events: 「${rec.title}」 추가`)
  }
  const onDelete = async () => {
    if (!window.confirm(`「${editing.title}」 일정을 삭제할까요?`)) return
    try {
      await persist(
        items.filter((i) => i.id !== editing.id),
        `events: 「${editing.title}」 삭제`,
      )
    } catch (e) {
      toast(`삭제 실패: ${e.message}`, 'error')
    }
  }

  const dayEvents = eventsOn(events, selected)
  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`

  return (
    <section className="page">
      <div className="container">
        <header className="page-head">
          <div>
            <p className="eyebrow">Schedule & Calendar</p>
            <h1 className="page-title">캘린더</h1>
            <p className="page-sub">
              연구실 세미나, 학회 마감, 연구 마일스톤.
              {isAdmin && g.connected ? ' 내 Google 캘린더 일정은 이 브라우저에만 표시돼요.' : ''}
            </p>
          </div>
          <div className="page-actions">
            <GoogleConnectButton label="Google 캘린더 연결" />
            {isAdmin && (
              <button className="btn btn-md btn-primary" onClick={() => setEditing({ date: selected, type: 'seminar' })}>
                <Icon name="plus" size={18} /> 공개 일정 추가
              </button>
            )}
          </div>
        </header>

        {google.error && (
          <p className="form-error" role="alert">
            {google.error}
          </p>
        )}

        <div className="cal-layout">
          <div className="card cal-card">
            <div className="cal-head">
              <button className="icon-btn" onClick={() => move(-1)} aria-label="이전 달">
                <Icon name="chevronLeft" size={20} />
              </button>
              <h2 aria-live="polite">{monthLabel}</h2>
              <button className="icon-btn" onClick={() => move(1)} aria-label="다음 달">
                <Icon name="chevron" size={20} />
              </button>
              <button className="btn btn-sm btn-ghost" onClick={goToday}>
                오늘
              </button>
              {google.enabled && (
                <button className="icon-btn cal-refresh" onClick={google.refresh} aria-label="Google 일정 새로고침" title="Google 일정 새로고침">
                  <Icon name="refresh" size={18} />
                </button>
              )}
              {google.loading && <span className="cal-loading">불러오는 중…</span>}
            </div>
            <div className="cal-grid" role="grid" aria-label={monthLabel}>
              {WEEK.map((w, i) => (
                <div key={w} className={`cal-wd ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`} role="columnheader">
                  {w}
                </div>
              ))}
              {days.map((d) => {
                const k = ymd(d)
                const evs = eventsOn(events, k)
                const out = d.getMonth() !== cursor.getMonth()
                return (
                  <button
                    key={k}
                    role="gridcell"
                    className={`cal-day ${out ? 'is-out' : ''} ${k === today ? 'is-today' : ''} ${k === selected ? 'is-selected' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}`}
                    onClick={() => setSelected(k)}
                    aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${evs.length ? `, 일정 ${evs.length}개` : ''}`}
                    aria-pressed={k === selected}
                  >
                    <span className="cal-num">{d.getDate()}</span>
                    <span className="cal-evs">
                      {evs.slice(0, 2).map((e) => (
                        <span key={e.id} className={`cal-ev ev-${eventType(e.type).value}`}>
                          {e.title}
                        </span>
                      ))}
                      {evs.length > 2 && <span className="cal-more">+{evs.length - 2}</span>}
                    </span>
                    {evs.length > 0 && <span className="cal-dots" aria-hidden>{evs.slice(0, 3).map((e) => <i key={e.id} className={`ev-${eventType(e.type).value}`} />)}</span>}
                  </button>
                )
              })}
            </div>
            <div className="cal-legend" aria-label="범례">
              {[...EVENT_TYPES.slice(0, 4), ...(google.enabled ? [{ value: 'google', label: 'Google (나만 보임)' }] : [])].map((t) => (
                <span key={t.value}>
                  <i className={`ev-${t.value}`} /> {t.label}
                </span>
              ))}
            </div>
          </div>

          <aside className="cal-side">
            <div className="card">
              <h2 className="card-title sm">
                {parseYmd(selected).getMonth() + 1}월 {parseYmd(selected).getDate()}일 ({WEEK[parseYmd(selected).getDay()]})
              </h2>
              {dayEvents.length ? (
                <ul className="ev-list">
                  {dayEvents.map((e) => (
                    <EventRow key={e.id} e={e} onEdit={isAdmin ? setEditing : undefined} showDday={false} />
                  ))}
                </ul>
              ) : (
                <p className="muted">일정이 없어요.</p>
              )}
            </div>
            <div className="card">
              <h2 className="card-title sm">다가오는 일정</h2>
              {upcoming.length ? (
                <ul className="ev-list">
                  {upcoming.slice(0, 8).map((e) => (
                    <EventRow key={e.id} e={e} onEdit={isAdmin ? setEditing : undefined} />
                  ))}
                </ul>
              ) : (
                <p className="muted">앞으로 60일 동안 예정된 일정이 없어요.</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <FormModal
        open={isAdmin && !!editing}
        title={editing?.id ? '공개 일정 수정' : '공개 일정 추가'}
        fields={FIELDS}
        initial={editing}
        onSubmit={onSubmit}
        onClose={() => setEditing(null)}
        onDelete={editing?.id ? onDelete : undefined}
        width={520}
      />
    </section>
  )
}
