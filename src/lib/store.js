// 연구 일지 저장소
// - 공개 글: public/data/posts.json (저장소에 커밋되어 모든 방문자에게 보임, 실행 시 fetch)
// - 로컬 글: 이 브라우저의 IndexedDB (관리자가 작성/수정 중이거나 GitHub 발행·배포를 기다리는 글)
// 같은 id면 로컬 글이 공개 글을 덮어씁니다.
// 로컬 기록의 syncedAt: GitHub에 커밋까지 끝났고 사이트 배포를 기다리는 중이라는 표시.
//   배포가 끝나 posts.json에 같은(또는 더 새) 버전이 보이면 로컬 기록은 자동으로 정리됩니다.
// 비공개 글: 관리자 GitHub 계정의 private 저장소(private-posts.json) — 관리자 로그인 시에만 불러옴.
//   방문자 화면에서는 공개 글(posts.json)만 계산에 넣고, 비공개 저장소 API는 호출하지 않습니다.
import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import { POSTS_URL } from '../config.js'
import { onAdminChange, getAdminState } from './admin.js'

const KEY = 'journal-local-v1'

let published = []
let publishedIds = new Set()
let local = []
let ready = false
// 비공개 저장소 상태: off(방문자) | loading | ok | no-repo | no-file | error
let privatePosts = []
let privateStatus = { state: 'off' }
const listeners = new Set()

const isAdminNow = () => getAdminState().status === 'admin'

