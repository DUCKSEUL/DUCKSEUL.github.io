// 홈: GitHub 잔디(최근 1년 Contribution) — 토큰 없이 공개 API 사용 (CORS 허용)
import { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'

const USER = 'DUCKSEUL'
const API = `https://github-contributions-api.jogruber.de/v4/${USER}?y=last`
const CACHE_KEY = 'gh-contrib-v1'
const CACHE_MS = 60 * 60 * 1000
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    return c && Date.now() - c.at < CACHE_MS ? c.data : null
  } catch {
    return null
  }
}

function useContributions() {
  const [state, setState] = useState(() => {
    const data = readCache()
    return { data, error: null, loading: !data }
  })
  useEffect(() => {
    if (state.data) return
    let alive = true
    fetch(API)
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then((data) => {
        if (!alive) return
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
        } catch {
          /* ignore */
        }
        setState({ data, error: null, loading: false })
      })
      .catch((e) => alive && setState({ data: null, error: e, loading: false }))
    return () => {
      alive = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

const parse = (d) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}
const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`

export default function GitHubContrib() {
  const { data, loading, error } = useContributions()
  const [tip, setTip] = useState(null)

  const grid = useMemo(() => {
    const days = data?.contributions || []
    if (!days.length) return null
    const pad = parse(days[0].date).getDay() // 첫 주의 일요일 이전 칸
    const cells = [...Array(pad).fill(null), ...days]
    const cols = Math.ceil(cells.length / 7)
    const months = []
    let last = -1
    for (let c = 0; c < cols; c++) {
      const first = cells.slice(c * 7, c * 7 + 7).find(Boolean)
      if (!first) continue
      const m = parse(first.date).getMonth()
      if (m !== last) {
        // 라벨이 3주 안에 겹치면 앞(잘린 첫 달) 라벨을 빼고 새 달을 표시
        if (months.length && c - months[months.length - 1].col < 3) months.pop()
        if (c < cols - 1) months.push({ col: c, label: MONTHS[m] })
        last = m
      }
    }
    return { cells, cols, months }
  }, [data])

  const total = data?.total?.lastYear ?? data?.contributions?.reduce((s, d) => s + d.count, 0) ?? 0

  return (
    <section className="widget w-github" style={{ gridArea: 'github' }} aria-label="GitHub 잔디">
      <header className="widget-head">
        <h2>
          <Icon name="github" size={18} /> GitHub 잔디
          {grid && <span className="gh-total">최근 1년 {total.toLocaleString()} contributions</span>}
        </h2>
        <a className="w-more" href={`https://github.com/${USER}`} target="_blank" rel="noreferrer">
          @{USER} <Icon name="external" size={14} />
        </a>
      </header>
      {loading ? (
        <div className="w-skel" style={{ height: 120 }} />
      ) : error || !grid ? (
        <p className="w-empty">잔디 데이터를 불러오지 못했어요.</p>
      ) : (
        <>
          <div className="gh-wrap">
            <div className="gh-graph">
              <div className="gh-months" aria-hidden>
                {grid.months.map((m) => (
                  <span key={m.col} style={{ left: `${(m.col / grid.cols) * 100}%` }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="gh-days" aria-hidden>
                {['', '월', '', '수', '', '금', ''].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="gh-grid" role="img" aria-label={`최근 1년 동안 ${total}개의 contribution`} onMouseLeave={() => setTip(null)}>
                {grid.cells.map((c, i) =>
                  c ? (
                    <span
                      key={c.date}
                      className="gh-cell"
                      data-l={c.level}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setTip({ x: r.left + r.width / 2, y: r.top, text: `${fmt(parse(c.date))} · ${c.count ? `${c.count}개의 contribution` : 'contribution 없음'}` })
                      }}
                    />
                  ) : (
                    <span key={`pad-${i}`} className="gh-cell is-pad" />
                  ),
                )}
              </div>
            </div>
          </div>
          <div className="gh-foot">
            <span>잔디 데이터: GitHub 공개 활동 (1시간마다 갱신)</span>
            <span className="gh-legend" aria-hidden>
              적음 {[0, 1, 2, 3, 4].map((l) => <span key={l} className="gh-cell" data-l={l} />)} 많음
            </span>
          </div>
          {tip && (
            <div className="gh-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
              {tip.text}
            </div>
          )}
        </>
      )}
    </section>
  )
}
