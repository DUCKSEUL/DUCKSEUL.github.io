// 논문 레이더 데이터: Google Sheets
// ─ 데이터 소스 (public/data/radar.json 의 mode) ───────────────────────────
//  sample : 연결 전 기본 샘플
//  gviz   : 「링크가 있는 모든 사용자」 공유 시트 — 키 없이 gviz/tq 로 읽음
//  apikey : 공식 Sheets API v4 + 브라우저용 API Key (HTTP 리퍼러 + Sheets API로 제한된 공개 키)
//  oauth  : 공식 Sheets API v4 + GIS Token(spreadsheets.readonly) — 비공개 시트, 관리자 브라우저에서만
// ─ 보안 ──────────────────────────────────────────────────────────────────
//  Client Secret·OAuth 토큰은 어디에도 저장/커밋하지 않습니다. OAuth 토큰은 google.js가 메모리+sessionStorage에만 둡니다.
//  API Key는 원래 브라우저에 노출되는 공개 값이므로, 반드시 리퍼러·API 제한을 건 키만 사용합니다.
// ─ 정렬 ──────────────────────────────────────────────────────────────────
//  기록일(Date) 내림차순 = 최신 기록이 맨 위. 같은 날짜면 시트에서 나중에 추가된(아래쪽) 행이 위.
//  기록일이 없는 행은 날짜가 있는 행들 아래(시트 아래쪽 행이 위).
import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './admin.js'
import { useGoogle, gapi } from './google.js'

export const ROLE_DEFS = [
  { role: 'date', label: '기록일', names: ['기록일', '등록일', '날짜', '추가일', '기록 날짜', '큐레이션 날짜', '정리일', 'date', 'added', 'recorded', 'logged', 'curated'] },
  { role: 'title', label: '제목', names: ['제목', '논문 제목', '논문제목', '논문', 'title', 'paper', 'name'] },
  { role: 'authors', label: '저자', names: ['저자', '저자명', 'author', 'authors', 'by'] },
  { role: 'venue', label: '저널/학회', names: ['저널/학회', '저널', '학회', '출처', '게재지', '출판 정보', '출판', '게재', 'venue', 'journal', 'conference', 'source', 'publication'] },
  { role: 'year', label: '발행연도', names: ['발행연도', '연도', '년도', '출판연도', 'year', 'pub year', 'published'] },
  { role: 'tags', label: '키워드/태그', names: ['키워드/태그', '키워드', '태그', '분야', 'keyword', 'keywords', 'tag', 'tags', 'topic'] },
  { role: 'summary', label: '한줄요약', names: ['한줄요약', '한 줄 요약', '요약', '메모', 'summary', 'note', 'notes', 'tl;dr', 'abstract'] },
  { role: 'link', label: 'DOI/원문 링크', names: ['doi/원문 링크', '원문 링크', '원문', '링크', '주소', 'doi', 'url', 'link', 'pdf'] },
  { role: 'importance', label: '중요도', names: ['중요도', '중요', '우선순위', '순위/등급', '등급', '순위', 'importance', 'priority', 'rank', 'grade', 'star', 'stars', 'rating'] },
  { role: 'status', label: '읽음상태', names: ['읽음상태', '읽음 상태', '상태', '읽음', 'status', 'read', 'state'] },
  { role: 'comment', label: '내 코멘트', names: ['소감', '코멘트', '내 평가', '한줄 소감', '평가', 'comment', 'my note', 'review'] },
  { role: 'freq', label: '동작 주파수', names: ['동작 주파수', '주파수', '대역', '주파수 대역', 'frequency', 'freq', 'band', 'operating frequency'] },
  { role: 'cem', label: 'CEM 기법', names: ['cem 기법', 'cem', '해석 기법', '수치 기법', '기법', '방법론', 'method', 'methods', 'solver', 'technique'] },
  { role: 'structure', label: '핵심 구조/소자', names: ['핵심 구조/소자', '핵심 구조', '구조/소자', '구조', '소자', 'structure', 'device'] },
]
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** 헤더 → 역할별 열 번호. overrides: { role: '헤더 이름' } (컬럼 매핑 설정) */
export function detectRoles(headers, overrides = {}) {
  const map = {}
  const used = new Set()
  for (const [role, name] of Object.entries(overrides || {})) {
    const i = headers.findIndex((h) => norm(h) === norm(name))
    if (name && i >= 0) {
      map[role] = i
      used.add(i)
    }
  }
  const pass = (match) =>
    headers.forEach((h, i) => {
      if (used.has(i)) return
      const n = norm(h)
      const def = ROLE_DEFS.find((d) => map[d.role] === undefined && d.names.some((x) => match(n, x)))
      if (def) {
        map[def.role] = i
        used.add(i)
      }
    })
  pass((n, x) => n === x || n.replace(/\s/g, '') === x.replace(/\s/g, ''))
  pass((n, x) => (/[^a-z0-9 ]/i.test(x) ? x.length >= 2 : x.length > 2) && n.includes(x))
  if (map.title === undefined) {
    const i = headers.findIndex((_, k) => !used.has(k))
    if (i >= 0) map.title = i
  }
  return map
}

