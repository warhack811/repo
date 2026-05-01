import { useEffect, useMemo, useState } from 'react'
import { highlightCode, normalizeLanguage } from './shiki-highlighter'

type CodeBlockProps = {
  code: string
  language?: string
  className?: string
}

const extractLanguage = (language?: string, className?: string) => {
  if (language) {
    return language
  }

  return /language-([^\s]+)/.exec(className ?? '')?.[1]
}

export function CodeBlock({ className, code, language }: CodeBlockProps) {
  const resolvedLanguage = extractLanguage(language, className)
  const normalizedLanguage = normalizeLanguage(resolvedLanguage)
  const [html, setHtml] = useState<string | undefined>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.setTimeout(() => {
      if (!cancelled) {
        setHtml(undefined)
        setFailed(false)
      }
    }, 0)

    if (!normalizedLanguage) {
      return undefined
    }

    highlightCode(code, normalizedLanguage)
      .then((nextHtml) => {
        if (!cancelled) {
          setHtml(nextHtml)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [code, normalizedLanguage])

  const label = useMemo(() => resolvedLanguage ?? 'text', [resolvedLanguage])

  if (html) {
    return (
      <figure className="runa-code-block" data-language={label}>
        <figcaption>{label}</figcaption>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </figure>
    )
  }

  return (
    <figure className="runa-code-block plain" data-language={label}>
      <figcaption>{failed ? `${label} highlighting failed` : label}</figcaption>
      {normalizedLanguage && !failed && <p className="code-loading">highlighting...</p>}
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  )
}
