// 연구 일지 저장소
// - 공개 글: src/data/journal.json (저장소에 커밋되어 모든 방문자에게 보임)
// - 로컬 글: 이 브라우저의 IndexedDB에 자동 저장 (사용 불가 시 localStorage로 대체)
// 같은 id면 로컬 글이 공개 글을 덮어씁니다(수정본). 공개 글을 지우면 로컬에 삭제 표시만 남깁니다.
import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import published from '../data/journal.json'

const KEY = 'journal-local-v1'
const publishedIds = new Set(published.map((p) => p.id))

let local = []
let ready = false
const listeners = new Set()

function compute() {
  const map = new Map()
  for (const p of published) map.set(p.id, { ...p, source: 'published' })
  for (const p of local) {
    if (p.deleted) map.delete(p.id)
    else map.set(p.id, { ...p, source: publishedIds.has(p.id) ? 'modified' : 'local' })
  }
  return [...map.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

let snapshot = { posts: compute(), ready }

function emit() {
  snapshot = { posts: compute(), ready }
  listeners.forEach((l) => l())
}

async function load() {
  try {
    local = (await get(KEY)) || []
  } catch {
    try {
      local = JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      local = []
    }
  }
  ready = true
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
  const { source, ...rest } = p // eslint-disable-line no-unused-vars
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

export async function deletePost(id) {
  local = local.filter((p) => p.id !== id)
  if (publishedIds.has(id)) local.push({ id, deleted: true })
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
