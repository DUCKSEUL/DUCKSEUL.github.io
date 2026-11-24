import { useState } from 'react'
import { Icon, toast, useDocumentTitle } from '../components/ui.jsx'
import FormModal from '../components/FormModal.jsx'
import { useAdmin } from '../lib/admin.js'
import { useSiteData, saveSiteData } from '../lib/siteData.js'
import { safeUrl } from '../lib/labels.js'

// 목록 항목은 한 줄에 하나씩, 구분자로 나눠 입력합니다.
const lines = (s) =>
  String(s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const split = (l, sep) => l.split(sep).map((x) => x.trim())

const toForm = (a = {}) => ({
  name: a.name || '',
  affiliation: a.affiliation || '',
  status: a.status || '',
  tagline: a.tagline || '',
  areas: (a.areas || []).join(', '),
  github: a.links?.github || '',
  email: a.links?.email || '',
  scholar: a.links?.scholar || '',
  labName: a.lab?.name || '',
  labUrl: a.lab?.url || '',
  labDesc: a.lab?.desc || '',
  education: (a.education || []).map((e) => [e.period, e.school, e.degree].filter((x) => x !== undefined).join(' | ')).join('\n'),
  interests: (a.interests || []).map((i) => `${i.title} | ${i.desc || ''}`).join('\n'),
  skills: (a.skills || []).map((s) => `${s.group}: ${(s.items || []).join(', ')}`).join('\n'),
})

const fromForm = (v, prev) => ({
  ...prev,
  name: v.name.trim(),
  affiliation: v.affiliation.trim(),
  status: v.status.trim(),
  tagline: v.tagline.trim(),
  areas: v.areas
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  links: { github: v.github.trim(), email: v.email.trim(), scholar: v.scholar.trim() },
  lab: { name: v.labName.trim(), url: v.labUrl.trim(), desc: v.labDesc.trim() },
  education: lines(v.education).map((l) => {
    const [period = '', school = '', degree = ''] = split(l, '|')
    return { period, school, degree }
  }),
  interests: lines(v.interests).map((l) => {
    const [title = '', desc = ''] = split(l, '|')
    return { title, desc }
  }),
  skills: lines(v.skills).map((l) => {
    const i = l.indexOf(':')
    const group = i >= 0 ? l.slice(0, i).trim() : '기타'
    const items = (i >= 0 ? l.slice(i + 1) : l)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    return { group, items }
  }),
})

const FIELDS = [
  { name: 'name', label: '이름', required: true },
  { name: 'status', label: '현재 진행 상태', placeholder: '3D IE-MoM 솔버 고도화 중' },
  { name: 'affiliation', label: '소속', full: true },
  { name: 'tagline', label: '한 줄 소개', full: true },
  { name: 'areas', label: '주요 연구 분야 태그 (쉼표로 구분)', full: true },
  { name: 'github', label: 'GitHub', type: 'url' },
  { name: 'scholar', label: 'Google Scholar', type: 'url', placeholder: 'https://scholar.google.com/citations?user=...' },
  { name: 'email', label: '이메일 (비우면 숨김)', type: 'email', full: true },
  { name: 'labName', label: '연구실 이름' },
  { name: 'labUrl', label: '연구실 홈페이지', type: 'url' },
  { name: 'labDesc', label: '연구실 소개', type: 'textarea', rows: 3 },
  { name: 'education', label: '학력 — 한 줄에 하나: 기간 | 학교·학과 | 학위', type: 'textarea', rows: 3, placeholder: '2024 – 현재 | OO대학교 전자공학과 | 석사 과정' },
  { name: 'interests', label: '세부 연구 관심사 — 한 줄에 하나: 제목 | 설명', type: 'textarea', rows: 4 },
  { name: 'skills', label: '기술 스택 — 한 줄에 하나: 분류: 항목, 항목', type: 'textarea', rows: 4, placeholder: 'Simulation: MATLAB, HFSS' },
]

export function ProfileLinks({ about, size = 'md' }) {
  const l = about?.links || {}
  return (
    <div className="w-links">
      {safeUrl(l.github) && (
        <a className={`btn btn-${size} btn-dark`} href={l.github} target="_blank" rel="noreferrer">
          <Icon name="github" size={18} /> GitHub
        </a>
      )}
      {l.email && (
        <a className={`btn btn-${size} btn-weak`} href={`mailto:${l.email}`}>
          <Icon name="mail" size={18} /> 이메일
        </a>
      )}
      {safeUrl(l.scholar) && (
        <a className={`btn btn-${size} btn-ghost`} href={l.scholar} target="_blank" rel="noreferrer">
          <Icon name="cap" size={18} /> Google Scholar
        </a>
      )}
    </div>
  )
}

export default function About() {
  const { isAdmin } = useAdmin()
  const { data: a, ready } = useSiteData('about')
  const [editing, setEditing] = useState(false)
  useDocumentTitle(`내 소개 · ${a?.name || 'DUCKSEUL'}`)

  const onSubmit = async (v) => {
    await saveSiteData('about', fromForm(v, a), 'about: 내 소개 업데이트')
    toast('저장했어요. 1~2분 뒤 모든 방문자에게 반영돼요.')
    setEditing(false)
  }

  if (!ready) return <div className="page" />
  if (!a) return <section className="page container narrow">내 소개를 불러오지 못했어요.</section>

  // 항상 boolean 반환 (빈 배열의 length 0이 JSX에 「0」으로 찍히지 않도록)
  const showEmpty = (arr) => isAdmin || (Array.isArray(arr) && arr.length > 0)

  return (
    <section className="page about">
      <div className="container narrow">
        <article className="card about-hero">
          <div className="avatar lg" aria-hidden>
            <Icon name="wave" size={40} />
          </div>
          <div className="about-hero-body">
            {a.status && (
              <p className="status-pill">
                <span className="live" /> {a.status}
              </p>
            )}
            <h1 className="page-title">{a.name}</h1>
            <p className="w-aff">{a.affiliation}</p>
            {a.tagline && <p className="about-tagline">{a.tagline}</p>}
            {a.areas?.length > 0 && (
              <ul className="kw">
                {a.areas.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
            <ProfileLinks about={a} />
          </div>
          {isAdmin && (
            <button className="btn btn-sm btn-ghost about-edit" onClick={() => setEditing(true)}>
              <Icon name="pen" size={16} /> 수정
            </button>
          )}
        </article>

        {showEmpty(a.education) && (
          <article className="card">
            <h2 className="card-title">
              <Icon name="cap" size={20} /> 학력
            </h2>
            {a.education?.length > 0 ? (
              <ol className="timeline">
                {a.education.map((e, i) => (
                  <li key={i}>
                    <span className="tl-period">{e.period}</span>
                    <div>
                      <strong>{e.school}</strong>
                      {e.degree && <span>{e.degree}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">아직 입력하지 않았어요. 오른쪽 위 「수정」에서 추가해 주세요.</p>
            )}
          </article>
        )}

        {(a.lab?.name || a.lab?.desc) && (
          <article className="card">
            <h2 className="card-title">
              <Icon name="antenna" size={20} /> 소속 연구실
            </h2>
            <h3 className="lab-name">
              {a.lab.name}
              {safeUrl(a.lab.url) && (
                <a href={a.lab.url} target="_blank" rel="noreferrer" aria-label="연구실 홈페이지">
                  <Icon name="external" size={16} />
                </a>
              )}
            </h3>
            {a.lab.desc ? <p className="about-text">{a.lab.desc}</p> : isAdmin && <p className="muted">연구실 소개를 입력해 주세요.</p>}
          </article>
        )}

        {showEmpty(a.interests) && (
          <article className="card">
            <h2 className="card-title">
              <Icon name="spark" size={20} /> 세부 연구 관심사
            </h2>
            <ul className="interest-grid">
              {(a.interests || []).map((it, i) => (
                <li key={it.title}>
                  <span className={`area-dot c${i % 3}`} />
                  <strong>{it.title}</strong>
                  {it.desc && <span>{it.desc}</span>}
                </li>
              ))}
            </ul>
          </article>
        )}

        {showEmpty(a.skills) && (
          <article className="card">
            <h2 className="card-title">
              <Icon name="code" size={20} /> 보유 기술 스택
            </h2>
            <dl className="skills">
              {(a.skills || []).map((s) => (
                <div key={s.group}>
                  <dt>{s.group}</dt>
                  <dd>
                    {s.items.map((x) => (
                      <span key={x} className="chip">
                        {x}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        )}
      </div>

      <FormModal
        open={isAdmin && editing}
        title="내 소개 수정"
        fields={FIELDS}
        initial={toForm(a)}
        onSubmit={onSubmit}
        onClose={() => setEditing(false)}
        width={680}
      />
    </section>
  )
}