function compute() {
  const map = new Map()
  for (const p of published) map.set(p.id, { ...p, source: 'published' })
  // 방문자: 공개 글만 (이 브라우저에 남은 로컬 기록·비공개 글은 절대 섞지 않음)
  if (!isAdminNow()) return [...map.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  for (const p of local) {
    if (p.deleted) map.delete(p.id)
    else if (p.syncedAt) map.set(p.id, { ...p, source: 'syncing' })
    else map.set(p.id, { ...p, source: publishedIds.has(p.id) ? 'modified' : 'local' })
  }
  // 비공개 저장소의 글이 가장 우선 (공개본이 배포에서 빠지기 전까지도 비공개로 보이도록)
  for (const p of privatePosts) map.set(p.id, { ...p, draft: true, private: true, source: 'private', hasPublic: publishedIds.has(p.id) })
  return [...map.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

let snapshot = { posts: compute(), ready, privateStatus }

function emit() {
  snapshot = { posts: compute(), ready, privateStatus }
  listeners.forEach((l) => l())
}

// ── 비공개 저장소 연동 (관리자 전용) ─────────────
const privateApi = () => import('./privateNotes.js')
let privateLoadSeq = 0

export async function refreshPrivate() {
  const { status, user } = getAdminState()
  if (status !== 'admin') return
  const seq = ++privateLoadSeq
  const { readPrivate, privateRepo } = await privateApi()
  const repo = privateRepo(user?.login)
  privateStatus = { ...privateStatus, state: 'loading', repo }
  emit()
  try {
    const res = await readPrivate(repo)
    if (seq !== privateLoadSeq || !isAdminNow()) return
    privatePosts = res.posts
    privateStatus = { state: res.state, repo, count: res.posts.length, loadedAt: Date.now() }
  } catch (e) {
    if (seq !== privateLoadSeq || !isAdminNow()) return
    privatePosts = []
    privateStatus = { state: 'error', repo, error: e.message }
  }
  emit()
}

let lastAdmin = isAdminNow()
onAdminChange(() => {
  const now = isAdminNow()
  if (now === lastAdmin) return
  lastAdmin = now
  if (now) refreshPrivate()
  else {
    // 로그아웃: 메모리의 비공개 글을 즉시 비움
    privateLoadSeq++
    privatePosts = []
    privateStatus = { state: 'off' }
  }
  emit()
})

function dropLocal(id) {
  local = local.filter((p) => p.id !== id || p.deleted)
}

/**
 * 비공개 저장소에 저장. unpublish면 공개 저장소에서도 삭제(공개 → 비공개 전환).
 * @returns {{ unpublished: boolean }}
 */
export async function savePrivatePost(post, { unpublish = false } = {}) {
  const { user } = getAdminState()
  if (!isAdminNow()) throw new Error('관리자 로그인이 필요해요.')
  const { writePrivate, privateRepo } = await privateApi()
  const repo = privateRepo(user?.login)
  const rec = clean({ ...post, draft: true })
  const wasRemote = unpublish && isOnRemote(rec.id) // 로컬 기록을 지우기 전에 판단
  privatePosts = await writePrivate(repo, { upserts: [rec] }, `private: 「${rec.title}」 저장`)
  privateStatus = { state: 'ok', repo, count: privatePosts.length, loadedAt: Date.now() }
  dropLocal(rec.id)
  let unpublished = false
  let unpublishError = null
  if (wasRemote) {
    try {
      const { publishChanges } = await import('./publish.js')
      await publishChanges({ deletes: [rec.id], message: `journal: 「${rec.title}」 비공개로 전환` })
      local.push({ id: rec.id, deleted: true, remote: true, updatedAt: new Date().toISOString(), syncedAt: Date.now() })
      unpublished = true
    } catch (e) {
      unpublishError = e.message
    }
  }
  emit()
  await persist().catch(() => {})
  return { unpublished, unpublishError }
}

/** 비공개 저장소에서 글 제거 (삭제 또는 공개로 전환 후) */
export async function removePrivatePost(id) {
  if (!privatePosts.some((p) => p.id === id)) return
  const { user } = getAdminState()
  const { writePrivate, privateRepo } = await privateApi()
  const repo = privateRepo(user?.login)
  const title = privatePosts.find((p) => p.id === id)?.title || id
  privatePosts = await writePrivate(repo, { removes: [id] }, `private: 「${title}」 제거`)
  privateStatus = { state: 'ok', repo, count: privatePosts.length, loadedAt: Date.now() }
  emit()
}

export const isPrivatePost = (id) => privatePosts.some((p) => p.id === id)

/** 이 브라우저(IndexedDB)에만 있는 예전 방식의 '나만 보기' 글 */
export function getLocalDrafts() {
  return local.filter((p) => p.draft && !p.deleted && !p.syncedAt && !privatePosts.some((x) => x.id === p.id))
}

/** 로컬 '나만 보기' 글을 비공개 저장소로 옮김 (공개본은 건드리지 않음) */
export async function migrateLocalDrafts() {
  const list = getLocalDrafts()
  if (!list.length) return 0
  const { user } = getAdminState()
  const { writePrivate, privateRepo } = await privateApi()
  const repo = privateRepo(user?.login)
  privatePosts = await writePrivate(repo, { upserts: list.map((p) => clean({ ...p, draft: true })) }, `private: 이 브라우저의 나만 보기 글 ${list.length}개 이전`)
  privateStatus = { state: 'ok', repo, count: privatePosts.length, loadedAt: Date.now() }
  for (const p of list) dropLocal(p.id)
  emit()
  await persist().catch(() => {})
  return list.length
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
  const { source, syncedAt, private: _private, hasPublic, ...rest } = p // eslint-disable-line no-unused-vars
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

/** 저장소에 올라가 있는(또는 커밋 후 배포 대기 중인) 글인지 */
export function isOnRemote(id) {
  const rec = local.find((p) => p.id === id)
  return publishedIds.has(id) || !!(rec && rec.syncedAt && !rec.deleted)
}

/** 저장소에 있는 글이면 삭제 표시를 남기고(발행 필요) true, 로컬에만 있던 글이면 바로 지우고 false */
export async function deletePost(id) {
  const remote = isOnRemote(id)
  local = local.filter((p) => p.id !== id)
  if (remote) local.push({ id, deleted: true, remote: true, updatedAt: new Date().toISOString() })
  emit()
  await persist()
  return remote
}

/** GitHub에 아직 발행하지 않은 로컬 변경사항 */
export function getPendingChanges() {
  const pending = local.filter((p) => !p.syncedAt)
  return {
    upserts: pending.filter((p) => !p.deleted && !p.draft),
    deletes: pending.filter((p) => p.deleted && (p.remote || publishedIds.has(p.id))).map((p) => p.id),
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

/** 지금 공개 저장소에 (삭제 예약 없이) 올라가 있는 글인지 — 공개/비공개 전환 판단용 */
export function isPubliclyListed(id) {
  if (local.some((p) => p.id === id && p.deleted)) return false
  return isOnRemote(id)
}