/** 다양한 날짜 표기 → 'YYYY-MM-DD' (인식 못 하면 '') */
export function normDate(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  let m = s.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/) // gviz 원시 값 (월 0부터)
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) // 미국식 M/D/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  if (/^\d{5}$/.test(s)) {
    // 스프레드시트 일련번호 (1899-12-30 기준)
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  return ''
}

const splitTags = (v) =>
  String(v || '')
    .split(/[,;#|·\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)

/** 중요 논문 여부: ★★★, 높음, 상, high, 중요, Y, 3 이상 등 */
export function isImportant(v) {
  const s = norm(v)
  if (!s) return false
  if ((s.match(/[★⭐]/g) || []).length >= 3) return true
  if (/^(높음|상|중요|매우 중요|필독|high|important|must|y|yes|true|o|✓|✔|!+)$/.test(s)) return true
  if (/(^|[\s(])(s|a\+)\)?$/.test(s)) return true // 최상위 등급 S·A+ (예: '1 (S)'). 일반 A·B 등급은 배지로만 표시
  const n = Number(s)
  return !Number.isNaN(n) && n >= 3
}

export function toPapers(headers, rows, overrides) {
  const r = detectRoles(headers, overrides)
  const get = (row, role) => (r[role] === undefined ? '' : String(row[r[role]] ?? '').trim())
  return rows
    .map((row, rowIndex) => {
      const linkRaw = get(row, 'link')
      const doi = linkRaw.match(/\b(10\.\d{4,9}\/\S+)/)?.[1]
      const link = /^https?:\/\//i.test(linkRaw) ? linkRaw : doi ? `https://doi.org/${doi}` : ''
      const venue = get(row, 'venue')
      // 발행연도 열이 없으면 출판 정보(예: 'arXiv …, 2026')에서 연도 추출
      const year = get(row, 'year').match(/\d{4}/)?.[0] || get(row, 'year') || venue.match(/(?:19|20)\d{2}(?!.*(?:19|20)\d{2})/)?.[0] || ''
      return {
        id: `row-${rowIndex}`,
        rowIndex,
        date: normDate(get(row, 'date')),
        title: get(row, 'title'),
        authors: get(row, 'authors'),
        venue,
        venueKey: venue.split(/[,(（]/)[0].trim() || venue, // 필터 칩용 이름 (예: 'arXiv (physics.optics), 2026' → 'arXiv')
        year,
        tags: splitTags(get(row, 'tags')),
        summary: get(row, 'summary'),
        link,
        importance: get(row, 'importance'),
        important: isImportant(get(row, 'importance')),
        status: get(row, 'status'),
        comment: get(row, 'comment'),
        freq: get(row, 'freq'),
        cem: get(row, 'cem'),
        structure: get(row, 'structure'),
        raw: row,
      }
    })
    .filter((p) => p.title)
    .map((p) => ({ ...p, bands: detectBands(p), methods: detectMethods(p) }))
}

/* ── 동작 주파수 대역 · CEM 기법 자동 분류 ─────────────────────── */
// 칩 표시 순서 = 스펙트럼 순서
export const BANDS = [
  { key: 'RF', label: 'RF · UHF', hint: '< 1 GHz' },
  { key: 'MW', label: 'Microwave', hint: '1–8 GHz' },
  { key: 'X', label: 'X-band', hint: '8–12 GHz' },
  { key: 'K', label: 'Ku · K · Ka', hint: '12–30 GHz' },
  { key: 'MMW', label: 'mmWave', hint: '30–100 GHz' },
  { key: 'SUBTHZ', label: 'Sub-THz', hint: '100–300 GHz' },
  { key: 'THZ', label: 'THz', hint: '0.3–30 THz' },
  { key: 'OPT', label: 'Optical', hint: 'IR · Visible' },
]
const bandOfGHz = (f) =>
  f < 1 ? 'RF' : f < 8 ? 'MW' : f < 12 ? 'X' : f < 30 ? 'K' : f < 100 ? 'MMW' : f < 300 ? 'SUBTHZ' : f < 30000 ? 'THZ' : 'OPT'
const UNIT_GHZ = { khz: 1e-6, mhz: 1e-3, ghz: 1, thz: 1000 }
const BAND_WORDS = [
  ['OPT', /optical|optics|visible|infrared|photonic|\blidar\b|광학|가시광|적외선|포토닉/i],
  ['THZ', /(?<!sub[- ]?)\bterahertz\b|(?<!sub[- ]?)\bthz\b|테라헤르츠/i],
  ['SUBTHZ', /sub[- ]?thz|sub[- ]?terahertz|d[- ]band|서브\s*테라/i],
  ['MMW', /mm[- ]?wave|millimet(er|re)[- ]wave|밀리미터파|\b(28|38|60|77|79|94)\s*ghz/i],
  ['K', /\bk[ua]?[- ]band\b/i],
  ['X', /\bx[- ]band\b/i],
  ['MW', /microwave|마이크로파|\bs[- ]band\b|\bc[- ]band\b|\bl[- ]band\b|sub[- ]?6/i],
  ['RF', /\buhf\b|\bvhf\b|\brfid\b/i],
]
/** 주파수 문자열에서 대역 키 목록. 괄호 속 부연 설명(예: 오기 메모)은 무시 */
export function bandsFromText(text) {
  const s = String(text || '').replace(/\([^)]*\)|（[^）]*）/g, ' ')
  const out = new Set()
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:[-–~]|to)\s*(\d+(?:\.\d+)?))?\s*(khz|mhz|ghz|thz|nm|μm|µm|um)\b/gi
  const hits = [...s.matchAll(re)]
  // GHz 이상 값이 있으면 MHz·kHz 값(변조·신호 대역폭 등)은 동작 대역에서 제외
  const hasHigh = hits.some((m) => /ghz|thz/i.test(m[3]))
  for (const m of hits) {
    const unit = m[3].toLowerCase()
    if (hasHigh && (unit === 'mhz' || unit === 'khz')) continue
    for (const v of [m[1], m[2]].filter(Boolean).map(Number).filter((x) => x > 0)) {
      if (unit in UNIT_GHZ) out.add(bandOfGHz(v * UNIT_GHZ[unit]))
      else out.add(unit === 'nm' || v < 30 ? 'OPT' : 'THZ') // 파장: nm·수 μm는 광학, 수십 μm 이상은 THz
    }
  }
  for (const [k, re2] of BAND_WORDS) if (re2.test(s)) out.add(k)
  return BANDS.map((b) => b.key).filter((k) => out.has(k))
}
function detectBands(p) {
  const own = bandsFromText(p.freq)
  if (own.length) return own
  return bandsFromText([p.title, p.summary, p.tags.join(' '), p.structure].join(' | '))
}

