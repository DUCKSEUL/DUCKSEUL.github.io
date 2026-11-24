import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import FormModal from '../components/FormModal.jsx'
import { useAdmin } from '../lib/admin.js'
import { useSiteData, saveSiteData, newItemId } from '../lib/siteData.js'
import { PUB_TYPES, pubType, safeUrl, doiUrl, toBibtex } from '../lib/labels.js'

const ALL = 'all'
const FIELDS = [
  { name: 'type', label: '분류', type: 'select', options: PUB_TYPES.map((t) => ({ value: t.value, label: `${t.label} · ${t.ko}` })) },
  { name: 'year', label: '연도', type: 'number', placeholder: '2026' },
  { name: 'title', label: '제목', required: true, full: true },
  { name: 'authors', label: '저자', placeholder: 'D. Kim, ...', full: true },
  { name: 'venue', label: '저널 / 학회 / 특허번호 / 언어', full: true },
  { name: 'description', label: '한 줄 설명', type: 'textarea', rows: 2 },
  { name: 'doi', label: 'DOI', placeholder: '10.1109/...' },
  { name: 'pdf', label: 'PDF 링크', type: 'url', placeholder: 'https://' },
  { name: 'code', label: '코드 링크', type: 'url', placeholder: 'https://github.com/...' },
  { name: 'url', label: '기타 링크', type: 'url', placeholder: 'https://' },
  { name: 'highlight', label: '홈 화면 하이라이트에 표시', type: 'checkbox' },
]

export function PubLinks({ item }) {
  const links = [
    ['DOI', doiUrl(item.doi)],
    ['PDF', safeUrl(item.pdf)],
    ['Code', safeUrl(item.code)],
    ['Link', safeUrl(item.url)],
  ].filter(([, u]) => u)
  if (!links.length) return null
  return (
    <span className="pub-links">
      {links.map(([l, u]) => (
        <a key={l} href={u} target="_blank" rel="noreferrer">
          {l} <Icon name="external" size={12} />
        </a>
      ))}
    </span>
  )
}

function BibtexButton({ item }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    const text = toBibtex(item)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 클립보드 API를 못 쓰는 환경: 임시 textarea로 복사
      const ta = Object.assign(document.createElement('textarea'), { value: text })
      document.body.append(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setDone(true)
    toast('BibTeX를 복사했어요.')
    setTimeout(() => setDone(false), 1600)
  }
  return (
    <button className={`bib-btn ${done ? 'is-done' : ''}`} onClick={copy} aria-label={`「${item.title}」 BibTeX 복사`}>
      <Icon name={done ? 'check' : 'copy'} size={12} /> {done ? '복사됨' : 'BibTeX'}
    </button>
  )
}

export default function Publications() {
  useDocumentTitle('연구 실적 · DUCKSEUL')
  const { isAdmin } = useAdmin()
  const { data, ready } = useSiteData('publications')
  const [params, setParams] = useSearchParams()
  const tab = params.get('type') || ALL
  const [editing, setEditing] = useState(null) // null | {} (new) | item

  const items = [...(data?.items || [])].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0))
  const list = tab === ALL ? items : items.filter((i) => i.type === tab)
  const count = (t) => items.filter((i) => i.type === t).length

  const persist = async (next, msg) => {
    await saveSiteData('publications', { ...data, items: next }, msg)
    toast('저장했어요. 1~2분 뒤 모든 방문자에게 반영돼요.')
    setEditing(null)
  }

  const onSubmit = async (v) => {
    const rec = { ...v, year: v.year ? Number(v.year) : '', title: v.title.trim() }
    if (editing?.id) await persist(items.map((i) => (i.id === editing.id ? { ...i, ...rec } : i)), `publications: 「${rec.title}」 수정`)
    else await persist([{ id: newItemId('pub'), ...rec }, ...items], `publications: 「${rec.title}」 추가`)
  }

  const onDelete = async () => {
    if (!window.confirm(`「${editing.title}」을(를) 삭제할까요?`)) return
    try {
      await persist(
        items.filter((i) => i.id !== editing.id),
        `publications: 「${editing.title}」 삭제`,
      )
    } catch (e) {
      toast(`삭제 실패: ${e.message}`, 'error')
    }
  }

  return (
    <section className="page">
      <div className="container narrow">
        <header className="page-head">
          <div>
            <p className="eyebrow">Publications & Projects</p>
            <h1 className="page-title">연구 실적</h1>
            <p className="page-sub">저널 논문, 학술대회 발표, 특허, 코드와 프로젝트를 모았어요.</p>
          </div>
          {isAdmin && (
            <button className="btn btn-md btn-primary" onClick={() => setEditing({ type: tab === ALL ? 'journal' : tab, year: new Date().getFullYear() })}>
              <Icon name="plus" size={18} /> 실적 추가
            </button>
          )}
        </header>

        <nav className="cat-tabs" aria-label="실적 분류">
          {[{ value: ALL, label: '전체' }, ...PUB_TYPES].map((t) => (
            <button
              key={t.value}
              className={t.value === tab ? 'is-active' : ''}
              aria-pressed={t.value === tab}
              onClick={() => setParams(t.value === ALL ? {} : { type: t.value })}
            >
              {t.label}
              <span>{t.value === ALL ? items.length : count(t.value)}</span>
            </button>
          ))}
        </nav>

        {!ready ? (
          <div className="skeleton-list" />
        ) : list.length ? (
          <ul className="pub-list">
            {list.map((i) => {
              const t = pubType(i.type)
              return (
                <li key={i.id} className="pub-item">
                  <span className={`pub-badge t-${t.value}`}>{t.label}</span>
                  <div className="pub-body">
                    <h3>{i.title}</h3>
                    {i.authors && <p className="pub-authors">{i.authors}</p>}
                    <p className="pub-venue">
                      {[i.venue, i.year].filter(Boolean).join(' · ')}
                      {i.highlight && <em className="badge">Highlight</em>}
                    </p>
                    {i.description && <p className="pub-desc">{i.description}</p>}
                    <div className="pub-actions">
                      <PubLinks item={i} />
                      <BibtexButton item={i} />
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="icon-btn" onClick={() => setEditing(i)} aria-label={`「${i.title}」 수정`}>
                      <Icon name="pen" size={18} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="empty">
            <p>{tab === ALL ? '아직 등록된 실적이 없어요.' : `등록된 ${pubType(tab).ko} 항목이 없어요.`}</p>
            {isAdmin && (
              <button className="btn btn-md btn-weak" onClick={() => setEditing({ type: tab === ALL ? 'journal' : tab, year: new Date().getFullYear() })}>
                실적 추가
              </button>
            )}
          </div>
        )}
      </div>

      <FormModal
        open={isAdmin && !!editing}
        title={editing?.id ? '실적 수정' : '실적 추가'}
        fields={FIELDS}
        initial={editing}
        onSubmit={onSubmit}
        onClose={() => setEditing(null)}
        onDelete={editing?.id ? onDelete : undefined}
      />
    </section>
  )
}
