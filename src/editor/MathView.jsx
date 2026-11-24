import { useMemo } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { renderLatex } from '../lib/math.js'

export default function MathView({ node, extension, getPos, selected }) {
  const display = node.type.name === 'mathBlock'
  const latex = node.attrs.latex
  const html = useMemo(() => renderLatex(latex || '\\square', display), [latex, display])

  const edit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    extension.options.onEdit?.({ latex, display, pos: getPos() })
  }

  return (
    <NodeViewWrapper
      as={display ? 'div' : 'span'}
      className={`math-node ${display ? 'is-block' : 'is-inline'} ${selected ? 'is-selected' : ''}`}
      data-type={display ? 'math-block' : 'math-inline'}
      onDoubleClick={edit}
      title="더블클릭하여 수식 수정"
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  )
}