export const METHODS = [
  { key: 'MoM / IE', re: /\bmom\b|method of moments|모멘트\s*법|integral equation|적분\s*방정식|\b[emc]fie\b|\brwg\b|\bmlfma\b|\bfmm\b|\bpmchwt\b/i },
  { key: 'FDTD', re: /fdtd|finite[- ]difference time[- ]domain|유한\s*차분\s*시간/i },
  { key: 'FEM', re: /\bfem\b|finite[- ]element|유한\s*요소|\bhfss\b|comsol/i },
  { key: 'MNT / Floquet', re: /\bmnt\b|network theory|네트워크\s*이론|multiport network|다중\s*포트\s*네트워크|floquet|플로케/i },
  { key: 'GSTC', re: /gstc|generali[sz]ed sheet transition|시트\s*전이\s*조건|surface susceptibilit|표면\s*감수율/i },
  { key: 'Equivalent Circuit', re: /equivalent[- ]circuit|등가\s*회로|transmission[- ]line model|전송\s*선로\s*모델/i },
  { key: 'CMA', re: /\bcma\b|characteristic mode|특성\s*모드/i },
  { key: 'DDA / Dipole', re: /\bdda\b|discrete dipole|coupled[- ]dipole|쌍극자\s*근사|이산\s*쌍극자|분극률/i },
  { key: 'RCWA', re: /\brcwa\b|rigorous coupled[- ]wave/i },
  { key: 'Coupled-Mode', re: /coupled[- ]mode theory|\bcmt\b|결합\s*모드\s*이론/i },
  { key: 'Inverse Design', re: /inverse design|역설계|adjoint|애드조인트|topology optimi[sz]ation|위상\s*최적화/i },
  { key: 'ML / DL', re: /deep learning|neural network|machine learning|딥\s*러닝|신경망|머신\s*러닝|\bcnn\b|\bgan\b/i },
]
/** CEM 기법 열(없으면 제목·요약·키워드)에서 주요 기법 추출 */
export function methodsFromText(text) {
  const s = String(text || '')
  return METHODS.filter((m) => m.re.test(s)).map((m) => m.key)
}
function detectMethods(p) {
  const own = methodsFromText(p.cem)
  if (own.length) return own
  return methodsFromText([p.title, p.summary, p.tags.join(' ')].join(' | '))
}

