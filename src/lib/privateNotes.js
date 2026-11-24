// '나에게만 보기' 비공개 글 저장소
// - 공개 저장소(DUCKSEUL.github.io)는 public이라 비공개 글을 커밋하면 누구나 볼 수 있음
// - 그래서 비공개 글은 관리자 GitHub 계정의 별도 **private** 저장소의 private-posts.json 한 파일에 저장
// - 관리자(PAT 인증 완료)일 때만 이 모듈의 API를 호출합니다. 방문자 화면에서는 요청 자체가 없음.
import { gh } from './admin.js'
import { REPO } from '../config.js'

export const DEFAULT_PRIVATE_REPO = 'duckseul-private-notes'
export const PRIVATE_FILE = 'private-posts.json'
const KEY = 'admin-private-repo'

export function getPrivateRepoName() {
  try {
    return (localStorage.getItem(KEY) || '').trim() || DEFAULT_PRIVATE_REPO
  } catch {
    return DEFAULT_PRIVATE_REPO
  }
}

export function setPrivateRepoName(name) {
  const v = String(name || '').trim()
  if (v && !/^[\w.-]{1,100}$/.test(v)) throw new Error('저장소 이름은 영문·숫자·-·_·. 만 쓸 수 있어요.')
  try {
    if (!v || v === DEFAULT_PRIVATE_REPO) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, v)
  } catch {
    /* ignore */
  }
  return v || DEFAULT_PRIVATE_REPO
}

/** 비공개 저장소 위치: 로그인한 GitHub 계정 소유 */
export function privateRepo(login) {
  return { owner: login || REPO.owner, name: getPrivateRepoName() }
}

const base = ({ owner, name }) => `/repos/${owner}/${name}`

// ── UTF-8 ↔ base64 ─────────────────────────
function toB64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function fromB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function guide(repo, status) {
  const err = new Error(
    status === 403 || status === 404
      ? `비공개 저장소 ${repo.owner}/${repo.name}에 접근할 권한이 없어요. 토큰(또는 GitHub 앱)의 저장소 접근 범위에 이 저장소를 추가하고 Contents: Read and write 권한을 주세요.`
      : `비공개 저장소를 읽지 못했어요 (${status}).`,
  )
  err.status = status
  err.code = 'no-access'
  return err
}

/**
 * 비공개 글 목록 읽기
 * @returns {{ posts: object[], sha: string|null, state: 'ok'|'no-file'|'no-repo' }}
 */
export async function readPrivate(repo) {
  let meta
  try {
    meta = await gh(`${base(repo)}/contents/${PRIVATE_FILE}`)
  } catch (e) {
    if (e.status !== 404) throw e.status === 403 ? guide(repo, 403) : e
    // 파일이 없는지, 저장소 자체가 없는지(또는 접근 불가) 구분
    try {
      await gh(base(repo))
      return { posts: [], sha: null, state: 'no-file' }
    } catch (e2) {
      if (e2.status === 404) return { posts: [], sha: null, state: 'no-repo' }
      throw e2.status === 403 ? guide(repo, 403) : e2
    }
  }
  let text
  if (meta.content && meta.encoding === 'base64') text = fromB64(meta.content)
  else text = await gh(`${base(repo)}/contents/${PRIVATE_FILE}`, { accept: 'application/vnd.github.raw+json' }) // 1MB 초과 파일
  let posts = []
  try {
    const parsed = JSON.parse(text || '[]')
    posts = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.posts) ? parsed.posts : []
  } catch {
    throw new Error(`${PRIVATE_FILE} 형식이 올바르지 않아요.`)
  }
  return { posts, sha: meta.sha, state: 'ok' }
}

/** 비공개 저장소 생성 (auto_init으로 README 커밋까지) */
export async function createPrivateRepo(repo) {
  try {
    await gh('/user/repos', {
      method: 'POST',
      body: {
        name: repo.name,
        private: true,
        auto_init: true,
        description: 'DUCKSEUL 연구 일지 — 나에게만 보기(비공개) 글 저장소',
        has_issues: false,
        has_projects: false,
        has_wiki: false,
      },
    })
  } catch (e) {
    if (e.status === 422) return // 이미 있음
    const err = new Error(
      `비공개 저장소를 자동으로 만들 권한이 없어요 (${e.status}). GitHub에서 「${repo.name}」 이름의 Private 저장소를 직접 만든 뒤, 토큰의 저장소 접근 범위에 추가해 주세요.`,
    )
    err.status = e.status
    err.code = 'cannot-create'
    throw err
  }
  // 저장소가 막 만들어진 직후에는 contents API가 잠깐 404를 줄 수 있음
  for (let i = 0; i < 5; i++) {
    try {
      await gh(base(repo))
      return
    } catch {
      await new Promise((r) => setTimeout(r, 800))
    }
  }
}

export const newRepoUrl = (repo) => `https://github.com/new?name=${encodeURIComponent(repo.name)}&visibility=private`

const clean = ({ source, syncedAt, private: _p, ...p }) => p // eslint-disable-line no-unused-vars

const sortPosts = (list) => list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

/**
 * 최신 파일을 읽어 변경분(upserts/removes)만 합친 뒤 커밋. 저장소·파일이 없으면 만들고 진행.
 * 다른 기기에서 동시에 저장해 sha가 어긋나면 한 번 다시 읽어 재시도.
 */
export async function writePrivate(repo, { upserts = [], removes = [] }, message) {
  const run = async () => {
    let cur = await readPrivate(repo)
    if (cur.state === 'no-repo') {
      await createPrivateRepo(repo)
      cur = await readPrivate(repo)
      if (cur.state === 'no-repo') throw guide(repo, 404)
    }
    const touched = new Set([...removes, ...upserts.map((p) => p.id)])
    const merged = sortPosts([...cur.posts.filter((p) => !touched.has(p.id)), ...upserts.map(clean)])
    await gh(`${base(repo)}/contents/${PRIVATE_FILE}`, {
      method: 'PUT',
      body: {
        message,
        content: toB64(JSON.stringify(merged, null, 2) + '\n'),
        ...(cur.sha ? { sha: cur.sha } : {}),
      },
    })
    return merged
  }
  try {
    return await run()
  } catch (e) {
    if (e.code) throw e
    if (e.status === 409 || e.status === 422) return run()
    if (e.status === 403 || e.status === 404) throw guide(repo, e.status)
    throw e
  }
}
