// 브라우저에서 GitHub REST API(Git Data API)로 글 데이터와 사진을 저장소에 바로 커밋합니다.
// 한 번 발행할 때 posts.json + 새 사진 + 쓰지 않게 된 사진 삭제를 "커밋 1개"로 묶어 main에 push하고,
// main에 push가 일어나면 GitHub Actions(.github/workflows/deploy.yml)가 사이트를 다시 빌드·배포합니다.
import { gh } from './admin.js'
import { REPO, POSTS_PATH, IMAGE_DIR, IMAGE_URL } from '../config.js'

const R = `/repos/${REPO.owner}/${REPO.name}`
const EXT = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', 'svg+xml': 'svg' }
const DATA_IMG = /src="data:image\/([a-z+]+);base64,([^"]+)"/g
const SITE_IMG = new RegExp(`src="(${IMAGE_URL.replace(/\//g, '\\/')}\\/[^"]+)"`, 'g')

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 본문의 data URL 사진을 파일로 분리하고 src를 사이트 경로로 바꿉니다. */
async function extractImages(html, images) {
  const found = [...html.matchAll(DATA_IMG)]
  for (const [, type, b64] of found) {
    const ext = EXT[type]
    if (!ext) continue
    const name = `${(await sha256(b64)).slice(0, 16)}.${ext}`
    images.set(name, b64)
    html = html.split(`data:image/${type};base64,${b64}`).join(`${IMAGE_URL}/${name}`)
  }
  return html
}

const imageNames = (html = '') => [...html.matchAll(SITE_IMG)].map((m) => m[1].slice(IMAGE_URL.length + 1))

const clean = ({ source, syncedAt, ...p }) => p // eslint-disable-line no-unused-vars

async function listDir(path, ref) {
  try {
    const items = await gh(`${R}/contents/${path}?ref=${ref}`)
    return new Set(Array.isArray(items) ? items.map((i) => i.name) : [])
  } catch (e) {
    if (e.status === 404) return new Set()
    throw e
  }
}

async function readPosts(ref) {
  try {
    const text = await gh(`${R}/contents/${POSTS_PATH}?ref=${ref}`, { accept: 'application/vnd.github.raw+json' })
    const list = JSON.parse(text)
    return Array.isArray(list) ? list : []
  } catch (e) {
    if (e.status === 404) return []
    throw e
  }
}

async function attempt({ upserts, deletes, message }) {
  // 1. main 브랜치의 최신 커밋
  const ref = await gh(`${R}/git/ref/heads/${REPO.branch}`)
  const head = ref.object.sha
  const headCommit = await gh(`${R}/git/commits/${head}`)

  // 2. 저장소의 현재 posts.json에 변경분만 합침 (다른 기기에서 발행한 글을 덮어쓰지 않도록)
  const [remote, existingImages] = await Promise.all([readPosts(head), listDir(IMAGE_DIR, head)])
  const images = new Map()
  const processed = []
  for (const p of upserts) processed.push({ ...clean(p), html: await extractImages(p.html, images) })

  const touched = new Set([...deletes, ...processed.map((p) => p.id)])
  const merged = [...remote.filter((p) => !touched.has(p.id)), ...processed].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  )

  // 3. 더 이상 어떤 글에서도 쓰지 않는 사진은 삭제
  const before = new Set(remote.filter((p) => touched.has(p.id)).flatMap((p) => imageNames(p.html)))
  const inUse = new Set(merged.flatMap((p) => imageNames(p.html)))
  const unused = [...before].filter((n) => !inUse.has(n) && existingImages.has(n))

  // 4. 트리 구성: 새 사진(blob) + posts.json + 삭제
  const tree = []
  for (const [name, b64] of images) {
    if (existingImages.has(name)) continue
    const blob = await gh(`${R}/git/blobs`, { method: 'POST', body: { content: b64, encoding: 'base64' } })
    tree.push({ path: `${IMAGE_DIR}/${name}`, mode: '100644', type: 'blob', sha: blob.sha })
  }
  tree.push({ path: POSTS_PATH, mode: '100644', type: 'blob', content: JSON.stringify(merged, null, 2) + '\n' })
  for (const name of unused) tree.push({ path: `${IMAGE_DIR}/${name}`, mode: '100644', type: 'blob', sha: null })

  // 5. 커밋 생성 후 main을 앞으로 이동 (fast-forward만 허용)
  const newTree = await gh(`${R}/git/trees`, { method: 'POST', body: { base_tree: headCommit.tree.sha, tree } })
  const commit = await gh(`${R}/git/commits`, { method: 'POST', body: { message, tree: newTree.sha, parents: [head] } })
  await gh(`${R}/git/refs/heads/${REPO.branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } })

  return { commitUrl: commit.html_url, sha: commit.sha, posts: merged, uploaded: images.size, removed: unused.length }
}

/**
 * @param {{ upserts?: object[], deletes?: string[], message?: string }} changes
 */
export async function publishChanges({ upserts = [], deletes = [], message } = {}) {
  if (!upserts.length && !deletes.length) throw new Error('발행할 변경사항이 없어요.')
  const msg =
    message ||
    (upserts.length + deletes.length > 1
      ? `journal: ${upserts.length}개 발행, ${deletes.length}개 삭제`
      : upserts.length
        ? `journal: 「${upserts[0].title}」 발행`
        : `journal: ${deletes[0]} 삭제`)
  try {
    return await attempt({ upserts, deletes, message: msg })
  } catch (e) {
    // 그 사이 다른 커밋이 올라와 fast-forward가 안 되면 한 번 더 시도
    if (e.status === 422 || e.status === 409) return attempt({ upserts, deletes, message: msg })
    throw e
  }
}
