// 상세 보기 사진 확대 모달 (고화질)
// - 이미지는 원본 픽셀(naturalWidth × naturalHeight)을 기준으로 width/height를 직접 지정해 그림
//   (transform: scale을 쓰지 않아 확대해도 브라우저가 원본에서 다시 샘플링 → 흐려지지 않음)
// - 화면 맞춤(Fit) ↔ 원본 100%(1:1) 전환: 버튼 · 사진 클릭 · 키 0/1
// - 확대/축소: + / − 버튼 · 키 +/− · 마우스 휠(커서 위치 기준) · 드래그로 이동
// - 닫기: Esc · 배경 클릭 · 오른쪽 위 ×
// - 갤러리: 글 안 사진이 2장 이상이면 ← → 키 · 좌우 화살표 버튼으로 이전·다음 (끝에서 처음으로 순환), 순서 표시 n / N
//   사진을 넘기면 배율·이동 위치는 화면 맞춤으로 초기화
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui.jsx'

const MIN = 0.05
const MAX = 8
const STEP = 1.25
const SLIDER_MIN = 25 // 줌 슬라이더 범위(%)
const SLIDER_MAX = 400
const PAD = 32 // 화면 맞춤 시 여백

export default function Lightbox({ items, index = 0, onIndex, onClose }) {
  const stageRef = useRef(null)
  const imgRef = useRef(null)
  const anchor = useRef(null) // 확대 기준점 { cx, cy, ix, iy } (화면 좌표, 이미지 원본 좌표)
  const drag = useRef(null)
  const [nat, setNat] = useState(null) // { w, h }
  const [scale, setScale] = useState(1)
  const [mode, setMode] = useState('fit') // 'fit' | 'free'
  const [wrapNote, setWrapNote] = useState(null) // 끝에서 순환할 때 잠깐 띄우는 안내

  const count = items?.length || 0
  const cur = count ? items[Math.min(Math.max(0, index), count - 1)] : null
  const src = cur?.src
  const alt = cur?.alt
  const multi = count > 1

  const go = useCallback(
    (dir) => {
      if (!multi) return
      const next = (index + dir + count) % count
      if (dir > 0 && next === 0) setWrapNote('마지막 사진 → 처음으로')
      else if (dir < 0 && next === count - 1) setWrapNote('첫 사진 → 마지막으로')
      else setWrapNote(null)
      onIndex?.(next)
    },
    [multi, index, count, onIndex],
  )

  useEffect(() => {
    if (!wrapNote) return
    const t = setTimeout(() => setWrapNote(null), 1400)
    return () => clearTimeout(t)
  }, [wrapNote, index])

  const fitScale = useCallback(() => {
    const el = stageRef.current
    if (!nat || !el) return 1
    const side = multi && el.clientWidth > 560 ? 48 : 0 // 좌우 화살표 버튼 자리만큼 비워 사진을 가리지 않게
    return Math.min(1, (el.clientWidth - (PAD + side) * 2) / nat.w, (el.clientHeight - PAD * 2 - 56) / nat.h)
  }, [nat, multi])

  // 사진이 바뀌면 초기화: 화면 맞춤 · 이동(스크롤) 위치 처음으로 · 진행 중이던 확대 기준점 취소
  useLayoutEffect(() => {
    setNat(null)
    setMode('fit')
    anchor.current = null
    drag.current = null
    const el = stageRef.current
    if (el) {
      el.scrollLeft = 0
      el.scrollTop = 0
    }
  }, [src, index])

  // 화면 맞춤 모드: 창 크기에 맞춰 다시 계산
  useLayoutEffect(() => {
    if (!nat || mode !== 'fit') return
    const apply = () => setScale(fitScale())
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [nat, mode, fitScale])

  // 기준점(커서/클릭 위치)이 확대 후에도 같은 화면 위치에 오도록 스크롤 보정
  useLayoutEffect(() => {
    const a = anchor.current
    const el = stageRef.current
    const img = imgRef.current
    if (!a || !el || !img) return
    anchor.current = null
    const r = img.getBoundingClientRect()
    el.scrollLeft += r.left + a.ix * scale - a.cx
    el.scrollTop += r.top + a.iy * scale - a.cy
  }, [scale])

  const zoomTo = useCallback(
    (next, cx, cy) => {
      const img = imgRef.current
      if (!img || !nat) return
      next = Math.min(MAX, Math.max(MIN, next))
      const r = img.getBoundingClientRect()
      if (cx == null) {
        cx = window.innerWidth / 2
        cy = window.innerHeight / 2
      }
      // 이미지 밖을 기준으로 하면 가장 가까운 가장자리 기준
      const ix = Math.min(nat.w, Math.max(0, (cx - r.left) / scale))
      const iy = Math.min(nat.h, Math.max(0, (cy - r.top) / scale))
      anchor.current = { cx, cy, ix, iy }
      setMode('free')
      setScale(next)
    },
    [nat, scale],
  )

  const toggle = useCallback(
    (cx, cy) => {
      if (Math.abs(scale - 1) > 0.001) zoomTo(1, cx, cy)
      else setMode('fit')
    },
    [scale, zoomTo],
  )

  // 키보드
  useEffect(() => {
    if (!src) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') onClose()
      // 슬라이더에 포커스가 있어도 ← → 는 사진 넘기기 (배율 조절은 슬라이더 드래그 · +/− 키)
      else if (e.key === 'ArrowRight' && multi) go(1)
      else if (e.key === 'ArrowLeft' && multi) go(-1)
      else if (e.key === '+' || e.key === '=') zoomTo(scale * STEP)
      else if (e.key === '-' || e.key === '_') zoomTo(scale / STEP)
      else if (e.key === '0') setMode('fit')
      else if (e.key === '1') zoomTo(1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    // 캡처 단계: 포커스된 슬라이더가 화살표 키로 값을 바꾸기 전에 처리
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [src, onClose, zoomTo, scale, multi, go])

  // 배경 스크롤 잠금
  useEffect(() => {
    if (!src) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [src])

  // 마우스 휠 줌 (passive가 아니어야 페이지 스크롤을 막을 수 있음)
  useEffect(() => {
    const el = stageRef.current
    if (!el || !nat) return
    const onWheel = (e) => {
      e.preventDefault()
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015))
      zoomTo(scale * f, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [nat, scale, zoomTo])

  if (!src) return null

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('.lb-bar, .lightbox-close')) return
    const el = stageRef.current
    drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    stageRef.current.scrollLeft = d.sl - dx
    stageRef.current.scrollTop = d.st - dy
  }
  const onPointerUp = () => {
    setTimeout(() => (drag.current = null))
  }
  const onStageClick = (e) => {
    if (drag.current?.moved) return
    if (e.target === imgRef.current) toggle(e.clientX, e.clientY)
    else if (!e.target.closest('.lb-bar, .lightbox-close, .lightbox-caption')) onClose()
  }

  const pct = Math.round(scale * 100)
  const isOne = Math.abs(scale - 1) < 0.001
  const big = nat && (nat.w * scale > (stageRef.current?.clientWidth || 0) || nat.h * scale > (stageRef.current?.clientHeight || 0))

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <div
        ref={stageRef}
        className={`lb-stage ${big ? 'is-big' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onStageClick}
      >
        <div className="lb-canvas">
          <img
            key={`${index}|${src}`} // 사진마다 새 요소 → 같은 주소여도 onLoad로 크기 다시 계산
            ref={imgRef}
            src={src}
            alt={alt || ''}
            draggable={false}
            decoding="async"
            className={`${isOne ? 'is-one' : ''} ${scale >= 3 ? 'is-pixel' : ''}`}
            style={nat ? { width: nat.w * scale, height: nat.h * scale } : { visibility: 'hidden' }}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            title={isOne ? '클릭하면 화면 맞춤' : '클릭하면 원본 100%'}
          />
        </div>
      </div>

      <button className="lightbox-close" onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
        <Icon name="close" size={26} />
      </button>

      {multi && (
        <>
          <button type="button" className="lb-nav is-prev" onClick={() => go(-1)} aria-label="이전 사진" title="이전 사진 (←)">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="lb-nav is-next" onClick={() => go(1)} aria-label="다음 사진" title="다음 사진 (→)">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {wrapNote && (
            <div className="lb-wrap-note" role="status" key={`${wrapNote}|${index}`}>
              {wrapNote}
            </div>
          )}
        </>
      )}

      <div
        className="lb-bar"
        role="toolbar"
        aria-label="확대 도구"
        // 슬라이더 드래그·버튼 조작이 배경 닫기·팬으로 번지지 않게
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {multi && (
          <>
            <span className="lb-count" aria-live="polite" aria-label={`${count}장 중 ${index + 1}번째 사진`}>
              {index + 1} / {count}
            </span>
            <span className="lb-sep lb-sep-count" />
          </>
        )}
        <button type="button" className="lb-step" onClick={() => zoomTo(scale / STEP)} aria-label="축소" title="축소 (−)">
          −
        </button>
        <input
          type="range"
          className="lb-slider"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, pct))}
          onChange={(e) => zoomTo(Number(e.target.value) / 100)}
          aria-label="확대 배율"
          aria-valuetext={`${pct}%`}
          title="드래그해서 확대·축소"
          style={{ '--fill': `${((Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, pct)) - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%` }}
        />
        <button type="button" className="lb-step" onClick={() => zoomTo(scale * STEP)} aria-label="확대" title="확대 (+)">
          +
        </button>
        <span className="lb-pct" aria-live="polite">
          {pct}%
        </span>
        <span className="lb-sep" />
        <button type="button" className={mode === 'fit' ? 'is-on' : ''} onClick={() => setMode('fit')} title="화면 맞춤 (0)">
          화면 맞춤
        </button>
        <button type="button" className={isOne ? 'is-on' : ''} onClick={() => zoomTo(1)} title="원본 100% (1)">
          1:1
        </button>
        {nat && (
          <span className="lb-size" title="원본 해상도">
            {nat.w} × {nat.h}
          </span>
        )}
      </div>
      {alt && <p className="lightbox-caption">{alt}</p>}
    </div>,
    document.body,
  )
}
