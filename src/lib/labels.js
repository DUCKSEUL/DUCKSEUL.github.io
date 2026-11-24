// 연구 실적 · 일정 분류 라벨
export const PUB_TYPES = [
  { value: 'journal', label: 'Journal', ko: '저널 논문' },
  { value: 'conference', label: 'Conference', ko: '학술대회' },
  { value: 'patent', label: 'Patent', ko: '특허' },
  { value: 'project', label: 'Projects', ko: '코드/프로젝트' },
]
export const pubType = (v) => PUB_TYPES.find((t) => t.value === v) || PUB_TYPES[3]

export const EVENT_TYPES = [
  { value: 'seminar', label: '세미나' },
  { value: 'deadline', label: '마감' },
  { value: 'conference', label: '학회' },
  { value: 'milestone', label: '마일스톤' },
  { value: 'other', label: '기타' },
]
export const eventType = (v) => (v === 'google' ? { value: 'google', label: 'Google' } : EVENT_TYPES.find((t) => t.value === v) || EVENT_TYPES[4])

/** 'YYYY-MM-DD' → 로컬 자정 Date */
export const parseYmd = (s) => {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 오늘 기준 D-day 문자열 */
export function dday(dateStr, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((parseYmd(dateStr) - t) / 86400000)
  if (diff === 0) return 'D-Day'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}

export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '')
export const doiUrl = (doi) => (!doi ? '' : /^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi.replace(/^doi:\s*/i, '')}`)