/** 같은 기록일끼리 묶기 (입력 순서 유지) → [{ date, papers }] */
export function groupByDate(papers) {
  const groups = []
  const at = new Map()
  for (const p of papers) {
    const k = p.date || ''
    if (!at.has(k)) {
      at.set(k, groups.length)
      groups.push({ date: k, papers: [] })
    }
    groups[at.get(k)].papers.push(p)
  }
  return groups
}
export const fmtGroupDate = (d) => (d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1. $2. $3') : '날짜 미기록')

/** order: 'newest'(기본) | 'oldest' */
export function sortPapers(papers, order = 'newest') {
  const dir = order === 'oldest' ? -1 : 1
  return [...papers].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? dir : -dir
    if (!!a.date !== !!b.date) return a.date ? -1 : 1 // 날짜 없는 행은 항상 아래
    return (b.rowIndex - a.rowIndex) * dir // 같은 날짜: 나중에 추가된 행이 위
  })
}

/* ── 공유 링크 / 범위 ─────────────────────────────── */
export function parseSheetUrl(input = '') {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/)
  const id = m ? m[1] : /^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null
  if (!id) return null
  return { id, gid: s.match(/[#?&]gid=(\d+)/)?.[1] || '' }
}
const a1Range = (sheetName) => (sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:Z2000` : 'A1:Z2000')

/* ── 1) gviz (링크 공유 시트, 키 없음) ─────────────── */
export function parseGviz(text) {
  const start = text.indexOf('setResponse(')
  if (start < 0) throw new Error('시트를 읽을 수 없어요. 공유 설정이 「링크가 있는 모든 사용자: 뷰어」인지 확인해 주세요.')
  const json = JSON.parse(text.slice(start + 'setResponse('.length, text.lastIndexOf(')')))
  if (json.status === 'error') {
    const msg = json.errors?.[0]?.detailed_message || json.errors?.[0]?.message || '알 수 없는 오류'
    throw new Error(/access|permission|login/i.test(msg) ? '시트에 접근할 수 없어요. 링크 공유를 켜 주세요.' : `시트 오류: ${msg}`)
  }
  const cols = json.table?.cols || []
  const headers = cols.map((c, i) => c.label || c.id || `열 ${i + 1}`)
  const rows = (json.table?.rows || []).map((r) =>
    cols.map((c, i) => {
      const cell = r.c?.[i]
      if (!cell) return ''
      if (c.type === 'number' && typeof cell.v === 'number' && /연도|year/i.test(headers[i])) return String(Math.round(cell.v))
      if ((c.type === 'date' || c.type === 'datetime') && typeof cell.v === 'string') return normDate(cell.v) || cell.f || ''
      return cell.f ?? (cell.v === null ? '' : String(cell.v))
    }),
  )
  const keep = cols.map((c, i) => !!c.label || rows.some((r) => String(r[i]).trim()))
  return { headers: headers.filter((_, i) => keep[i]), rows: rows.map((r) => r.filter((_, i) => keep[i])) }
}

async function fetchGviz(ref, sheetName) {
  const q = new URLSearchParams({ tqx: 'out:json', headers: '1' })
  if (sheetName) q.set('sheet', sheetName)
  else if (ref.gid) q.set('gid', ref.gid)
  let res
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?${q}`, { cache: 'no-store' })
  } catch {
    throw new Error('시트를 불러오지 못했어요. 공유 설정(링크가 있는 모든 사용자)을 확인해 주세요.')
  }
  if (!res.ok) throw new Error(`시트를 불러오지 못했어요 (HTTP ${res.status}).`)
  return parseGviz(await res.text())
}

