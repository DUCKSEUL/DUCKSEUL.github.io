// 관리자 모드: GitHub Personal Access Token(PAT)을 이 브라우저의 localStorage에만 저장하고,
// 저장소에 push 권한이 있는 토큰일 때만 글쓰기/수정/삭제/불러오기 UI를 보여 줍니다.
// ※ 화면을 숨기는 것은 편의 기능일 뿐, 실제 쓰기 권한은 GitHub 토큰이 결정합니다.
import { useSyncExternalStore } from 'react'
import { REPO } from '../config.js'

const KEY = 'admin-gh-token'
const API = 'https://api.github.com'

function readToken() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

// status: 'guest' | 'checking' | 'admin'
let state = { status: readToken() ? 'checking' : 'guest', user: null }
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

export async function login(token) {
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
    localStorage.setItem(KEY, token)
  } catch {
    throw new Error('이 브라우저에서는 localStorage를 쓸 수 없어요.')
  }
  setState({ status: 'admin', user })
  return user
}

export function logout() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  setState({ status: 'guest', user: null })
}

// 저장된 토큰이 있으면 페이지 로드 시 한 번 검증
;(async () => {
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
