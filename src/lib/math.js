import katex from 'katex'

export function renderLatex(latex, displayMode, throwOnError = false) {
  return katex.renderToString(latex || '', { displayMode, throwOnError, strict: 'ignore' })
}

/** 저장된 HTML 안의 수식 자리표시자(data-latex)를 KaTeX로 렌더링 */
export function renderMathIn(container) {
  if (!container) return
  for (const el of container.querySelectorAll('[data-type="math-inline"], [data-type="math-block"]')) {
    const latex = el.getAttribute('data-latex') ?? el.textContent
    el.innerHTML = renderLatex(latex, el.getAttribute('data-type') === 'math-block')
    el.setAttribute('title', latex)
  }
}
