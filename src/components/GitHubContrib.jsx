// 홈: GitHub 잔디(최근 1년 Contribution) — 토큰 없이 공개 API 사용 (CORS 허용)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
const EDGE = 12 // 뷰포트 좌우·상하 최소 여백
const GAP = 8 // 칸과 툴팁 사이 간격

/** 툴팁: body 포털로 띄워 카드 overflow·쌓임 맥락과 무관하게 항상 맨 위에 표시, 화면 안으로 위치 보정 */
function ContribTip({ tip }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const r = tip.rect
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(cx - width / 2, EDGE), Math.max(EDGE, vw - EDGE - width))
    // 위쪽 한계: 상단 고정 내비 아래 (내비가 화면에 걸쳐 있을 때)
    const nav = document.querySelector('body > #root header.header, header.header')?.getBoundingClientRect()
    const minTop = Math.max(EDGE, nav && nav.bottom > 0 ? nav.bottom + 4 : 0)
    const below = r.top - GAP - height < minTop && r.bottom + GAP + height <= vh - EDGE
    const top = below ? r.bottom + GAP : r.top - GAP - height
    // 화살표는 칸 중앙을 가리키도록 (툴팁 안쪽 범위로 제한)
    const arrow = Math.min(Math.max(cx - left, 10), width - 10)
    setPos({ left, top, below, arrow })
  }, [tip])
  return createPortal(
    <div
      ref={ref}
      className={`gh-tip${pos?.below ? ' is-below' : ''}`}
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top, '--arrow-x': `${pos.arrow}px` } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {tip.text}
    </div>,
    document.body,
  )
}

const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`

export default function GitHubContrib() {
  const { data, loading, error } = useContributions()
  const [tip, setTip] = useState(null)
  const gridRef = useRef(null)

  // 다른 곳 터치·클릭, 스크롤, 화면 크기 변경, Esc → 닫기
  useEffect(() => {
    if (!tip) return
    const close = () => setTip(null)
    const onDown = (e) => {
      if (!gridRef.current?.contains(e.target)) close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [tip])

  const show = (el, c, pinned) =>
    setTip({
      key: c.date,
      pinned,
      rect: el.getBoundingClientRect(),
      text: `${fmt(parse(c.date))} · ${c.count ? `${c.count}개의 contribution` : 'contribution 없음'}`,
    })

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
              <div
                className="gh-grid"
                ref={gridRef}
                role="img"
                aria-label={`최근 1년 동안 ${total}개의 contribution`}
                onMouseLeave={() => setTip((t) => (t?.pinned ? t : null))}
              >
                {grid.cells.map((c, i) =>
                  c ? (
                    <span
                      key={c.date}
                      className={`gh-cell${tip?.key === c.date ? ' is-active' : ''}`}
                      data-l={c.level}
                      onMouseEnter={(e) => {
                        if (!tip?.pinned) show(e.currentTarget, c, false)
                      }}
                      onClick={(e) => {
                        // 클릭·터치: 같은 칸이면 닫고, 아니면 고정 표시
                        if (tip?.pinned && tip.key === c.date) setTip(null)
                        else show(e.currentTarget, c, true)
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
          {tip && <ContribTip tip={tip} />}
        </>
      )}
    </section>
  )
}