/* ── 2·3) 공식 Sheets API v4 (API Key / OAuth) ─────── */
function fromValues(values = []) {
  const [head = [], ...rest] = values
  const width = Math.max(head.length, ...rest.map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => String(head[i] ?? '').trim() || `열 ${i + 1}`)
  const rows = rest.filter((r) => r.some((v) => String(v).trim())).map((r) => headers.map((_, i) => String(r[i] ?? '')))
  return { headers, rows }
}

const v4Url = (id, sheetName, extra = '') =>
  `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(a1Range(sheetName))}?majorDimension=ROWS${extra}`

async function v4Error(res) {
  let msg = res.statusText
  try {
    msg = (await res.json()).error?.message || msg
  } catch {
    /* ignore */
  }
  if (res.status === 403 && /referer|referrer/i.test(msg)) return 'API Key의 HTTP 리퍼러 제한에 이 주소가 없어요. 보안 가이드대로 리퍼러를 등록해 주세요.'
  if (res.status === 403) return `접근 거부: ${msg} (API Key라면 시트가 공개(링크 공유)인지, Sheets API가 허용됐는지 확인)`
  if (res.status === 400 && /API key/i.test(msg)) return 'API Key가 올바르지 않아요.'
  if (res.status === 404) return '시트를 찾을 수 없어요. 링크와 탭 이름을 확인해 주세요.'
  return `Sheets API ${res.status}: ${msg}`
}

async function fetchApiKey(ref, sheetName, apiKey) {
  if (!apiKey) throw new Error('API Key를 입력해 주세요.')
  const res = await fetch(v4Url(ref.id, sheetName, `&key=${encodeURIComponent(apiKey)}`), { cache: 'no-store' })
  if (!res.ok) throw new Error(await v4Error(res))
  return fromValues((await res.json()).values)
}

async function fetchOAuth(ref, sheetName) {
  try {
    return fromValues((await gapi(v4Url(ref.id, sheetName))).values)
  } catch (e) {
    throw new Error(e.message.replace(/^Google API/, 'Sheets API'))
  }
}

/**
 * @param {{ mode, sheetUrl, sheetName, apiKey, columns }} cfg
 */
export async function fetchSheet(cfg) {
  const ref = parseSheetUrl(cfg.sheetUrl)
  if (!ref) throw new Error('Google Sheets 링크 형식이 올바르지 않아요. (docs.google.com/spreadsheets/d/…)')
  const { headers, rows } =
    cfg.mode === 'apikey'
      ? await fetchApiKey(ref, cfg.sheetName, cfg.apiKey)
      : cfg.mode === 'oauth'
        ? await fetchOAuth(ref, cfg.sheetName)
        : await fetchGviz(ref, cfg.sheetName)
  return { headers, rows, papers: toPapers(headers, rows, cfg.columns), roles: detectRoles(headers, cfg.columns), fetchedAt: new Date() }
}

/* ── 공개 스냅샷 (public/data/papers.json) ─────────────────────────
 * 비공개(OAuth) 시트여도 방문자 화면이 막히지 않도록, 관리자가 시트를 읽을 때
 * headers/rows 스냅샷을 저장소에 커밋해 두고 방문자는 이 파일을 먼저 보여 줍니다. */
export const SNAPSHOT_PATH = 'public/data/papers.json'
const SNAPSHOT_URL = '/data/papers.json'
let snapPromise = null
export function loadSnapshot(force = false) {
  if (!snapPromise || force)
    snapPromise = fetch(SNAPSHOT_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => (s && Array.isArray(s.headers) && Array.isArray(s.rows) ? s : null))
      .catch(() => null)
  return snapPromise
}

