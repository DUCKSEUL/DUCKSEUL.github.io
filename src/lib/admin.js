// 관리자 모드: GitHub 토큰을 기본적으로 sessionStorage(탭·브라우저를 닫으면 자동 삭제)에만 보관하고,
//   「이 브라우저에 로그인 유지」를 직접 선택한 경우에만 localStorage에 둡니다.
// 저장소에 push 권한이 있는 토큰일 때만 글쓰기/수정/삭제/불러오기 UI를 보여 줍니다.
// ※ 화면을 숨기는 것은 편의 기능일 뿐, 실제 쓰기 권한은 GitHub 토큰이 결정합니다.
import { useSyncExternalStore } from 'react'
import { REPO, AUTH_URL } from '../config.js'
import { disconnect as disconnectGoogle } from './google.js'

const KEY = 'admin-gh-token'
const REMEMBER_KEY = 'admin-gh-remember' // '1'이면 localStorage 보관을 사용자가 선택한 상태
const NONCE_KEY = 'admin-gh-nonce'
const API = 'https://api.github.com'

function readToken() {
  try {
    const s = sessionStorage.getItem(KEY)
    if (s) return s
    const l = localStorage.getItem(KEY)
    if (!l) return ''
    if (localStorage.getItem(REMEMBER_KEY) === '1') return l
    // 예전 버전이 localStorage에 평문으로 남긴 토큰 → 이번 탭 세션으로 옮기고 영구 보관본은 삭제
    sessionStorage.setItem(KEY, l)
    localStorage.removeItem(KEY)
    return l
  } catch {
    return ''
  }
}

function storeToken(token, remember) {
  sessionStorage.setItem(KEY, token)
  if (remember) {
    localStorage.setItem(KEY, token)
    localStorage.setItem(REMEMBER_KEY, '1')
  } else {
    localStorage.removeItem(KEY)
    localStorage.removeItem(REMEMBER_KEY)
  }
}

/** 지금 토큰이 브라우저에 영구 보관 중인지 */
export function isTokenRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1' && !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}

// GitHub 로그인 후 돌아온 경우: 주소의 #gh_token=…&nonce=… 를 읽고 바로 지움
function takeRedirectResult() {
  if (typeof location === 'undefined' || !/[#&](gh_token|gh_error)=/.test(location.hash)) return null
  const params = new URLSearchParams(location.hash.slice(1))
  history.replaceState(history.state, '', location.pathname + location.search)
  let expected = null
  try {
    expected = sessionStorage.getItem(NONCE_KEY)
    sessionStorage.removeItem(NONCE_KEY)
  } catch {
    /* ignore */
  }
  if (!expected || params.get('nonce') !== expected) return { error: '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.' }
  if (params.get('gh_error')) return { error: params.get('gh_error') }
  return { token: params.get('gh_token') }
}
const redirectResult = takeRedirectResult()

// status: 'guest' | 'checking' | 'admin'
let state = { status: readToken() || redirectResult?.token ? 'checking' : 'guest', user: null, error: redirectResult?.error || null }
const listeners = new Set()
function setState(next) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useAdmin() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
  return { ...s, isAdmin: s.status === 'admin' }
}

export const hasGitHubLogin = !!AUTH_URL

/** GitHub 로그인 화면으로 이동 (Worker를 거쳐 다시 이 페이지로 돌아옴) */
export function loginWithGitHub() {
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  try {
    sessionStorage.setItem(NONCE_KEY, nonce)
  } catch {
    /* ignore */
  }
  const redirect = location.origin + location.pathname + location.search
  location.assign(`${AUTH_URL}/login?redirect=${encodeURIComponent(redirect)}&nonce=${nonce}`)
}

export function clearLoginMessages() {
  setState({ error: null, notice: null })
}

export function getToken() {
  return readToken()
}

export async function gh(path, { method = 'GET', body, token = readToken(), accept } = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers: {
      Accept: accept || 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).message || msg
    } catch {
      /* ignore */
    }
    const err = new Error(`GitHub API ${res.status}: ${msg}`)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return accept?.includes('raw') ? res.text() : res.json()
}

/** 토큰이 이 저장소에 push할 수 있는지 확인 */
async function verify(token) {
  const [user, repo] = await Promise.all([gh('/user', { token }), gh(`/repos/${REPO.owner}/${REPO.name}`, { token })])
  if (!repo.permissions?.push) {
    const err = new Error(`${REPO.owner}/${REPO.name} 저장소에 쓰기 권한이 없는 토큰이에요.`)
    err.status = 403
    throw err
  }
  return { login: user.login, avatar: user.avatar_url }
}

export async function login(token, { remember = false } = {}) {
  token = token.trim()
  if (!token) throw new Error('토큰을 입력해 주세요.')
  let user
  try {
    user = await verify(token)
  } catch (e) {
    if (e.status === 401) throw new Error('유효하지 않은 토큰이에요.')
    if (e.status === 404) throw new Error('저장소에 접근할 수 없는 토큰이에요. (Repository access 확인)')
    throw e
  }
  try {
    storeToken(token, remember)
  } catch {
    throw new Error('이 브라우저에서는 토큰을 보관할 수 없어요. (저장소 접근 차단)')
  }
  setState({ status: 'admin', user, error: null })
  return user
}

export function logout() {
  disconnectGoogle() // 관리자 로그아웃 시 Google 토큰도 즉시 폐기
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      store().removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(REMEMBER_KEY)
  } catch {
    /* ignore */
  }
  setState({ status: 'guest', user: null })
}

// 페이지 로드 시: GitHub 로그인에서 막 돌아왔으면 그 토큰으로, 아니면 저장된 토큰을 한 번 검증
;(async () => {
  if (redirectResult?.token) {
    try {
      const user = await login(redirectResult.token)
      setState({ notice: `관리자 모드가 켜졌어요. (${user.login})` })
    } catch (e) {
      setState({ status: 'guest', error: e.message })
    }
    return
  }
  const token = readToken()
  if (!token) return
  try {
    setState({ status: 'admin', user: await verify(token) })
  } catch (e) {
    // 만료·폐기·권한 없음이면 토큰을 지우고, 네트워크 오류면 토큰은 남겨 둔 채 방문자 화면으로
    if ([401, 403, 404].includes(e.status)) logout()
    else setState({ status: 'guest' })
  }
})()

/** 관리자 상태 변화 구독 (React 밖의 저장소 모듈용) */
export function onAdminChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function getAdminState() {
  return state
}
