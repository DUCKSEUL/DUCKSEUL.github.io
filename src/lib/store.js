// 연구 일지 저장소
// - 공개 글: public/data/posts.json (저장소에 커밋되어 모든 방문자에게 보임, 실행 시 fetch)
// - 로컬 글: 이 브라우저의 IndexedDB (관리자가 작성/수정 중이거나 GitHub 발행·배포를 기다리는 글)
// 같은 id면 로컬 글이 공개 글을 덮어씁니다.
// 로컬 기록의 syncedAt: GitHub에 커밋까지 끝났고 사이트 배포를 기다리는 중이라는 표시.
//   배포가 끝나 posts.json에 같은(또는 더 새) 버전이 보이면 로컬 기록은 자동으로 정리됩니다.
import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import { POSTS_URL } from '../config.js'

const KEY = 'journal-local-v1'

let published = []
let publishedIds = new Set()
let local = []
let ready = false
const listeners = new Set()

function compute() {
  const map = new Map()
  for (const p of published) map.set(p.id, { ...p, source: 'published' })
  for (const p of local) {
    if (p.deleted) map.delete(p.id)
    else if (p.syncedAt) map.set(p.id, { ...p, source: 'syncing' })
    else map.set(p.id, { ...p, source: publishedIds.has(p.id) ? 'modified' : 'local' })
  }
  return [...map.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

let snapshot = { posts: compute(), ready }

function emit() {
  snapshot = { posts: compute(), ready }
  listeners.forEach((l) => l())
}

/** 배포가 끝나 공개 글에 반영된 로컬 기록 정리 */
function prune() {
  const byId = new Map(published.map((p) => [p.id, p]))
  const before = local.length
  local = local.filter((p) => {
    if (!p.syncedAt) return true
    const pub = byId.get(p.id)
    if (p.deleted) return !!pub
    return !(pub && (pub.updatedAt || '') >= (p.updatedAt || ''))
  })
  return local.length !== before
}

async function loadLocal() {
  try {
    return (await get(KEY)) || []
  } catch {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      return []
    }
  }
}

async function loadPublished() {
  try {
    const res = await fetch(POSTS_URL, { cache: 'no-cache' })
    if (!res.ok) throw new Error(res.status)
    const list = await res.json()
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('[journal] posts.json을 불러오지 못했어요:', e)
    return []
  }
}

async function load() {
  const [pub, loc] = await Promise.all([loadPublished(), loadLocal()])
  published = pub
  publishedIds = new Set(pub.map((p) => p.id))
  local = loc
  ready = true
  if (prune()) persist().catch(() => {})
  emit()
}
load()

async function persist() {
  try {
    await set(KEY, local)
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(local))
    } catch (e) {
      console.warn('[journal] 저장 실패:', e)
      throw e
    }
  }
}

export function usePosts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
  )
}

const clean = (p) => {
  const { source, syncedAt, ...rest } = p // eslint-disable-line no-unused-vars
  return rest
}

export async function savePost(post) {
  const rec = clean(post)
  const i = local.findIndex((p) => p.id === rec.id)
  if (i >= 0) local[i] = rec
  else local.push(rec)
  emit()
  await persist()
}

/** 공개 글이면 삭제 표시를 남기고(발행 필요) true, 로컬에만 있던 글이면 바로 지우고 false */
export async function deletePost(id) {
  local = local.filter((p) => p.id !== id)
  const isPublished = publishedIds.has(id)
  if (isPublished) local.push({ id, deleted: true, updatedAt: new Date().toISOString() })
  emit()
  await persist()
  return isPublished
}

/** GitHub에 아직 발행하지 않은 로컬 변경사항 */
export function getPendingChanges() {
  const pending = local.filter((p) => !p.syncedAt)
  return {
    upserts: pending.filter((p) => !p.deleted && !p.draft),
    deletes: pending.filter((p) => p.deleted && publishedIds.has(p.id)).map((p) => p.id),
  }
}

/** 커밋이 끝난 글들을 "배포 대기"로 표시 (배포 후 자동 정리) */
export async function markSynced(ids) {
  const set_ = new Set(ids)
  const now = Date.now()
  local = local.map((p) => (set_.has(p.id) && !p.syncedAt ? { ...p, syncedAt: now } : p))
  emit()
  await persist()
}

export async function importPosts(list) {
  let n = 0
  for (const raw of list) {
    if (!raw || typeof raw.html !== 'string') continue
    const rec = clean({
      id: raw.id || newId(),
      title: raw.title || '제목 없음',
      category: raw.category || '연구 노트',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      draft: !!raw.draft,
      html: raw.html,
    })
    const i = local.findIndex((p) => p.id === rec.id)
    if (i >= 0) local[i] = rec
    else local.push(rec)
    n++
  }
  emit()
  await persist()
  return n
}

export function newId() {
  return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function postText(html) {
  return html
    .replace(/<(span|div)[^>]*data-type="math-(inline|block)"[^>]*>[\s\S]*?<\/\1>/g, ' [수식] ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function postThumb(html) {
  return html.match(/<img[^>]+src="([^"]+)"/)?.[1] || null
}

export function formatDateTime(iso, withTime = true) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date
}