/** 표 내용 지문 (변경 여부 비교용, djb2) */
export function fingerprint(headers, rows) {
  const text = JSON.stringify([headers, rows])
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + text.length.toString(36)
}

export function makeSnapshot(data) {
  return { syncedAt: new Date().toISOString(), fingerprint: fingerprint(data.headers, data.rows), headers: data.headers, rows: data.rows }
}

function fromSnapshot(snap, columns) {
  if (!snap) return null
  return {
    headers: snap.headers,
    rows: snap.rows,
    papers: toPapers(snap.headers, snap.rows, columns),
    roles: detectRoles(snap.headers, columns),
    fetchedAt: snap.syncedAt ? new Date(snap.syncedAt) : null,
    source: 'snapshot',
  }
}

// 관리자 브라우저: 실시간 데이터가 스냅샷과 다르면 papers.json을 자동 갱신 (세션당 지문별 1회)
const syncing = new Set()
async function autoSyncSnapshot(data) {
  const snap = makeSnapshot(data)
  const current = await loadSnapshot()
  if (current?.fingerprint === snap.fingerprint || syncing.has(snap.fingerprint)) return false
  syncing.add(snap.fingerprint)
  try {
    const { publishJSON } = await import('./publish.js')
    await publishJSON(SNAPSHOT_PATH, snap, `radar: 공개 스냅샷 동기화 (${data.papers.length}편)`)
    snapPromise = Promise.resolve(snap)
    return true
  } catch (e) {
    syncing.delete(snap.fingerprint)
    console.warn('[radar] 스냅샷 동기화 실패:', e)
    return false
  }
}

/**
 * radar.json 설정 → 논문 데이터
 *  1) 공개 스냅샷(papers.json)을 먼저 보여 주고  2) 실시간 시트를 읽어 교체합니다.
 *  - OAuth 모드 + 방문자: 시트가 링크 공유돼 있으면 gviz로 실시간, 아니면 스냅샷
 *  - 실시간 읽기 실패 시에도 스냅샷이 있으면 오류 대신 스냅샷을 유지
 */
