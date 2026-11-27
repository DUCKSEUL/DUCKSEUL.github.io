// 수식 입력 모드 ↔ 에디터 상단 툴바 연결 (PowerPoint [수식] 리본 전환)
// - 본문 수식 상자(구조 편집기 / LaTeX 원문)가 열리면 자신의 조작 API를 등록 → Write 화면이 툴바 자리에 수식 리본을 띄움
// - 상자가 닫히면 등록 해제 → 일반 글쓰기 툴바로 복귀
import { useSyncExternalStore } from 'react'

let current = null
const subs = new Set()

const notify = () => subs.forEach((f) => f())

/** api: { owner, kind: 'visual' | 'raw', insert(item), run?(cmd), matrixEnv?, toggleMode(), finish() } */
export function publishMathRibbon(api) {
  current = api
  notify()
}

/** owner가 등록한 API일 때만 해제 (다른 수식 상자가 이미 새로 등록했으면 그대로) */
export function clearMathRibbon(owner) {
  if (current && current.owner === owner) {
    current = null
    notify()
  }
}

const subscribe = (f) => {
  subs.add(f)
  return () => subs.delete(f)
}

export function useMathRibbon() {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
