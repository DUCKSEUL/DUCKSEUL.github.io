// 캘린더 일정: 공개 일정(events.json, 모두에게 보임) + 내 Google 캘린더(관리자 + Google 연결 시, 이 브라우저에만)
import { useEffect, useState } from 'react'
import { useSiteData } from './siteData.js'
import { useAdmin } from './admin.js'
import { useGoogle, listCalendarEvents, ymd } from './google.js'

const googleCache = new Map() // `${from}|${to}` -> events (메모리에만)

export function useEvents(from, to) {
  const { data, ready } = useSiteData('events')
  const { isAdmin } = useAdmin()
  const g = useGoogle()
  const canGoogle = isAdmin && g.connected && g.token?.calendar
  const key = `${ymd(from)}|${ymd(to)}`
  const [googleEvents, setGoogleEvents] = useState(() => (canGoogle ? googleCache.get(key) || [] : []))
  const [gLoading, setGLoading] = useState(false)
  const [gError, setGError] = useState('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!canGoogle) {
      setGoogleEvents([])
      return
    }
    let alive = true
    if (googleCache.has(key) && !nonce) {
      setGoogleEvents(googleCache.get(key))
      return
    }
    setGLoading(true)
    setGError('')
    listCalendarEvents(from, new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1))
      .then((list) => {
        googleCache.set(key, list)
        if (alive) setGoogleEvents(list)
      })
      .catch((e) => alive && setGError(e.message))
      .finally(() => alive && setGLoading(false))
    return () => {
      alive = false
    }
  }, [canGoogle, key, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자 로그아웃/연결 해제 시 메모리 캐시도 비움
  useEffect(() => {
    if (!canGoogle) googleCache.clear()
  }, [canGoogle])

  const lo = ymd(from)
  const hi = ymd(to)
  const publicEvents = (data?.items || []).map((e) => ({ ...e, source: 'public' }))
  const all = [...publicEvents, ...googleEvents]
    .filter((e) => (e.endDate || e.date) >= lo && e.date <= hi)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))

  return {
    events: all,
    publicData: data,
    ready,
    google: { enabled: canGoogle, loading: gLoading, error: gError, refresh: () => (googleCache.delete(key), setNonce((n) => n + 1)) },
  }
}

/** 날짜 d(YYYY-MM-DD)에 걸쳐 있는 일정 */
export const eventsOn = (events, d) => events.filter((e) => e.date <= d && (e.endDate || e.date) >= d)
