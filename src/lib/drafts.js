// 작성 중 임시저장: 기본은 localStorage, 사진이 많아 용량(약 5MB)을 넘으면 IndexedDB로 대체
import { get, set, del } from 'idb-keyval'

export async function saveDraft(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return 'local'
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    await set(key, data)
    return 'idb'
  }
}

export async function loadDraft(key) {
  try {
    const s = localStorage.getItem(key)
    if (s) return JSON.parse(s)
  } catch {
    /* ignore */
  }
  try {
    return (await get(key)) || null
  } catch {
    return null
  }
}

export async function clearDraft(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  try {
    await del(key)
  } catch {
    /* ignore */
  }
}

export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 10) return '방금 전'
  if (s < 60) return `${s}초 전`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}분 전`
  return new Date(ts).toTimeString().slice(0, 5)
}
