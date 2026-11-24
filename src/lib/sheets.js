// 논문 레이더: Google Sheets 실시간 연동 (API 키·백엔드 없음)
// '링크가 있는 모든 사용자: 뷰어'로 공유된 시트를 Google Visualization API(gviz/tq?tqx=out:json)로 읽습니다.
// 첫 번째 행을 헤더로 보고(headers=1), 열 이름을 자동으로 인식해 제목·저자·저널·연도·키워드·요약·링크·읽음상태로 매핑합니다.
import { useEffect, useState } from 'react'

/** 시트 공유 링크 또는 ID → { id, gid } */
export function parseSheetUrl(input = '') {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/)
  const id = m ? m[1] : /^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null
  if (!id) return null
  const gid = s.match(/[#?&]gid=(\d+)/)?.[1] || ''
  return { id, gid }
}

export function gvizUrl({ id, gid }, sheetName) {
  const q = new URLSearchParams({ tqx: 'out:json', headers: '1' })
  if (sheetName) q.set('sheet', sheetName)
  else if (gid) q.set('gid', gid)
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${q}`
}

// 헤더 이름 → 역할 (한국어/영어 동의어)
const ROLES = {
  title: ['제목', '논문', '논문 제목', '논문제목', 'title', 'paper', 'name'],
  authors: ['저자', '저자명', 'author', 'authors', 'by'],
  venue: ['저널/학회', '저널', '학회', '출처', '게재', 'venue', 'journal', 'conference', 'source', 'publication'],
  year: ['연도', '년도', '발행연도', 'year', 'date', '날짜'],
  tags: ['키워드/태그', '키워드', '태그', 'keyword', 'keywords', 'tag', 'tags', 'topic', '분야'],
  summary: ['한줄요약', '한 줄 요약', '요약', '메모', 'summary', 'note', 'notes', 'tl;dr', 'abstract'],
  link: ['링크', '원문', '주소', 'url', 'link', 'doi', 'pdf'],
  status: ['읽음상태', '읽음 상태', '상태', '읽음', 'status', 'read', 'state'],
}
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

export function detectRoles(headers) {
  const map = {}
  headers.forEach((h, i) => {
    const n = norm(h)
    for (const [role, names] of Object.entries(ROLES)) {
      if (map[role] !== undefined) continue
      if (names.some((x) => n === x || n.replace(/\s/g, '') === x.replace(/\s/g, ''))) {
        map[role] = i
        return
      }
    }
  })
  // 정확히 맞는 이름이 없으면 포함 관계로 한 번 더
  headers.forEach((h, i) => {
    const n = norm(h)
    if (Object.values(map).includes(i)) return
    for (const [role, names] of Object.entries(ROLES)) {
      if (map[role] === undefined && names.some((x) => x.length > 1 && n.includes(x))) {
        map[role] = i
        return
      }
    }
  })
  if (map.title === undefined && headers.length) map.title = 0
  return map
}

const splitTags = (v) =>
  String(v || '')
    .split(/[,;#/|·\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)

/** 2차원 배열(헤더 + 행) → 정규화된 논문 목록 */
export function toPapers(headers, rows) {
  const r = detectRoles(headers)
  const get = (row, role) => (r[role] === undefined ? '' : String(row[r[role]] ?? '').trim())
  return rows
    .map((row, i) => {
      const linkRaw = get(row, 'link')
      const link = /^https?:\/\//i.test(linkRaw) ? linkRaw : /^10\.\d{4,}\//.test(linkRaw) ? `https://doi.org/${linkRaw}` : ''
      return {
        id: `row-${i}`,
        title: get(row, 'title'),
        authors: get(row, 'authors'),
        venue: get(row, 'venue'),
        year: get(row, 'year'),
        tags: splitTags(get(row, 'tags')),
        summary: get(row, 'summary'),
        link,
        status: get(row, 'status'),
        raw: row,
      }
    })
    .filter((p) => p.title)
}

