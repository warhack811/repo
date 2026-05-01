import { lazy, Suspense } from 'react'
import { CodeBlock } from './CodeBlock'

const MermaidRenderer = lazy(() => import('./MermaidRenderer'))

type MermaidBlockProps = {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  if (typeof window === 'undefined') {
    return <CodeBlock code={code} language="mermaid" />
  }

  return (
    <Suspense fallback={<div className="diagram-skeleton">Loading diagram...</div>}>
      <MermaidRenderer code={code} />
    </Suspense>
  )
}
