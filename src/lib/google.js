// Google Calendar 연동 (브라우저 전용 · Google Identity Services Token Client)
// ─ 보안 설계 ─────────────────────────────────────────────────────────────
// • 공개용 OAuth Client ID만 사용합니다. Client Secret은 쓰지도, 저장소에 두지도 않습니다.
// • 권한은 읽기 전용 1개만 요청: calendar.readonly
// • Access Token은 메모리 + sessionStorage(탭을 닫으면 사라짐)에만 보관합니다.
//   localStorage·IndexedDB·GitHub 저장소(JSON 커밋)에는 절대 기록하지 않습니다.
// • 관리자 모드에서만 연결할 수 있고, 관리자 로그아웃 시 토큰을 즉시 폐기합니다.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config.js'

const TOKEN_KEY = 'google-access-token' // sessionStorage 전용
const CLIENT_ID_KEY = 'google-client-id' // 공개 값(비밀 아님)이라 이 브라우저 설정으로 보관
const GIS_SRC = 'https://accounts.google.com/gsi/client'

function readSessionToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
    return t && t.expiresAt > Date.now() + 30_000 ? t : null
  } catch {
    return null
  }
}

let state = { token: readSessionToken(), connecting: false, error: null }
const listeners = new Set()
function setState(next) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useGoogle() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
  return { ...s, connected: !!s.token, clientId: getClientId() }
}

export function getClientId() {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID
  try {
    return localStorage.getItem(CLIENT_ID_KEY) || ''
  } catch {
    return ''
  }
}

const CLIENT_ID_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/

export function setClientId(id) {
  id = id.trim()
  if (id && !CLIENT_ID_RE.test(id)) throw new Error('Client ID 형식이 올바르지 않아요. (숫자-문자열.apps.googleusercontent.com)')
  try {
    if (id) localStorage.setItem(CLIENT_ID_KEY, id)
    else localStorage.removeItem(CLIENT_ID_KEY)
  } catch {
    /* ignore */
  }
  disconnect()
  setState({})
}

let gisPromise = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GIS_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        gisPromise = null
        reject(new Error('Google 로그인 스크립트를 불러오지 못했어요.'))
      }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

/** Google 계정 연결 (팝업으로 동의 → Access Token 발급) */
export async function connect() {
  const clientId = getClientId()
  if (!clientId) throw new Error('먼저 Google OAuth Client ID를 입력해 주세요.')
  setState({ connecting: true, error: null })
  try {
    await loadGis()
    const resp = await new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES.join(' '),
        include_granted_scopes: false,
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
        error_callback: (e) => reject(new Error(e?.type === 'popup_closed' ? '로그인 창이 닫혔어요.' : e?.message || 'Google 로그인에 실패했어요.')),
      })
      client.requestAccessToken({ prompt: '' })
    })
    const granted = (resp.scope || '').split(' ')
    const token = {
      accessToken: resp.access_token,
      expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
      calendar: granted.includes(GOOGLE_SCOPES[0]),
    }
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
    } catch {
      /* 메모리에만 보관 */
    }
    setState({ token, connecting: false })
    return token
  } catch (e) {
    setState({ connecting: false, error: e.message })
    throw e
  }
}

/** 연결 해제: 토큰 폐기 + 저장된 토큰 삭제 */
export function disconnect() {
  const t = state.token
  if (t && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(t.accessToken, () => {})
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  if (state.token || state.error) setState({ token: null, error: null })
}

async function gapi(url) {
  const t = state.token
  if (!t || t.expiresAt < Date.now()) {
    disconnect()
    throw new Error('Google 연결이 만료됐어요. 다시 연결해 주세요.')
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t.accessToken}` } })
  if (res.status === 401) {
    disconnect()
    throw new Error('Google 연결이 만료됐어요. 다시 연결해 주세요.')
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).error?.message || msg
    } catch {
      /* ignore */
    }
    throw new Error(`Google API ${res.status}: ${msg}`)
  }
  return res.json()
}

/* ── Calendar (읽기 전용) ─────────────────────────────── */
export async function listCalendarEvents(timeMin, timeMax) {
  const q = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const data = await gapi(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`)
  return (data.items || [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => {
      const allDay = !!e.start?.date
      // 종일 일정의 end.date는 다음 날(배타적)이므로 하루 빼서 표시
      let endDate = allDay ? e.end?.date : (e.end?.dateTime || '').slice(0, 10)
      if (allDay && endDate) {
        const d = new Date(endDate + 'T00:00:00')
        d.setDate(d.getDate() - 1)
        endDate = ymd(d)
      }
      const startDate = allDay ? e.start.date : ymd(new Date(e.start.dateTime))
      return {
        id: `g-${e.id}`,
        title: e.summary || '(제목 없음)',
        date: startDate,
        endDate: endDate && endDate !== startDate ? endDate : '',
        time: allDay ? '' : new Date(e.start.dateTime).toTimeString().slice(0, 5),
        type: 'google',
        url: e.htmlLink || '',
        note: '',
        source: 'google',
      }
    })
}

export function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