/** gviz 응답 텍스트 → { headers, rows } */
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
      // 날짜/숫자는 서식 문자열(f)을 우선, 연도는 정수로
      if (c.type === 'number' && typeof cell.v === 'number' && /연도|year/i.test(headers[i])) return String(Math.round(cell.v))
      return cell.f ?? (cell.v === null ? '' : String(cell.v))
    }),
  )
  // 헤더도 값도 없는 빈 열(시트의 남는 열)은 제외
  const keep = cols.map((c, i) => !!c.label || rows.some((r) => String(r[i]).trim()))
  return { headers: headers.filter((_, i) => keep[i]), rows: rows.map((r) => r.filter((_, i) => keep[i])) }
}

export async function fetchSheet(sheetUrl, sheetName) {
  const ref = parseSheetUrl(sheetUrl)
  if (!ref) throw new Error('Google Sheets 링크 형식이 올바르지 않아요.')
  let res
  try {
    res = await fetch(gvizUrl(ref, sheetName), { cache: 'no-store' })
  } catch {
    throw new Error('시트를 불러오지 못했어요. 공유 설정(링크가 있는 모든 사용자)을 확인해 주세요.')
  }
  if (!res.ok) throw new Error(`시트를 불러오지 못했어요 (HTTP ${res.status}).`)
  const { headers, rows } = parseGviz(await res.text())
  return { headers, rows, papers: toPapers(headers, rows), roles: detectRoles(headers), fetchedAt: new Date() }
}

/** 시트 URL이 없으면 샘플 데이터, 있으면 실시간으로 불러오기 */
export function useSheetPapers(sheetUrl, sheetName) {
  const [state, setState] = useState({ loading: !!sheetUrl, error: '', data: null })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!sheetUrl) {
      setState({ loading: false, error: '', data: null })
      return
    }
    let alive = true
    setState((s) => ({ ...s, loading: true, error: '' }))
    fetchSheet(sheetUrl, sheetName)
      .then((data) => alive && setState({ loading: false, error: '', data }))
      .catch((e) => alive && setState({ loading: false, error: e.message, data: null }))
    return () => {
      alive = false
    }
  }, [sheetUrl, sheetName, nonce])

  const sample = !sheetUrl
  const data = sample ? SAMPLE : state.data
  return { ...state, data, sample, reload: () => setNonce((n) => n + 1) }
}

// 시트 연결 전 보여 줄 샘플 (헤더 구조 예시이기도 함)
const SAMPLE_HEADERS = ['제목', '저자', '저널/학회', '연도', '키워드/태그', '한줄요약', '링크', '읽음상태']
const SAMPLE_ROWS = [
  [
    'Space-time-coding digital metasurfaces',
    'L. Zhang, T. J. Cui et al.',
    'Nature Communications',
    '2018',
    'Metasurface, Space-Time Modulation',
    '시간·공간 코딩을 결합해 주파수와 방향을 동시에 제어하는 디지털 메타표면',
    'https://doi.org/10.1038/s41467-018-06802-0',
    '읽음',
  ],
  [
    'Nonlocal metasurfaces for optical signal processing',
    'H. Kwon, D. Sounas, A. Cordaro, A. Polman, A. Alù',
    'Physical Review Letters',
    '2018',
    'Nonlocal, Metasurface',
    '비국소 응답을 이용해 메타표면으로 미분·엣지 검출 같은 아날로그 연산 구현',
    'https://doi.org/10.1103/PhysRevLett.121.173004',
    '읽는 중',
  ],
  [
    'Electromagnetic scattering by surfaces of arbitrary shape',
    'S. M. Rao, D. R. Wilton, A. W. Glisson',
    'IEEE Trans. Antennas Propag.',
    '1982',
    'Method of Moments, RWG',
    'RWG 기저함수를 제안한 MoM 표면 적분방정식의 고전 논문',
    'https://doi.org/10.1109/TAP.1982.1142818',
    '읽음',
  ],
  [
    'Field Computation by Moment Methods',
    'R. F. Harrington',
    'Macmillan (Book)',
    '1968',
    'Method of Moments',
    '모멘트법의 기본 틀을 정리한 교과서',
    '',
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
