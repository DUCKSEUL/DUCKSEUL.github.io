// 공개 사이트 데이터(public/data/*.json): 내 소개 · 연구 실적 · 공개 일정 · 논문 레이더 · arXiv 피드
// - 모든 방문자: 배포된 /data/<name>.json 을 읽음
// - 관리자: 수정하면 GitHub 저장소에 커밋(→ Actions 자동 배포). 배포가 끝나기 전까지는
//   방금 저장한 내용을 이 브라우저에 잠시 보관해 바로 보여 주고, 배포본이 따라잡으면 자동으로 정리합니다.
//   (공개 데이터만 다루며, Google 토큰 등 비밀 정보는 이 모듈에 절대 넣지 않습니다.)
import { useEffect, useSyncExternalStore } from 'react'

const PENDING = (name) => `site-data-pending:${name}`
const store = new Map() // name -> { data, ready, error }
const listeners = new Set()
const loading = new Map()

function emit() {
  listeners.forEach((l) => l())
}

function readPending(name) {
  try {
    return JSON.parse(localStorage.getItem(PENDING(name)) || 'null')
  } catch {
    return null
  }
}

async function load(name) {
  if (loading.has(name)) return loading.get(name)
  const p = (async () => {
    let data = null
    let error = null
    try {
      const res = await fetch(`/data/${name}.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data = await res.json()
    } catch (e) {
      error = e
      console.warn(`[site-data] ${name}.json을 불러오지 못했어요:`, e)
    }
    const pending = readPending(name)
    if (pending) {
      if (!data || (pending.updatedAt || '') > (data.updatedAt || '')) data = pending
      else {
        try {
          localStorage.removeItem(PENDING(name))
        } catch {
          /* ignore */
        }
      }
    }
    store.set(name, { data, ready: true, error: data ? null : error })
    emit()
  })()
  loading.set(name, p)
  return p
}

const EMPTY = { data: null, ready: false, error: null }

/** @returns {{ data: any, ready: boolean, error: Error|null }} */
export function useSiteData(name) {
  useEffect(() => {
    load(name)
  }, [name])
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store.get(name) || EMPTY,
  )
}

/** 관리자: 데이터 저장 → 저장소 커밋 */
export async function saveSiteData(name, data, message) {
  const next = { ...data, updatedAt: new Date().toISOString() }
  const { publishJSON } = await import('./publish.js')
  await publishJSON(`public/data/${name}.json`, next, message || `site: ${name}.json 업데이트`)
  try {
    localStorage.setItem(PENDING(name), JSON.stringify(next))
  } catch {
    /* ignore */
  }
  store.set(name, { data: next, ready: true, error: null })
  emit()
  return next
}

export const newItemId = (prefix = 'i') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
