// 클릭재킹 방어: 다른 사이트가 이 페이지를 <iframe>으로 감싸면 화면을 숨기고 최상위 창으로 빠져나옴.
// (GitHub Pages는 X-Frame-Options / CSP frame-ancestors 헤더를 보낼 수 없어 스크립트로 처리)
export function guardFraming() {
  if (typeof window === 'undefined' || window.top === window.self) return true
  document.documentElement.style.display = 'none'
  try {
    window.top.location = window.self.location.href
  } catch {
    // 상위 창 이동이 막혀 있으면 안내만 남김
    document.documentElement.style.display = ''
    document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">보안을 위해 이 페이지는 다른 사이트 안에서 열 수 없어요. <a href="' + location.href.replace(/"/g, '') + '" target="_top">새 창에서 열기</a></p>'
  }
  return false
}