export function useRadarPapers(cfg, ready = true) {
  const { isAdmin } = useAdmin()
  const g = useGoogle()
  const mode = ready && cfg?.sheetUrl ? cfg.mode || 'gviz' : 'sample'
  const canOAuth = isAdmin && g.connected && g.token?.sheets
  const [state, setState] = useState({ loading: false, error: '', data: null, source: '', synced: false })
  const [nonce, setNonce] = useState(0)
  const key = JSON.stringify([mode, cfg?.sheetUrl, cfg?.sheetName, cfg?.apiKey, cfg?.columns, canOAuth, isAdmin])

  useEffect(() => {
    if (mode === 'sample') {
      setState({ loading: false, error: '', data: null, source: '', synced: false })
      return
    }
    let alive = true
    let live = false
    setState((s) => ({ ...s, loading: true, error: '' }))

    // 1) 스냅샷: 즉시 표시
    const snapP = loadSnapshot(nonce > 0).then((snap) => {
      const d = fromSnapshot(snap, cfg.columns)
      if (alive && d && !live) setState((s) => (s.data && s.source !== 'snapshot' ? s : { ...s, data: d, source: 'snapshot' }))
      return d
    })

    // 2) 실시간 시트
    const liveMode = mode === 'oauth' && !canOAuth ? 'gviz' : mode
    fetchSheet({ ...cfg, mode: liveMode })
      .then(async (data) => {
        live = true
        if (!alive) return
        setState({ loading: false, error: '', data: { ...data, source: liveMode }, source: liveMode, synced: false })
        if (isAdmin && (await autoSyncSnapshot(data)) && alive) setState((s) => ({ ...s, synced: true }))
      })
      .catch(async (e) => {
        const snap = await snapP
        if (!alive) return
        if (snap) setState((s) => ({ ...s, loading: false, error: '', data: s.data || snap, source: s.source || 'snapshot' }))
        else
          setState({
            loading: false,
            error: mode === 'oauth' && !canOAuth ? '' : e.message,
            data: null,
            source: '',
            synced: false,
          })
      })
    return () => {
      alive = false
    }
  }, [key, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const data = mode === 'sample' ? SAMPLE : state.data
  // 실시간·스냅샷 모두 없을 때만 「비공개」 안내 (관리자용)
  const needsAuth = mode === 'oauth' && !canOAuth && !state.loading && !data
  return { ...state, mode, data, sample: mode === 'sample', needsAuth, isAdmin, canOAuth, reload: () => setNonce((n) => n + 1) }
}

/** 관리자: 현재 데이터를 공개 스냅샷으로 즉시 커밋 */
export async function publishSnapshot(data) {
  const snap = makeSnapshot(data)
  const { publishJSON } = await import('./publish.js')
  await publishJSON(SNAPSHOT_PATH, snap, `radar: 공개 스냅샷 동기화 (${data.papers.length}편)`)
  snapPromise = Promise.resolve(snap)
  return snap
}

/** 정렬된 목록 (최신 기록순 기본) */
export function useSortedPapers(data, order = 'newest') {
  return useMemo(() => sortPapers(data?.papers || [], order), [data, order])
}

/* ── 샘플: 시트에 위에서 아래로 기록해 온 순서 그대로 (맨 위 3행이 가장 오래된 초기 자료) ── */
const SAMPLE_HEADERS = ['기록일', '제목', '저자', '저널/학회', '발행연도', '키워드/태그', '한줄요약', 'DOI/원문 링크', '중요도', '읽음상태']
const SAMPLE_ROWS = [
  // 초기 자료 3건 (가장 오래된 기록) → 정렬 후 목록 맨 아래
  ['2026-11-01', 'Field Computation by Moment Methods', 'R. F. Harrington', 'Macmillan (Book)', '1968', 'Method of Moments', '모멘트법의 기본 틀을 정리한 교과서', '', '★★★', '읽음'],
  [
    '2026-11-02',
    'Electromagnetic scattering by surfaces of arbitrary shape',
    'S. M. Rao, D. R. Wilton, A. W. Glisson',
    'IEEE Trans. Antennas Propag.',
    '1982',
    'Method of Moments, RWG',
    'RWG 기저함수를 제안한 표면 적분방정식 MoM의 고전',
    '10.1109/TAP.1982.1142818',
    '★★★',
    '읽음',
  ],
  [
    '2026-11-03',
    'Light propagation with phase discontinuities: generalized laws of reflection and refraction',
    'N. Yu, P. Genevet, M. A. Kats, F. Aieta, J.-P. Tetienne, F. Capasso, Z. Gaburro',
    'Science',
    '2011',
    'Metasurface',
    '위상 불연속면으로 일반화된 반사·굴절 법칙을 제시한 메타표면의 출발점',
    '10.1126/science.1210713',
    '★★',
    '읽음',
  ],
  // 이후 기록
  [
    '2026-11-10',
    'Coding metamaterials, digital metamaterials and programmable metamaterials',
    'T. J. Cui, M. Q. Qi, X. Wan, J. Zhao, Q. Cheng',
    'Light: Science & Applications',
    '2014',
    'Metasurface, Coding Metamaterial',
    '0/1 코딩 단위로 전자기파를 디지털 제어하는 개념 제안',
    '10.1038/lsa.2014.99',
    '★★',
    '읽음',
  ],
  [
    '2026-11-24',
    'Space-time-coding digital metasurfaces',
    'L. Zhang et al. (T. J. Cui group)',
    'Nature Communications',
    '2018',
    'Metasurface, Space-Time Modulation',
    '시간·공간 코딩을 결합해 주파수와 방향을 동시에 제어',
    '10.1038/s41467-018-06802-0',
    '★★★',
    '읽는 중',
  ],
  [
    '2026-11-24',
    'Nonlocal metasurfaces for optical signal processing',
    'H. Kwon, D. Sounas, A. Cordaro, A. Polman, A. Alù',
    'Physical Review Letters',
    '2018',
    'Nonlocal, Metasurface',
    '비국소 응답으로 미분·엣지 검출 같은 아날로그 연산 구현',
    '10.1103/PhysRevLett.121.173004',
    '★★',
    '읽을 예정',
  ],
]
export const SAMPLE = {
  headers: SAMPLE_HEADERS,
  rows: SAMPLE_ROWS,
  papers: toPapers(SAMPLE_HEADERS, SAMPLE_ROWS),
  roles: detectRoles(SAMPLE_HEADERS),
  fetchedAt: null,
}
